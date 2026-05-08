// ============================================================
// ClearUX API — /api/credits
// GET  → returns credit balance for current user
// POST → deducts 1 credit for a new audit
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { inngest } from '@/lib/inngest/client'

/* ── GET — credit balance ───────────────────────────────── */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()
    const { data: profile } = await db
      .from('profiles')
      .select('credits, package_tier')
      .eq('id', user.id)
      .single()

    // Check if user is eligible for a free first audit
    const { count: completedAudits } = await db
      .from('audits')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['completed', 'failed', 'analysing', 'crawling', 'generating_report', 'payment_received'])

    const firstAuditFree = (completedAudits ?? 0) === 0

    return NextResponse.json({
      credits: (profile as any)?.credits ?? 0,
      package_tier: (profile as any)?.package_tier ?? 'starter',
      first_audit_free: firstAuditFree,
    })
  } catch (err) {
    console.error('GET /api/credits error:', err)
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 })
  }
}

/* ── POST — use 1 credit for an audit ───────────────────── */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { audit_id, is_free_first } = await request.json()
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
        .neq('id', audit_id) // exclude the audit we just created

      if ((existingAudits ?? 0) === 0) {
        usingFreeFirst = true
      }
    }

    if (!usingFreeFirst) {
      // Check balance
      const { data: profile } = await db
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single()

      const balance = profile?.credits ?? 0
      if (balance < 1)
        return NextResponse.json({ error: 'No credits available' }, { status: 400 })

      // Deduct 1 credit (atomic decrement via rpc or update)
      const { error: deductErr } = await db
        .from('profiles')
        .update({
          credits: balance - 1,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', user.id)
        .gte('credits', 1) // safety: only deduct if still >= 1

      if (deductErr) {
        console.error('Credit deduct error:', deductErr)
        return NextResponse.json({ error: 'Failed to deduct credit' }, { status: 500 })
      }
    }

    const balance = usingFreeFirst
      ? ((await db.from('profiles').select('credits').eq('id', user.id).single()).data?.credits ?? 0)
      : ((await db.from('profiles').select('credits').eq('id', user.id).single()).data?.credits ?? 0)

    // Create a payment record for audit tracking
    await db.from('payments').insert({
      audit_id,
      user_id: user.id,
      amount_cents: 0,
      currency: 'usd',
      status: 'succeeded',
      stripe_payment_intent_id: usingFreeFirst ? `free_first_${Date.now()}` : `credit_${Date.now()}`,
    } as any)

    // Update audit status to payment_received
    await db
      .from('audits')
      .update({
        status: 'payment_received',
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', audit_id)

    // Log it
    await db.from('audit_logs').insert({
      audit_id,
      event: usingFreeFirst ? 'free_first_audit' : 'credit_used',
      status: 'success',
      message: usingFreeFirst
        ? 'Free first audit — no credit deducted'
        : `1 credit deducted. Remaining: ${balance}`,
      metadata: usingFreeFirst
        ? { free_first: true }
        : { credits_before: balance + 1, credits_after: balance },
    } as any)

    // Determine audit type for correct Inngest dispatch
    // Smart inference: check audit_type first, then fall back to brand_identity_id + product_url
    const { data: auditRecord } = await db
      .from('audits')
      .select('audit_type, brand_identity_id, product_url')
      .eq('id', audit_id)
      .single()
    const ar = auditRecord as any
    const auditType = ar?.audit_type || (ar?.brand_identity_id && !ar?.product_url ? 'brand_identity' : 'website')
    const eventName = auditType === 'brand_identity' ? 'brand-audit/process' : 'audit/process'

    // Trigger audit processing via Inngest (background job)
    try {
      console.log(`[credits] Sending Inngest event "${eventName}" for audit ${audit_id}`)
      const sendResult = await inngest.send({
        name: eventName,
        data: { auditId: audit_id },
      })
      console.log(`[credits] Inngest event sent successfully:`, JSON.stringify(sendResult))
    } catch (inngestErr) {
      console.error(`[credits] Inngest send FAILED for audit ${audit_id}:`, inngestErr)
      // Fallback: process directly if Inngest fails
      if (auditType === 'website') {
        const { processAudit } = await import('@/lib/audit-engine')
        processAudit(audit_id).catch((err) => {
          console.error(`[credits] Fallback processAudit failed for ${audit_id}:`, err)
        })
      } else if (auditType === 'brand_identity') {
        const { processBrandAudit } = await import('@/lib/audit-engine/brand-processor')
        processBrandAudit(audit_id).catch((err) => {
          console.error(`[credits] Fallback processBrandAudit failed for ${audit_id}:`, err)
        })
      }
    }

    return NextResponse.json({
      success: true,
      credits_remaining: balance,
      free_first: usingFreeFirst,
      message: usingFreeFirst ? 'Free first audit started' : 'Credit applied, audit processing started',
    })
  } catch (err) {
    console.error('POST /api/credits error:', err)
    return NextResponse.json({ error: 'Failed to use credit' }, { status: 500 })
  }
}
