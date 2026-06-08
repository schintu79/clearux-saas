// ============================================================
// Fixpath — Stall Sweeper (Inngest Cron)
// Runs every 5 minutes. Finds audits stuck in non-terminal
// states and forces them to completion or failure.
// This is the LAST line of defense — catches cases where both
// the in-process `finally` block and `onFailure` handler failed.
//
// Two sweep tiers:
//  1. ACTIVE audits (crawling/analysing/generating_report) → 10 min timeout
//  2. QUEUED audits (payment_received) → 30 min timeout
//     These are behind the Inngest concurrency limit (3) — a long timeout
//     avoids false failures on legitimately queued audits while still catching
//     ones that Inngest will never pick up.
// ============================================================

import { inngest } from '../client'
import { createServiceSupabase } from '@/lib/supabase-server'
import { logActivity } from '@/lib/audit-engine/activity-logger'
import { refundCredit } from '@/lib/audit-engine/refund-credit'

/** Active processing states — 10 minute timeout */
const ACTIVE_STALL_THRESHOLD_MINUTES = 10

/** Queued pre-processing state — 30 minute timeout */
const QUEUED_STALL_THRESHOLD_MINUTES = 30

export const stallSweeperFn = inngest.createFunction(
  {
    id: 'audit-stall-sweeper',
    retries: 1,
    triggers: [{ cron: '*/5 * * * *' }], // Every 5 minutes
  },
  async () => {
    const db = createServiceSupabase()

    const activeCutoff = new Date(Date.now() - ACTIVE_STALL_THRESHOLD_MINUTES * 60 * 1000).toISOString()
    const queuedCutoff = new Date(Date.now() - QUEUED_STALL_THRESHOLD_MINUTES * 60 * 1000).toISOString()

    // ── Tier 1: Active processing audits stuck for >10 minutes ──
    const { data: activeStalledAudits, error: activeError } = await db
      .from('audits')
      .select('id, status, progress_percent, updated_at, workspace_id')
      .in('status', ['crawling', 'analysing', 'generating_report'])
      .is('deleted_at', null)
      .lt('updated_at', activeCutoff)
      .limit(20)

    // ── Tier 2: Queued audits stuck for >30 minutes (Inngest never picked them up) ──
    const { data: queuedStalledAudits, error: queuedError } = await db
      .from('audits')
      .select('id, status, progress_percent, updated_at, workspace_id')
      .eq('status', 'payment_received')
      .is('deleted_at', null)
      .lt('updated_at', queuedCutoff)
      .limit(10)

    if (activeError) {
      console.error('[stall-sweeper] Active query error:', activeError.message)
    }
    if (queuedError) {
      console.error('[stall-sweeper] Queued query error:', queuedError.message)
    }

    const allStalled = [
      ...(activeStalledAudits || []),
      ...(queuedStalledAudits || []),
    ]

    if (allStalled.length === 0) {
      return { swept: 0 }
    }

    // ── Filter out audits whose workspace is archived or missing ──
    // We do this post-fetch because Supabase JS doesn't support JOINs.
    const workspaceIds = [...new Set(allStalled.map((a: any) => a.workspace_id).filter(Boolean))]
    const activeWorkspaceIds = new Set<string>()
    if (workspaceIds.length > 0) {
      const { data: activeWs } = await db
        .from('workspaces')
        .select('id')
        .in('id', workspaceIds)
        .eq('status', 'active')
      if (activeWs) {
        for (const ws of activeWs) activeWorkspaceIds.add((ws as any).id)
      }
    }

    // Only sweep audits that belong to an active workspace (or have no workspace_id for legacy audits)
    const eligibleAudits = allStalled.filter((a: any) =>
      !a.workspace_id || activeWorkspaceIds.has(a.workspace_id)
    )

    if (eligibleAudits.length === 0) {
      console.log(`[stall-sweeper] ${allStalled.length} stalled audit(s) found but all belong to archived/missing workspaces — skipping`)
      return { swept: 0, skippedArchived: allStalled.length }
    }

    let swept = 0

    for (const audit of eligibleAudits) {
      const auditId = (audit as any).id as string
      const progress = (audit as any).progress_percent as number ?? 0
      const status = (audit as any).status as string

      // Check if a report row actually exists in the DB — don't rely on progress %
      // (progress=82 means reporting STARTED, not that the report was written)
      const { data: reportCheck } = await db
        .from('reports')
        .select('id')
        .eq('audit_id', auditId)
        .maybeSingle()
      const hasReport = !!reportCheck
      const forcedStatus = hasReport ? 'completed_with_warnings' : 'failed'

      console.warn(
        `[stall-sweeper] Audit ${auditId} stalled: status=${status}, progress=${progress}%, ` +
        `last updated ${(audit as any).updated_at}. Forcing to ${forcedStatus}.`
      )

      const { error: updateError } = await db
        .from('audits')
        .update({
          status: forcedStatus,
          progress_percent: hasReport ? 100 : progress,
          // Use 'complete' for resolved audits; leave audit_stage as-is for failed
          // (so we can see WHERE it stalled in admin/debugging)
          audit_stage: hasReport ? 'complete' : undefined,
          completed_at: new Date().toISOString(),
          crawl_error: hasReport ? undefined : 'Audit timed out. Your partial results may still be available.',
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', auditId)

      if (updateError) {
        console.error(`[stall-sweeper] Failed to update ${auditId}:`, updateError.message)
        continue
      }

      // ── CRITICAL: Refund credit if audit failed without a usable report ──
      // Without this, users lose their credit when the stall sweeper catches
      // a stalled audit that never produced a report.
      if (!hasReport) {
        try {
          await refundCredit(auditId)
        } catch (refundErr) {
          console.error(`[stall-sweeper] Refund error for ${auditId} (non-fatal):`, refundErr)
        }
      }

      try {
        await logActivity(auditId, hasReport
          ? 'Audit completed by stall recovery. Some enrichment steps were skipped.'
          : 'Audit terminated by stall recovery after prolonged inactivity. Credit refunded.')
      } catch {
        // Activity log is non-critical
      }

      swept++
    }

    console.log(`[stall-sweeper] Swept ${swept} stalled audits`)
    return { swept, audits: eligibleAudits.map((a: any) => a.id) }
  },
)
