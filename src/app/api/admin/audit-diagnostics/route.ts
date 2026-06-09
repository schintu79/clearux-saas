import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

// ── Admin-only diagnostic endpoint ──
// Returns summary of audit states, NULL workspace_id counts,
// stuck audits, and recent audit activity.
// GET /api/admin/audit-diagnostics

export async function GET() {
  const db = createServiceSupabase()

  // 1. Count audits by workspace_id status
  const { data: allAudits } = await db
    .from('audits')
    .select('id, workspace_id, status, product_url, created_at, completed_at, audit_type, progress_percent, audit_stage, user_id')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  const audits = (allAudits || []) as any[]

  const nullWorkspaceCount = audits.filter(a => !a.workspace_id).length
  const hasWorkspaceCount = audits.filter(a => a.workspace_id).length

  // 2. Group by status
  const statusCounts: Record<string, number> = {}
  for (const a of audits) {
    const s = a.status || 'unknown'
    statusCounts[s] = (statusCounts[s] || 0) + 1
  }

  // 3. Find stuck audits (non-terminal, older than 10 minutes)
  const terminalStatuses = ['completed', 'failed', 'completed_with_warnings', 'stalled']
  const stuckAudits = audits.filter(a => {
    if (terminalStatuses.includes(a.status)) return false
    const age = Date.now() - new Date(a.created_at).getTime()
    return age > 10 * 60 * 1000 // older than 10 min
  })

  // 4. Get workspaces for mapping context
  const { data: workspaces } = await db
    .from('workspaces')
    .select('id, name, slug, primary_domain, user_id, status')
    .eq('status', 'active')
    .is('deleted_at', null)

  // 5. For orphaned audits (NULL workspace_id), try to match to workspaces
  const orphanedAudits = audits.filter(a => !a.workspace_id)
  const matchableOrphans: Array<{
    auditId: string
    productUrl: string
    status: string
    auditDomain: string
    matchedWorkspace: string | null
    matchedWorkspaceId: string | null
  }> = []

  for (const a of orphanedAudits) {
    let auditDomain = ''
    try {
      auditDomain = new URL(a.product_url.startsWith('http') ? a.product_url : `https://${a.product_url}`).hostname.replace(/^www\./, '')
    } catch { auditDomain = a.product_url }

    const matchedWs = (workspaces || []).find((w: any) => {
      if (w.user_id !== a.user_id) return false
      if (!w.primary_domain) return false
      const wsDomain = w.primary_domain.replace(/^www\./, '').replace(/^https?:\/\//, '')
      return wsDomain === auditDomain || auditDomain.includes(wsDomain) || wsDomain.includes(auditDomain)
    })

    matchableOrphans.push({
      auditId: a.id,
      productUrl: a.product_url,
      status: a.status,
      auditDomain,
      matchedWorkspace: matchedWs ? `${matchedWs.name} (${matchedWs.slug})` : null,
      matchedWorkspaceId: matchedWs?.id || null,
    })
  }

  // 6. Recent 10 audits with full detail
  const recent = audits.slice(0, 10).map(a => ({
    id: a.id,
    url: a.product_url,
    type: a.audit_type,
    status: a.status,
    progress: a.progress_percent,
    stage: a.audit_stage,
    workspaceId: a.workspace_id || 'NULL',
    created: a.created_at,
    completed: a.completed_at || 'NULL',
  }))

  return NextResponse.json({
    summary: {
      totalAudits: audits.length,
      nullWorkspaceId: nullWorkspaceCount,
      hasWorkspaceId: hasWorkspaceCount,
      statusCounts,
      stuckCount: stuckAudits.length,
      workspaceCount: (workspaces || []).length,
    },
    matchableOrphans,
    stuckAudits: stuckAudits.map(a => ({
      id: a.id,
      url: a.product_url,
      status: a.status,
      progress: a.progress_percent,
      stage: a.audit_stage,
      created: a.created_at,
    })),
    recentAudits: recent,
  })
}
