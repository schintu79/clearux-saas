/**
 * Activity Logger — structured audit log entries for the live activity feed.
 *
 * These entries are fetched by /api/audits/[id]/activity and rendered
 * as a chat-like feed in the audit progress UI.
 *
 * Uses the existing audit_logs table. Activity-visible events use
 * specific event names that the API filters for.
 */

import { createServiceSupabase } from '@/lib/supabase-server'

function getDb() {
  return createServiceSupabase()
}

async function log(
  auditId: string,
  event: string,
  status: 'info' | 'success' | 'error' | 'warning',
  message: string,
  metadata?: Record<string, unknown>,
) {
  try {
    const db = getDb()
    const { error } = await db.from('audit_logs').insert({
      audit_id: auditId,
      event,
      status,
      message,
      metadata: metadata ?? {},
    } as any)
    if (error) console.error(`[activity-logger] audit_logs insert failed (${event}): ${error.message}`)
  } catch (err) {
    console.error('[activity-logger] log error:', err)
  }
}

/** Log when the entire pipeline starts */
export async function logPipelineStarted(auditId: string, pipelineVersion: string) {
  await log(auditId, 'pipeline_started', 'info', 'Starting audit...', { pipelineVersion })
}

/** Log when the entire pipeline completes successfully */
export async function logPipelineCompleted(auditId: string, durationMs: number) {
  await log(auditId, 'pipeline_completed', 'success', 'Audit complete!', { durationMs })
}

/** Log when the pipeline fails */
export async function logPipelineFailed(auditId: string, error: string) {
  await log(auditId, 'pipeline_failed', 'error', `Audit failed: ${error}`, { error })
}

/** Log when the pipeline is detected as stalled */
export async function logPipelineStalled(auditId: string, stage: string, reason: string) {
  await log(auditId, 'pipeline_stalled', 'warning', `Pipeline stalled at ${stage}`, { stage, reason })
}

/** Log when a pipeline stage starts */
export async function logStageStarted(auditId: string, stageId: string, label: string) {
  await log(auditId, 'stage_started', 'info', label, { stageId })
}

/** Log when a pipeline stage completes */
export async function logStageCompleted(auditId: string, stageId: string, label: string, metadata?: Record<string, unknown>) {
  await log(auditId, 'stage_completed', 'success', label, { stageId, ...metadata })
}

/** Log when a pipeline stage fails */
export async function logStageFailed(auditId: string, stageId: string, label: string, error: string) {
  await log(auditId, 'stage_failed', 'error', `${label}: ${error}`, { stageId, error })
}

/** Log a granular activity message (visible in the feed) */
export async function logActivity(auditId: string, message: string, metadata?: Record<string, unknown>) {
  await log(auditId, 'activity', 'info', message, metadata)
}
