// ============================================================
// ClearUX API — POST /api/audits/:id/restart
// Restart an audit that is stuck in a processing state
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { inngest } from '@/lib/inngest/client'

const RESTARTABLE = ['crawling', 'analysing', 'generating_report', 'payment_received', 'failed']

// How long an audit can be in a processing state before we consider it stuck
const STUCK_AFTER_MS = 3 * 60 * 1000 // 3 minutes

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: auditId } = await params

    // Auth (Plan §0.7, D12): this route restarts pipelines and moves
    // credits — it was callable by ANYONE with an audit id. Require a
    // session and ownership of the audit.
    const authDb = await createServerSupabase()
    const { data: { user } } = await authDb.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const db = createServiceSupabase()

    const { data: audit, error } = await db
      .from('audits')
      .select('*')
      .eq('id', auditId)
      .is('deleted_at', null)
      .single()

    if (error || !audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    const a = audit as any
    if (a.user_id && a.user_id !== user.id) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    if (!RESTARTABLE.includes(a.status)) {
      return NextResponse.json(
        { error: `Cannot restart audit in "${a.status}" state. Use retry for failed audits.` },
        { status: 400 },
      )
    }

    // Check if actually stuck (not just started) — skip for failed audits
    const updatedAt = new Date(a.updated_at).getTime()
    const elapsed = Date.now() - updatedAt
    if (a.status !== 'failed' && elapsed < STUCK_AFTER_MS) {
      const remaining = Math.ceil((STUCK_AFTER_MS - elapsed) / 1000)
      return NextResponse.json(
        { error: `Audit is still processing. Wait ${remaining}s before restarting.` },
        { status: 400 },
      )
    }

    // Reset: clean up old data, set back to payment_received
    await db.from('audit_findings').delete().eq('audit_id', auditId)
    await db.from('reports').delete().eq('audit_id', auditId)
    await db.from('audit_pages').delete().eq('audit_id', auditId)

    await db
      .from('audits')
      .update({
        status: 'payment_received',
        audit_stage: 'preflight',
        crawl_error: null,
        pages_crawled: 0,
        progress_percent: 1,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', auditId)

    const { error: uncheckedInsertErr1 } = await db.from('audit_logs').insert({
      audit_id: auditId,
      event: 'audit_restarted',
      status: 'info',
      message: `Restarted after being stuck in "${a.status}" for ${Math.round(elapsed / 1000)}s`,
      metadata: {},
    } as any)
    if (uncheckedInsertErr1) console.error(`[db] insert failed (audit_logs): ${uncheckedInsertErr1.message}`)

    // ── Billing: re-deduct the credit if this audit was previously refunded ──
    // Failure paths auto-refund the credit. Restarting consumes the service
    // again, so a previously-refunded credit-based audit must re-use exactly
    // one credit. Net invariant: one completed audit = one credit, regardless
    // of how many failed attempts happened in between. Idempotent across
    // multiple restarts via refund/re-deduct event counting. Balance clamps
    // at 0 — we never block a restart over billing (failures were our fault).
    try {
      const { data: payment } = await db
        .from('payments')
        .select('user_id, stripe_payment_intent_id')
        .eq('audit_id', auditId)
        .single()
      const payId = (payment as any)?.stripe_payment_intent_id as string | undefined
      if (payId && payId.startsWith('credit_')) {
        const { data: billingEvents } = await db
          .from('audit_logs')
          .select('event')
          .eq('audit_id', auditId)
          .in('event', ['credit_refunded', 'credit_rededucted'])
        const refunds = (billingEvents || []).filter((e: any) => e.event === 'credit_refunded').length
        const rededucts = (billingEvents || []).filter((e: any) => e.event === 'credit_rededucted').length
        if (refunds > rededucts) {
          const userId = (payment as any).user_id as string
          const { data: profile } = await db.from('profiles').select('credits').eq('id', userId).single()
          const current = (profile as any)?.credits ?? 0
          const newBalance = Math.max(0, current - 1)
          // Checked (Plan §0.4): if the re-deduction fails silently, every
          // refunded-then-restarted audit becomes a free audit. Only write
          // the credit_rededucted marker when the deduction actually landed
          // — the marker is what prevents double re-deduction next restart.
          const { error: redeductError } = await db.from('profiles').update({ credits: newBalance, updated_at: new Date().toISOString() } as any).eq('id', userId)
          if (redeductError) {
            console.error(`[restart] CRITICAL: credit re-deduction FAILED for user ${userId} on audit ${auditId}: ${redeductError.message} — restart proceeds unbilled`)
          } else {
            const { error: markerError } = await db.from('audit_logs').insert({
              audit_id: auditId,
              event: 'credit_rededucted',
              status: 'info',
              message: `Restart re-used 1 credit (previously refunded after a failed attempt). Balance: ${newBalance}.`,
              metadata: { refunds, rededucts: rededucts + 1 },
            } as any)
            if (markerError) console.error(`[restart] CRITICAL: credit re-deducted but marker write FAILED for audit ${auditId}: ${markerError.message} — next restart may double-deduct`)
          }
        }
      }
    } catch (billErr) {
      console.error('[restart] Billing re-deduction failed (non-fatal):', billErr)
    }

    // Dispatch to Inngest only — no direct execution to prevent race conditions
    const auditType = (a as any).audit_type || ((a as any).brand_identity_id && !(a as any).product_url ? 'brand_identity' : 'website')
    const eventName = auditType === 'brand_identity' ? 'brand-audit/process' : 'audit/process'
    console.log(`[restart] Dispatching ${auditType} audit ${auditId} to Inngest`)
    // MUST await: on Vercel the lambda freezes as soon as the response is
    // returned, so an unawaited send() is frequently dropped in flight —
    // the audit resets to 1% but Inngest never receives the event, leaving
    // it stuck at payment_received until the queued-stall sweeper (30 min).
    try {
      await inngest.send({ name: eventName, data: { auditId } })
    } catch (sendErr) {
      console.error(`[restart] Failed to send Inngest event for audit ${auditId}:`, sendErr)
      return NextResponse.json(
        { error: 'Audit was reset but the processing job could not be dispatched. Please try again.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, message: 'Audit restarted' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[restart] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
