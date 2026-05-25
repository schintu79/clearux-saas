import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

/**
 * GET /api/audits/[id]/partial
 *
 * Returns whatever audit data is available so far — speed data, findings count,
 * overall score, category scores, etc. Used by the progressive-loading overlay
 * to populate cards as data arrives during audit processing.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: auditId } = await params

  const userSupabase = await createServerSupabase()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceSupabase()

  // Verify ownership + fetch audit data
  const { data: audit, error } = await db
    .from('audits')
    .select(`
      id, user_id, status, product_url, speed_data,
      pages_crawled, audit_stage, progress_percent
    `)
    .eq('id', auditId)
    .single()

  if (error || !audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }
  if ((audit as any).user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const a = audit as any

  // Fetch report if available
  const { data: report } = await db
    .from('reports')
    .select('overall_score, total_issues, module_scores')
    .eq('audit_id', auditId)
    .single()

  // Count findings
  const { count: findingsCount } = await db
    .from('audit_findings')
    .select('id', { count: 'exact', head: true })
    .eq('audit_id', auditId)

  // Get severity breakdown
  const { data: severityData } = await db
    .from('audit_findings')
    .select('severity')
    .eq('audit_id', auditId)

  const severityBreakdown = { critical: 0, major: 0, moderate: 0, minor: 0 }
  if (severityData) {
    for (const f of severityData) {
      const s = (f as any).severity as string
      if (s in severityBreakdown) severityBreakdown[s as keyof typeof severityBreakdown]++
    }
  }

  return NextResponse.json({
    speedData: a.speed_data || null,
    overallScore: (report as any)?.overall_score ?? null,
    moduleScores: (report as any)?.module_scores ?? null,
    totalIssues: (report as any)?.total_issues ?? findingsCount ?? 0,
    findingsCount: findingsCount ?? 0,
    severityBreakdown,
    pagesCrawled: a.pages_crawled ?? 0,
  })
}
