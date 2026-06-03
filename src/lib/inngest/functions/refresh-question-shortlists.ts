// ============================================================
// Fixpath — Refresh AI Question Shortlists (Inngest Cron)
// Runs every Monday at 3am UTC. Regenerates workspace question
// shortlists that are expired or about to expire within 24h.
// Processes max 50 workspaces per run to stay within timeout.
// ============================================================

import { inngest } from '../client'
import { createServiceSupabase } from '@/lib/supabase-server'
import { generateShortlist, getWorkspaceContext } from '@/lib/ai/shortlist-generator'

const MAX_WORKSPACES_PER_RUN = 50
const EXPIRY_BUFFER_MS = 24 * 60 * 60 * 1000 // 24 hours

export const refreshQuestionShortlistsFn = inngest.createFunction(
  {
    id: 'fixpath/refresh-ai-shortlists',
    retries: 1,
    triggers: [{ cron: '0 3 * * 1' }], // Every Monday at 3am UTC
  },
  async () => {
    const db = createServiceSupabase()
    const now = new Date()
    const bufferCutoff = new Date(now.getTime() + EXPIRY_BUFFER_MS).toISOString()

    // ── Step 1: Fetch workspace IDs that have at least one completed audit ──
    const { data: auditRows } = await db
      .from('audits')
      .select('workspace_id')
      .eq('status', 'completed')

    const eligibleIds = [...new Set((auditRows || []).map((r: any) => r.workspace_id).filter(Boolean))]

    if (eligibleIds.length === 0) {
      console.log('[refresh-shortlists] No workspaces with completed audits')
      return { refreshed: 0, skipped: 0, errors: 0 }
    }

    const { data: workspaces, error: fetchError } = await db
      .from('workspaces')
      .select('id, name, shortlist_expires_at')
      .eq('status', 'active')
      .in('id', eligibleIds)
      .limit(MAX_WORKSPACES_PER_RUN)

    if (fetchError) {
      console.error('[refresh-shortlists] Failed to fetch workspaces:', fetchError.message)
      return { refreshed: 0, skipped: 0, errors: 1, error: fetchError.message }
    }

    if (!workspaces || workspaces.length === 0) {
      console.log('[refresh-shortlists] No eligible workspaces found')
      return { refreshed: 0, skipped: 0, errors: 0 }
    }

    let refreshed = 0
    let skipped = 0
    const errors: Array<{ workspaceId: string; error: string }> = []

    // ── Step 2: Process each workspace ──
    for (const workspace of workspaces) {
      const workspaceId = (workspace as any).id as string
      const workspaceName = (workspace as any).name as string
      const expiresAt = (workspace as any).shortlist_expires_at as string | null

      try {
        // Check if shortlist is expired or will expire within 24 hours
        const isExpired = !expiresAt || new Date(expiresAt).toISOString() <= bufferCutoff

        if (!isExpired) {
          skipped++
          continue
        }

        // Regenerate shortlist
        const context = await getWorkspaceContext(workspaceId, db)
        const shortlist = await generateShortlist(context, db)

        // Store the new shortlist
        const newExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        await db
          .from('workspaces')
          .update({
            question_shortlist: shortlist,
            shortlist_expires_at: newExpiresAt,
            shortlist_refreshed_at: now.toISOString(),
            updated_at: now.toISOString(),
          } as any)
          .eq('id', workspaceId)

        refreshed++
        console.log(`[refresh-shortlists] Refreshed shortlist for workspace "${workspaceName}" (${workspaceId})`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[refresh-shortlists] Failed for workspace ${workspaceId}:`, message)
        errors.push({ workspaceId, error: message })
        // Continue processing other workspaces
      }
    }

    // ── Summary ──
    console.log(
      `[refresh-shortlists] Done: ${refreshed} refreshed, ${skipped} skipped, ${errors.length} errors ` +
      `(out of ${workspaces.length} eligible workspaces)`
    )

    return {
      refreshed,
      skipped,
      errors: errors.length,
      errorDetails: errors.length > 0 ? errors : undefined,
      totalEligible: workspaces.length,
    }
  },
)
