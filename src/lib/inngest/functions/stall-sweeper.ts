// ============================================================
// Fixpath — Stall Sweeper (Inngest Cron)
// Runs every 5 minutes. Finds audits stuck in non-terminal
// states for >10 minutes and forces them to completion or failure.
// This is the last line of defense — catches cases where both
// the in-process `finally` block and `onFailure` handler failed.
// ============================================================

import { inngest } from '../client'
import { createServiceSupabase } from '@/lib/supabase-server'
import { logActivity } from '@/lib/audit-engine/activity-logger'

const STALL_THRESHOLD_MINUTES = 10

export const stallSweeperFn = inngest.createFunction(
  {
    id: 'audit-stall-sweeper',
    retries: 1,
    triggers: [{ cron: '*/5 * * * *' }], // Every 5 minutes
  },
  async () => {
    const db = createServiceSupabase()

    // Find audits stuck in ACTIVE processing states for longer than threshold.
    // IMPORTANT: Only sweep audits that have actually started processing.
    // `pending_payment` and `payment_received` are valid pre-processing states
    // where the audit is queued behind the Inngest concurrency limit (3).
    // Sweeping these causes false failures on audits that haven't started yet.
    const cutoff = new Date(Date.now() - STALL_THRESHOLD_MINUTES * 60 * 1000).toISOString()

    const { data: stalledAudits, error } = await db
      .from('audits')
      .select('id, status, progress_percent, updated_at')
      .in('status', ['crawling', 'analysing', 'generating_report'])
      .lt('updated_at', cutoff)
      .limit(20) // Process max 20 per sweep to avoid timeouts

    if (error) {
      console.error('[stall-sweeper] Query error:', error.message)
      return { swept: 0, error: error.message }
    }

    if (!stalledAudits || stalledAudits.length === 0) {
      return { swept: 0 }
    }

    let swept = 0

    for (const audit of stalledAudits) {
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
          audit_stage: hasReport ? 'complete' : 'failed',
          completed_at: hasReport ? new Date().toISOString() : undefined,
          crawl_error: hasReport ? undefined : 'Audit timed out. Your partial results may still be available.',
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', auditId)

      if (updateError) {
        console.error(`[stall-sweeper] Failed to update ${auditId}:`, updateError.message)
        continue
      }

      try {
        await logActivity(auditId, hasReport
          ? 'Audit completed by stall recovery. Some enrichment steps were skipped.'
          : 'Audit terminated by stall recovery after prolonged inactivity.')
      } catch {
        // Activity log is non-critical
      }

      swept++
    }

    console.log(`[stall-sweeper] Swept ${swept} stalled audits`)
    return { swept, audits: stalledAudits.map((a: any) => a.id) }
  },
)
