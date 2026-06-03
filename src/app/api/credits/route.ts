// ============================================================
// Fixpath API — /api/credits
// GET  → returns full usage picture (canonical, query-derived)
// POST → validates quota and starts an audit
//
// All usage counts come from audit-usage.ts — the single source
// of truth. No decrement counters for re-audits or deep audits.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { inngest } from '@/lib/inngest/client'
import { getAuditUsage, checkAuditQuota } from '@/lib/audit-usage'

export const maxDuration = 300 // 5 minutes (Vercel Pro max)

/* ── GET — canonical usage from audit records ──────────────── */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()
    const usage = await getAuditUsage(user.id, db)

    return NextResponse.json({
      // Credits (for initial audits — from credit packs)
      credits: usage.credits,
      first_audit_free: usage.first_audit_free,
      // Subscription info
      subscription_plan: usage.subscription_plan,
      subscription_status: usage.subscription_status,
      subscription_interval: usage.subscription_interval,
      // Re-audit usage (query-derived, not counter)
      reaudits_remaining: Math.max(0, usage.re_audits_limit - usage.re_audits_used),
      reaudits_per_month: usage.re_audits_limit,
      reaudits_used: usage.re_audits_used,
      // Deep audit usage (query-derived)
      deep_audits_remaining: Math.max(0, usage.deep_audits_limit - usage.deep_audits_used),
      deep_audits_per_month: usage.deep_audits_limit,
      deep_audits_used: usage.deep_audits_used,
      // Workspace usage
      workspace_count: usage.workspaces_used,
      workspace_limit: usage.workspaces_limit,
      // Billing period
      billing_period_start: usage.billing_period_start,
      billing_period_end: usage.billing_period_end,
      // Permission flags
      can_audit: usage.can_initial_audit || usage.can_reaudit,
      can_reaudit: usage.can_reaudit,
      can_deep_audit: usage.can_deep_audit,
    })
  } catch (err) {
    console.error('GET /api/credits error:', err)
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 })
  }
}

/* ── POST — validate quota and start an audit ──────────────── */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { audit_id } = await request.json()
    if (!audit_id)
      return NextResponse.json({ error: 'audit_id required' }, { status: 400 })

    const db = createServiceSupabase()

    // ── Canonical quota check ────────────────────────────────
    // classifyAudit reads depth_mode + workspace history from the DB.
    // checkAuditQuota then compares against period-scoped usage counts.
    const quota = await checkAuditQuota(audit_id, user.id, db)

    if (!quota.allowed) {
      return NextResponse.json({ error: quota.reason }, { status: 400 })
    }

    // ── Deduct the correct resource ──────────────────────────
    // Only credits need a counter decrement (they're a purchased balance).
    // Re-audits and deep audits are limit-checked by query — the audit
    // record itself IS the usage, no counter to touch.
    if (quota.billing_class === 'initial_normal') {
      // Check if free first audit
      const usage = await getAuditUsage(user.id, db)
      if (usage.first_audit_free) {
        // No deduction needed
      } else if (usage.credits > 0) {
        // Deduct 1 credit
        const { error: deductErr } = await db
          .from('profiles')
          .update({
            credits: usage.credits - 1,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', user.id)
          .gte('credits', 1) // Optimistic concurrency guard

        if (deductErr) {
          console.error('Credit deduct error:', deductErr)
          return NextResponse.json({ error: 'Failed to deduct credit' }, { status: 500 })
        }
      } else if (usage.can_reaudit) {
        // Subscriber using re-audit allowance for initial audit — no deduction,
        // the audit record in the period is the usage itself
      } else {
        return NextResponse.json({ error: 'No credits available.' }, { status: 400 })
      }
    }
    // For reaudit_normal and deep: no counter to decrement.
    // The audit record already exists in the DB and will be counted
    // by getAuditUsage() on the next call.

    // ── Fetch updated balance for response ───────────────────
    const { data: updatedProfile } = await db
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single()
    const balance = (updatedProfile as any)?.credits ?? 0

    // Re-derive usage after potential credit deduction
    const finalUsage = await getAuditUsage(user.id, db)

    // ── Create payment record ────────────────────────────────
    const paymentRef = quota.billing_class === 'initial_normal'
      ? (finalUsage.first_audit_free ? `free_first_${Date.now()}` : `credit_${Date.now()}`)
      : quota.billing_class === 'reaudit_normal'
        ? `reaudit_${Date.now()}`
        : `deep_audit_${Date.now()}`

    await db.from('payments').insert({
      audit_id,
      user_id: user.id,
      amount_cents: 0,
      currency: 'usd',
      status: 'succeeded',
      stripe_payment_intent_id: paymentRef,
    } as any)

    // ── Update audit status to start pipeline ────────────────
    await db
      .from('audits')
      .update({
        status: 'payment_received',
        progress_percent: 1,
        audit_stage: 'preflight',
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', audit_id)

    // ── Log it ───────────────────────────────────────────────
    const logEvent = quota.billing_class === 'initial_normal'
      ? (finalUsage.first_audit_free ? 'free_first_audit' : 'credit_used')
      : quota.billing_class === 'reaudit_normal'
        ? 'reaudit_used'
        : 'deep_audit_used'

    const logMessage = quota.billing_class === 'initial_normal'
      ? (finalUsage.first_audit_free
          ? 'Free first audit — no credit deducted'
          : `1 credit deducted. Credits: ${balance}`)
      : quota.billing_class === 'reaudit_normal'
        ? `Re-audit used. ${finalUsage.re_audits_used}/${finalUsage.re_audits_limit} this period.`
        : `Deep audit used. ${finalUsage.deep_audits_used}/${finalUsage.deep_audits_limit} this period.`

    await db.from('audit_logs').insert({
      audit_id,
      event: logEvent,
      status: 'success',
      message: logMessage,
    } as any)

    // ── Dispatch to Inngest ──────────────────────────────────
    const { data: auditRecord } = await db
      .from('audits')
      .select('audit_type, brand_identity_id, product_url')
      .eq('id', audit_id)
      .single()
    const ar = auditRecord as any
    const auditType = ar?.audit_type || (ar?.brand_identity_id && !ar?.product_url ? 'brand_identity' : 'website')
    const eventName = auditType === 'brand_identity' ? 'brand-audit/process' : 'audit/process'

    console.log(`[credits] Dispatching ${auditType} audit ${audit_id} to Inngest (class: ${quota.billing_class})`)
    inngest.send({ name: eventName, data: { auditId: audit_id } }).catch((err) => {
      console.error(`[credits] Failed to send Inngest event for audit ${audit_id}:`, err)
    })

    return NextResponse.json({
      success: true,
      billing_class: quota.billing_class,
      credits_remaining: balance,
      reaudits_remaining: Math.max(0, finalUsage.re_audits_limit - finalUsage.re_audits_used),
      deep_audits_remaining: Math.max(0, finalUsage.deep_audits_limit - finalUsage.deep_audits_used),
      free_first: quota.billing_class === 'initial_normal' && finalUsage.first_audit_free,
      message: 'Audit processing started',
    })
  } catch (err) {
    console.error('POST /api/credits error:', err)
    return NextResponse.json({ error: 'Failed to use credit' }, { status: 500 })
  }
}
