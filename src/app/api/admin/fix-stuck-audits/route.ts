import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

// ── Admin-only: Force-fix stuck and orphaned audits ──
//
// POST /api/admin/fix-stuck-audits
//
// Actions:
// 1. Force-fail any audit stuck in non-terminal status for >15 min
// 2. Assign workspace_id to brand_identity audits that have NULL workspace_id
//    by matching user_id to the user's workspaces

export async function POST() {
  const db = createServiceSupabase()
  const results: string[] = []

  // ── 1. Force-fail stuck audits ──
  const terminalStatuses = ['completed', 'failed', 'completed_with_warnings', 'stalled']
  const { data: allAudits } = await db
    .from('audits')
    .select('id, status, product_url, created_at, progress_percent, audit_stage')
    .is('deleted_at', null)

  const stuck = (allAudits || []).filter((a: any) => {
    if (terminalStatuses.includes(a.status)) return false
    const age = Date.now() - new Date(a.created_at).getTime()
    return age > 15 * 60 * 1000
  })

  for (const a of stuck as any[]) {
    const { error } = await db
      .from('audits')
      .update({
        status: 'failed',
        audit_stage: 'failed',
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', a.id)

    if (error) {
      results.push(`STUCK ${a.id} (${a.product_url}): ERROR — ${error.message}`)
    } else {
      results.push(`STUCK ${a.id} (${a.product_url}): force-failed (was ${a.status} at ${a.progress_percent}%)`)
    }
  }

  // ── 2. Fix orphaned brand audits ──
  const { data: orphaned } = await db
    .from('audits')
    .select('id, user_id, audit_type, product_url')
    .is('workspace_id', null)
    .is('deleted_at', null)

  if (orphaned && orphaned.length > 0) {
    for (const audit of orphaned as any[]) {
      // For brand audits with no URL, find the user's first active workspace
      const { data: userWorkspaces } = await db
        .from('workspaces')
        .select('id, name, slug, status, deleted_at')
        .eq('user_id', audit.user_id)
        .order('created_at', { ascending: true })
        .limit(5)

      // Try active first, then any non-deleted
      const ws = (userWorkspaces || []).find((w: any) => w.status === 'active' && !w.deleted_at)
        || (userWorkspaces || []).find((w: any) => !w.deleted_at)
        || (userWorkspaces || [])[0]

      if (ws) {
        const { error } = await db
          .from('audits')
          .update({ workspace_id: (ws as any).id, updated_at: new Date().toISOString() } as any)
          .eq('id', audit.id)

        if (error) {
          results.push(`ORPHAN ${audit.id} (${audit.audit_type}): ERROR — ${error.message}`)
        } else {
          results.push(`ORPHAN ${audit.id} (${audit.audit_type}): assigned to workspace "${(ws as any).name}" (${(ws as any).id}, status: ${(ws as any).status})`)
        }
      } else {
        results.push(`ORPHAN ${audit.id} (${audit.audit_type}): NO WORKSPACE FOUND for user ${audit.user_id}`)

        // Dump all workspaces for this user to help debug
        const { data: allUserWs } = await db
          .from('workspaces')
          .select('id, name, status, deleted_at')
          .eq('user_id', audit.user_id)

        results.push(`  → User's workspaces: ${JSON.stringify(allUserWs)}`)
      }
    }
  }

  return NextResponse.json({
    message: `Fixed ${stuck.length} stuck audit(s) and processed ${(orphaned || []).length} orphaned audit(s)`,
    results,
  })
}

// GET = dry run (just show what would happen)
export async function GET() {
  const db = createServiceSupabase()
  const results: string[] = []

  const terminalStatuses = ['completed', 'failed', 'completed_with_warnings', 'stalled']
  const { data: allAudits } = await db
    .from('audits')
    .select('id, status, product_url, created_at, progress_percent, audit_stage')
    .is('deleted_at', null)

  const stuck = (allAudits || []).filter((a: any) => {
    if (terminalStatuses.includes(a.status)) return false
    const age = Date.now() - new Date(a.created_at).getTime()
    return age > 15 * 60 * 1000
  })

  for (const a of stuck as any[]) {
    results.push(`WOULD FORCE-FAIL: ${a.id} (${a.product_url}) — status: ${a.status}, progress: ${a.progress_percent}%, age: ${Math.round((Date.now() - new Date(a.created_at).getTime()) / 60000)}min`)
  }

  const { data: orphaned } = await db
    .from('audits')
    .select('id, user_id, audit_type, product_url')
    .is('workspace_id', null)
    .is('deleted_at', null)

  for (const audit of (orphaned || []) as any[]) {
    const { data: userWorkspaces } = await db
      .from('workspaces')
      .select('id, name, slug, status, deleted_at')
      .eq('user_id', audit.user_id)
      .order('created_at', { ascending: true })
      .limit(5)

    const ws = (userWorkspaces || []).find((w: any) => w.status === 'active' && !w.deleted_at)
      || (userWorkspaces || []).find((w: any) => !w.deleted_at)
      || (userWorkspaces || [])[0]

    if (ws) {
      results.push(`WOULD ASSIGN: ${audit.id} (${audit.audit_type}) → workspace "${(ws as any).name}" (${(ws as any).id}, status: ${(ws as any).status})`)
    } else {
      results.push(`CANNOT ASSIGN: ${audit.id} (${audit.audit_type}) — no workspace for user ${audit.user_id}`)
      const { data: allUserWs } = await db
        .from('workspaces')
        .select('id, name, status, deleted_at')
        .eq('user_id', audit.user_id)
      results.push(`  → User's workspaces: ${JSON.stringify(allUserWs)}`)
    }
  }

  return NextResponse.json({
    message: `Dry run: ${stuck.length} stuck, ${(orphaned || []).length} orphaned`,
    results,
  })
}
