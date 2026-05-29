// ============================================================
// ClearUX API — /api/credits
// GET  → returns credit balance + subscription status
// POST → uses 1 credit or 1 subscription audit for a new audit
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { inngest } from '@/lib/inngest/client'

export const maxDuration = 300 // 5 minutes (Vercel Pro max)

/* ── GET — credit balance + subscription info ───────────── */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()
    const { data: profile } = await db
      .from('profiles')
      .select('credits, package_tier, subscription_plan, subscription_status, subscription_interval, audits_remaining, audits_per_month, white_label')
      .eq('id', user.id)
      .single()

    // Check if user is eligible for a free first audit
    const { count: completedAudits } = await db
      .from('audits')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['completed', 'failed', 'analysing', 'crawling', 'generating_report', 'payment_received'])

    const firstAuditFree = (completedAudits ?? 0) === 0
    const p = profile as any

    return NextResponse.json({
      credits: p?.credits ?? 0,
      package_tier: p?.package_tier ?? 'starter',
      first_audit_free: firstAuditFree,
      // Subscription fields
      subscription_plan: p?.subscription_plan ?? null,
      subscription_status: p?.subscription_status ?? null,
      subscription_interval: p?.subscription_interval ?? null,
      audits_remaining: p?.audits_remaining ?? 0,
      audits_per_month: p?.audits_per_month ?? 0,
      white_label: p?.white_label ?? false,
      // Can the user run an audit right now?
      can_audit: firstAuditFree
        || (p?.credits ?? 0) > 0
        || (p?.subscription_status === 'active' && (p?.audits_remaining ?? 0) > 0),
      // Does this user get free re-audits?
      unlimited_reaudits: p?.subscription_status === 'active',
    })
  } catch (err) {
    console.error('GET /api/credits error:', err)
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 })
  }
}

/* ── POST — use 1 credit/subscription-audit for an audit ── */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { audit_id, is_free_first, is_reaudit } = await request.json()
    if (!audit_id)
      return NextResponse.json({ error: 'audit_id required' }, { status: 400 })

    const db = createServiceSupabase()

    // Check if this is a free first audit
    let usingFreeFirst = false
    if (is_free_first) {
      const { count: existingAudits } = await db
        .from('audits')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['completed', 'failed', 'analysing', 'crawling', 'generating_report', 'payment_received'])
        .neq('id', audit_id)

      if ((existingAudits ?? 0) === 0) {
        usingFreeFirst = true
      }
    }

    if (!usingFreeFirst) {
      const { data: profile } = await db
        .from('profiles')
        .select('credits, subscription_plan, subscription_status, audits_remaining')
        .eq('id', user.id)
        .single()

      const p = profile as any
      const hasSubscription = p?.subscription_status === 'active'
      const subscriptionAuditsLeft = p?.audits_remaining ?? 0
      const creditBalance = p?.credits ?? 0

      // For re-audits: subscribers get them free, credit users pay 1 credit
      if (is_reaudit && hasSubscription) {
        // Free re-audit for subscribers — no deduction needed
      } else if (hasSubscription && subscriptionAuditsLeft > 0) {
        // Use subscription allowance
        const { error: deductErr } = await db
          .from('profiles')
          .update({
            audits_remaining: subscriptionAuditsLeft - 1,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', user.id)

        if (deductErr) {
          console.error('Subscription audit deduct error:', deductErr)
          return NextResponse.json({ error: 'Failed to use subscription audit' }, { status: 500 })
        }
      } else if (creditBalance > 0) {
        // Use credits
        const { error: deductErr } = await db
          .from('profiles')
          .update({
            credits: creditBalance - 1,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', user.id)
          .gte('credits', 1)

        if (deductErr) {
          console.error('Credit deduct error:', deductErr)
          return NextResponse.json({ error: 'Failed to deduct credit' }, { status: 500 })
        }
      } else {
        return NextResponse.json({ error: 'No audits available. Subscribe or buy credits.' }, { status: 400 })
      }
    }

    const { data: updatedProfile } = await db
      .from('profiles')
      .select('credits, audits_remaining')
      .eq('id', user.id)
      .single()
    const balance = (updatedProfile as any)?.credits ?? 0
    const auditsRemaining = (updatedProfile as any)?.audits_remaining ?? 0

    // Create a payment record
    await db.from('payments').insert({
      audit_id,
      user_id: user.id,
      amount_cents: 0,
      currency: 'usd',
      status: 'succeeded',
      stripe_payment_intent_id: usingFreeFirst
        ? `free_first_${Date.now()}`
        : is_reaudit
          ? `reaudit_${Date.now()}`
          : `credit_${Date.now()}`,
    } as any)

    // Update audit status
    await db
      .from('audits')
      .update({ status: 'payment_received', progress_percent: 1, audit_stage: 'preflight', updated_at: new Date().toISOString() } as any)
      .eq('id', audit_id)

    // Log it
    await db.from('audit_logs').insert({
      audit_id,
      event: usingFreeFirst ? 'free_first_audit' : is_reaudit ? 'reaudit' : 'credit_used',
      status: 'success',
      message: usingFreeFirst
        ? 'Free first audit — no credit deducted'
        : is_reaudit
          ? 'Re-audit (subscription — free)'
          : `1 credit/audit deducted. Credits: ${balance}, Sub audits: ${auditsRemaining}`,
    } as any)

    // Determine audit type and trigger processing
    const { data: auditRecord } = await db
      .from('audits')
      .select('audit_type, brand_identity_id, product_url')
      .eq('id', audit_id)
      .single()
    const ar = auditRecord as any
    const auditType = ar?.audit_type || (ar?.brand_identity_id && !ar?.product_url ? 'brand_identity' : 'website')
    const eventName = auditType === 'brand_identity' ? 'brand-audit/process' : 'audit/process'

    // Dispatch to Inngest only — no direct execution to prevent race conditions
    console.log(`[credits] Dispatching ${auditType} audit ${audit_id} to Inngest`)
    inngest.send({ name: eventName, data: { auditId: audit_id } }).catch((err) => {
      console.error(`[credits] Failed to send Inngest event for audit ${audit_id}:`, err)
    })

    return NextResponse.json({
      success: true,
      credits_remaining: balance,
      audits_remaining: auditsRemaining,
      free_first: usingFreeFirst,
      message: usingFreeFirst ? 'Free first audit started' : 'Audit processing started',
    })
  } catch (err) {
    console.error('POST /api/credits error:', err)
    return NextResponse.json({ error: 'Failed to use credit' }, { status: 500 })
  }
}
