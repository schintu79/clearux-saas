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
//  3. HARD CEILING: ANY non-terminal audit older than 20 min from created_at
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
import { sendAuditTimedOut } from '@/lib/audit-engine/email'

/** Active processing states — 10 minute stall threshold (updated_at) */
const ACTIVE_STALL_THRESHOLD_MINUTES = 10

/** Queued pre-processing state — 30 minute stall threshold (updated_at) */
const QUEUED_STALL_THRESHOLD_MINUTES = 30

/**
 * HARD CEILING — absolute maximum runtime from created_at.
 * Any non-terminal audit older than this is swept unconditionally,
 * regardless of updated_at refreshes from Inngest step replays.
 * A legitimate audit completes in under 15 minutes; 20 is generous.
 */
const HARD_CEILING_MINUTES = 20

/**
 * Core sweep logic — shared by the Inngest cron function AND the Vercel Cron
 * backup route (/api/cron/stall-sweep). Added 2026-06-10: the Inngest cron
 * silently stopped firing (audits sat non-terminal for 49+ minutes with no
 * sweep on June 9), so a second, independent trigger path now exists.
 * The sweep is idempotent — safe to run from both triggers concurrently.
 */
export async function runStallSweep() {
    const db = createServiceSupabase()

    const activeCutoff = new Date(Date.now() - ACTIVE_STALL_THRESHOLD_MINUTES * 60 * 1000).toISOString()
    const queuedCutoff = new Date(Date.now() - QUEUED_STALL_THRESHOLD_MINUTES * 60 * 1000).toISOString()
    const hardCeilingCutoff = new Date(Date.now() - HARD_CEILING_MINUTES * 60 * 1000).toISOString()

    // ── Tier 1: Active processing audits stalled for >10 minutes (by updated_at) ──
    const { data: activeStalledAudits, error: activeError } = await db
      .from('audits')
      .select('id, status, progress_percent, updated_at, created_at, crawl_started_at, workspace_id, user_id, product_url, audit_type')
      .in('status', ['crawling', 'analysing', 'generating_report'])
      .is('deleted_at', null)
      .lt('updated_at', activeCutoff)
      .limit(50)

    // ── Tier 2: Queued audits stuck for >30 minutes (Inngest never picked them up) ──
    const { data: queuedStalledAudits, error: queuedError } = await db
      .from('audits')
      .select('id, status, progress_percent, updated_at, created_at, crawl_started_at, workspace_id, user_id, product_url, audit_type')
      .eq('status', 'payment_received')
      .is('deleted_at', null)
      .lt('updated_at', queuedCutoff)
      .limit(50)

    // ── Tier 3: HARD CEILING — any non-terminal audit older than 20 min ──
    // This catches audits where updated_at keeps getting refreshed by
    // Inngest step replays, preventing Tier 1/2 from catching them.
    // NOTE (2026-06-10): this query selects by created_at as a CANDIDATE
    // superset only. The loop below re-verifies using PROCESSING age
    // (crawl_started_at when available) so audits waiting in the Inngest
    // queue under load are never killed for queue time. Without this, a
    // burst of concurrent audits (concurrency limit 3) would have ~85% of
    // the queue force-failed + refunded purely for waiting.
    const terminalStatuses = ['completed', 'failed', 'completed_with_warnings', 'stalled']
    const { data: hardCeilingAudits, error: ceilingError } = await db
      .from('audits')
      .select('id, status, progress_percent, updated_at, created_at, crawl_started_at, workspace_id, user_id, product_url, audit_type')
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
    let skippedQueued = 0
    const sweepNow = Date.now()
    const ACTIVE_STATUSES = ['crawling', 'analysing', 'generating_report']

    for (const audit of allStalled) {
      const auditId = (audit as any).id as string
      const progress = (audit as any).progress_percent as number ?? 0
      const status = (audit as any).status as string
      const createdAt = (audit as any).created_at as string
      const updatedAt = (audit as any).updated_at as string
      const crawlStartedAt = (audit as any).crawl_started_at as string | null

      // ── Per-audit tier re-verification (2026-06-10) ──────────────────
      // Queue-aware: the hard ceiling measures PROCESSING time, not wall
      // time since creation. crawl_started_at marks when work actually
      // began (website audits); brand audits have no crawl phase and fall
      // back to created_at (they dispatch immediately, so queue time is
      // negligible for them until brand-side concurrency exists).
      const updatedAtMs = new Date(updatedAt).getTime()
      const processingStartMs = crawlStartedAt
        ? new Date(crawlStartedAt).getTime()
        : new Date(createdAt).getTime()

      const tier1ActiveStall = ACTIVE_STATUSES.includes(status)
        && updatedAtMs < sweepNow - ACTIVE_STALL_THRESHOLD_MINUTES * 60 * 1000
      const tier2QueuedStall = status === 'payment_received'
        && updatedAtMs < sweepNow - QUEUED_STALL_THRESHOLD_MINUTES * 60 * 1000
      const tier3HardCeiling = status !== 'payment_received'
        && processingStartMs < sweepNow - HARD_CEILING_MINUTES * 60 * 1000

      if (!tier1ActiveStall && !tier2QueuedStall && !tier3HardCeiling) {
        // Candidate was old by created_at but hasn't exceeded any real
        // threshold (e.g. it waited in queue and is now processing
        // normally, with a fresh heartbeat). Leave it alone — the next
        // sweep pass re-evaluates it.
        skippedQueued++
        continue
      }

      const ageMinutes = Math.round((sweepNow - processingStartMs) / 60000)

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

      // ── Send timeout notification email to user ──
      // Non-critical: if the email fails, the audit is still swept correctly.
      try {
        const userId = (audit as any).user_id as string | undefined
        const productUrl = (audit as any).product_url as string | undefined
        const auditType = ((audit as any).audit_type as string) || 'website'

        if (userId) {
          const { data: profile } = await db
            .from('profiles')
            .select('email')
            .eq('id', userId)
            .single()

          const userEmail = (profile as any)?.email as string | undefined
          if (userEmail) {
            await sendAuditTimedOut(
              userEmail,
              auditId,
              productUrl || 'Unknown site',
              ageMinutes,
              !hasReport, // wasRefunded — only refund if no report
              auditType as 'website' | 'brand_identity' | 'design',
            )
            console.log(`[stall-sweeper] Timeout email sent to ${userEmail} for audit ${auditId}`)
          }
        }
      } catch (emailErr) {
        console.error(`[stall-sweeper] Email error for ${auditId} (non-fatal):`, emailErr)
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

    console.log(`[stall-sweeper] Swept ${swept} stalled audits (${skippedQueued} candidates skipped — within processing-time limits)`)
    return { swept, skipped: skippedQueued, audits: allStalled.map((a: any) => a.id) }
}

export const stallSweeperFn = inngest.createFunction(
  {
    id: 'audit-stall-sweeper',
    retries: 1,
    triggers: [{ cron: '*/5 * * * *' }], // Every 5 minutes
  },
  async () => runStallSweep(),
)
