// ============================================================
// Fixpath — Stall Sweeper (Inngest Cron)
// Runs every 5 minutes. Finds audits stuck in non-terminal
// states and forces them to completion or failure.
// This is the LAST line of defense — catches cases where both
// the in-process `finally` block and `onFailure` handler failed.
//
// THREE sweep tiers:
//  1. ACTIVE audits (crawling/analysing/generating_report)
//     → stalled if updated_at > 10 min ago
//  2. QUEUED audits (payment_received)
//     → stalled if updated_at > 30 min ago
//  3. HARD CEILING: ANY non-terminal audit older than 45 min from created_at
//     → swept regardless of updated_at (catches Inngest replay heartbeats)
//
// CRITICAL: The sweeper does NOT filter by workspace status.
// A stuck audit must be swept regardless of whether its workspace
// is active, archived, or missing. Leaving a stuck audit running
// wastes resources and blocks the user.
// ============================================================

import { inngest } from '../client'
import { createServiceSupabase } from '@/lib/supabase-server'
import { logActivity } from '@/lib/audit-engine/activity-logger'
import { refundCredit } from '@/lib/audit-engine/refund-credit'

/** Active processing states — 10 minute stall threshold (updated_at) */
const ACTIVE_STALL_THRESHOLD_MINUTES = 10

/** Queued pre-processing state — 30 minute stall threshold (updated_at) */
const QUEUED_STALL_THRESHOLD_MINUTES = 30

/**
 * HARD CEILING — absolute maximum runtime from created_at.
 * Any non-terminal audit older than this is swept unconditionally,
 * regardless of updated_at refreshes from Inngest step replays.
 * This prevents audits from running for 16+ hours.
 */
const HARD_CEILING_MINUTES = 45

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
    const hardCeilingCutoff = new Date(Date.now() - HARD_CEILING_MINUTES * 60 * 1000).toISOString()

    // ── Tier 1: Active processing audits stalled for >10 minutes (by updated_at) ──
    const { data: activeStalledAudits, error: activeError } = await db
      .from('audits')
      .select('id, status, progress_percent, updated_at, created_at, workspace_id')
      .in('status', ['crawling', 'analysing', 'generating_report'])
      .is('deleted_at', null)
      .lt('updated_at', activeCutoff)
      .limit(50)

    // ── Tier 2: Queued audits stuck for >30 minutes (Inngest never picked them up) ──
    const { data: queuedStalledAudits, error: queuedError } = await db
      .from('audits')
      .select('id, status, progress_percent, updated_at, created_at, workspace_id')
      .eq('status', 'payment_received')
      .is('deleted_at', null)
      .lt('updated_at', queuedCutoff)
      .limit(50)

    // ── Tier 3: HARD CEILING — any non-terminal audit older than 45 min ──
    // This catches audits where updated_at keeps getting refreshed by
    // Inngest step replays, preventing Tier 1/2 from catching them.
    const terminalStatuses = ['completed', 'failed', 'completed_with_warnings', 'stalled']
    const { data: hardCeilingAudits, error: ceilingError } = await db
      .from('audits')
      .select('id, status, progress_percent, updated_at, created_at, workspace_id')
      .not('status', 'in', `(${terminalStatuses.join(',')})`)
      .is('deleted_at', null)
      .lt('created_at', hardCeilingCutoff)
      .limit(50)

    if (activeError) {
      console.error('[stall-sweeper] Active query error:', activeError.message)
    }
    if (queuedError) {
      console.error('[stall-sweeper] Queued query error:', queuedError.message)
    }
    if (ceilingError) {
      console.error('[stall-sweeper] Hard ceiling query error:', ceilingError.message)
    }

    // Merge all tiers, deduplicate by audit ID
    const seenIds = new Set<string>()
    const allStalled: any[] = []
    for (const audit of [
      ...(activeStalledAudits || []),
      ...(queuedStalledAudits || []),
      ...(hardCeilingAudits || []),
    ]) {
      const id = (audit as any).id
      if (!seenIds.has(id)) {
        seenIds.add(id)
        allStalled.push(audit)
      }
    }

    if (allStalled.length === 0) {
      return { swept: 0 }
    }

    // NOTE: We intentionally do NOT filter by workspace status.
    // A stuck audit must be swept regardless of workspace state.
    // The old filter caused a 16-hour stuck audit to be silently skipped.

    let swept = 0

    for (const audit of allStalled) {
      const auditId = (audit as any).id as string
      const progress = (audit as any).progress_percent as number ?? 0
      const status = (audit as any).status as string
      const createdAt = (audit as any).created_at as string
      const ageMinutes = Math.round((Date.now() - new Date(createdAt).getTime()) / 60000)

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
        `age=${ageMinutes}min, last updated ${(audit as any).updated_at}. Forcing to ${forcedStatus}.`
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
          crawl_error: hasReport ? undefined : `Audit timed out after ${ageMinutes} minutes. Your partial results may still be available.`,
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
          ? `Audit completed by stall recovery after ${ageMinutes}min. Some enrichment steps were skipped.`
          : `Audit terminated by stall recovery after ${ageMinutes}min of inactivity. Credit refunded.`)
      } catch {
        // Activity log is non-critical
      }

      swept++
    }

    console.log(`[stall-sweeper] Swept ${swept} stalled audits`)
    return { swept, audits: allStalled.map((a: any) => a.id) }
  },
)
