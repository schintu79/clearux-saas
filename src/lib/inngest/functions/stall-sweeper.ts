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

    // Find audits stuck in non-terminal states for longer than threshold
    const cutoff = new Date(Date.now() - STALL_THRESHOLD_MINUTES * 60 * 1000).toISOString()

    const { data: stalledAudits, error } = await db
      .from('audits')
      .select('id, status, progress_percent, updated_at')
      .not('status', 'in', '("completed","failed","completed_with_warnings","stalled")')
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

      // If progress >= 82% the report has been generated — mark completed_with_warnings
      // Otherwise mark as failed and the user sees an error state
      const hasReport = progress >= 82
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
