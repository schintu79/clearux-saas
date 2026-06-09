import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

// ── Admin-only backfill endpoint ──
// Assigns workspace_id to all audits that have NULL workspace_id
// by matching the audit's product_url domain to a workspace's primary_domain.
//
// GET  = dry run (shows what would be updated)
// POST = execute the backfill

async function runBackfill(dryRun: boolean) {
  const db = createServiceSupabase()

  // 1. Get all audits with NULL workspace_id
  const { data: orphanedAudits } = await db
    .from('audits')
    .select('id, user_id, product_url, status, created_at')
    .is('workspace_id', null)
    .is('deleted_at', null)

  if (!orphanedAudits || orphanedAudits.length === 0) {
    return { message: 'No orphaned audits found', updated: 0, results: [] }
  }

  // 2. Get all active workspaces
  const { data: workspaces } = await db
    .from('workspaces')
    .select('id, user_id, primary_domain, name, slug, status')
    .eq('status', 'active')

  if (!workspaces || workspaces.length === 0) {
    return { message: 'No active workspaces found', updated: 0, results: [] }
  }

  // 3. Match each orphaned audit to a workspace by domain
  const results: Array<{
    auditId: string
    productUrl: string
    auditDomain: string
    matchedWorkspaceName: string | null
    matchedWorkspaceId: string | null
    action: string
  }> = []

  let updatedCount = 0

  for (const audit of orphanedAudits as any[]) {
    let auditDomain = ''
    try {
      const url = audit.product_url.startsWith('http')
        ? audit.product_url
        : `https://${audit.product_url}`
      auditDomain = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      auditDomain = audit.product_url || ''
    }

    // Find workspace: same user, domain match
    const matchedWs = (workspaces as any[]).find(w => {
      if (w.user_id !== audit.user_id) return false
      if (!w.primary_domain) return false
      const wsDomain = w.primary_domain
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '')
      return (
        wsDomain === auditDomain ||
        auditDomain.endsWith(wsDomain) ||
        wsDomain.endsWith(auditDomain)
      )
    })

    if (matchedWs) {
      if (!dryRun) {
        const { error } = await db
          .from('audits')
          .update({ workspace_id: matchedWs.id, updated_at: new Date().toISOString() } as any)
          .eq('id', audit.id)

        if (error) {
          results.push({
            auditId: audit.id,
            productUrl: audit.product_url,
            auditDomain,
            matchedWorkspaceName: matchedWs.name,
            matchedWorkspaceId: matchedWs.id,
            action: `ERROR: ${error.message}`,
          })
          continue
        }
      }

      updatedCount++
      results.push({
        auditId: audit.id,
        productUrl: audit.product_url,
        auditDomain,
        matchedWorkspaceName: matchedWs.name,
        matchedWorkspaceId: matchedWs.id,
        action: dryRun ? 'WOULD UPDATE' : 'UPDATED',
      })
    } else {
      results.push({
        auditId: audit.id,
        productUrl: audit.product_url,
        auditDomain,
        matchedWorkspaceName: null,
        matchedWorkspaceId: null,
        action: 'NO MATCH — no workspace found for this domain',
      })
    }
  }

  // 4. Also backfill audit_findings for any audits we just updated
  if (!dryRun && updatedCount > 0) {
    // For each matched audit, also update its findings to have the workspace_id
    // This ensures the findings are also properly scoped
    for (const r of results) {
      if (r.action === 'UPDATED' && r.matchedWorkspaceId) {
        await db
          .from('audit_findings')
          .update({ workspace_id: r.matchedWorkspaceId } as any)
          .eq('audit_id', r.auditId)
      }
    }
  }

  return {
    message: dryRun
      ? `Dry run complete. ${updatedCount} audits would be updated.`
      : `Backfill complete. ${updatedCount} audits updated.`,
    totalOrphaned: orphanedAudits.length,
    matched: updatedCount,
    unmatched: orphanedAudits.length - updatedCount,
    results,
  }
}

// GET = dry run
export async function GET() {
  const result = await runBackfill(true)
  return NextResponse.json(result)
}

// POST = execute
export async function POST() {
  const result = await runBackfill(false)
  return NextResponse.json(result)
}
