// ============================================================
// ClearUX API — POST /api/audits/:id/restart
// Restart an audit that is stuck in a processing state
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
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

    await db.from('audit_logs').insert({
      audit_id: auditId,
      event: 'audit_restarted',
      status: 'info',
      message: `Restarted after being stuck in "${a.status}" for ${Math.round(elapsed / 1000)}s`,
      metadata: {},
    } as any)

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
