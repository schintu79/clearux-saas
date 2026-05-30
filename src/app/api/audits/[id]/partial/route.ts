import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

/**
 * GET /api/audits/[id]/partial
 *
 * Returns whatever audit data is available so far — speed data, findings count,
 * overall score, category scores, etc. Used by the progressive-loading overlay
 * to populate cards as data arrives during audit processing.
 *
 * When the full report doesn't exist yet, computes interim module scores from
 * findings' category_index and severity so overview cards populate progressively
 * instead of staying as skeletons until report generation (85% progress).
 */

const PHASE1_MODULES = [
  'Foundation',
  'Human Experience',
  'Inclusive Design',
  'Future Readiness',
  'SEO Structure & Rules',
  'Accessibility Readiness',
  'Brand Consistency',
] as const

const SEVERITY_PENALTY: Record<string, number> = {
  critical: 8,
  high: 5,
  medium: 3,
  low: 1.5,
}

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

  // Fetch findings with severity and category_index for both count and interim scoring
  const { data: findingsData } = await db
    .from('audit_findings')
    .select('severity, category_index')
    .eq('audit_id', auditId)

  const findings = (findingsData || []) as Array<{ severity: string; category_index: number | null }>
  const findingsCount = findings.length

  // Severity breakdown — DB uses critical/high/medium/low, UI expects critical/major/moderate/minor
  const severityBreakdown = { critical: 0, major: 0, moderate: 0, minor: 0 }
  for (const f of findings) {
    const s = f.severity as string
    if (s === 'critical') severityBreakdown.critical++
    else if (s === 'high') severityBreakdown.major++
    else if (s === 'medium') severityBreakdown.moderate++
    else if (s === 'low') severityBreakdown.minor++
  }

  // If report exists, use its scores directly
  if (report) {
    return NextResponse.json({
      speedData: a.speed_data || null,
      overallScore: (report as any)?.overall_score ?? null,
      moduleScores: (report as any)?.module_scores ?? null,
      totalIssues: (report as any)?.total_issues ?? findingsCount,
      findingsCount,
      severityBreakdown,
      pagesCrawled: a.pages_crawled ?? 0,
      stage: a.audit_stage || null,
    })
  }

  // No report yet — compute interim module scores from findings' category_index
  // This lets cards populate as analysis batches complete (30-65% progress)
  let interimModuleScores: Record<string, number> | null = null
  let interimOverallScore: number | null = null

  if (findingsCount > 0) {
    const loadByModule = new Array(PHASE1_MODULES.length).fill(0) as number[]
    const countByModule = new Array(PHASE1_MODULES.length).fill(0) as number[]
    let anyCategorized = false

    for (const f of findings) {
      if (f.category_index == null) continue
      anyCategorized = true
      const moduleIdx = Math.max(0, Math.min(PHASE1_MODULES.length - 1, Math.floor(f.category_index / 4)))
      loadByModule[moduleIdx] += SEVERITY_PENALTY[f.severity] ?? 3
      countByModule[moduleIdx] += 1
    }

    if (anyCategorized) {
      interimModuleScores = {}
      let scoreSum = 0
      let scoreCount = 0

      for (let i = 0; i < PHASE1_MODULES.length; i++) {
        if (countByModule[i] === 0) continue // Don't show modules with no findings yet
        const raw = 100 - loadByModule[i]
        const clamped = Math.max(0, Math.min(100, raw))
        const score = Math.round(clamped)
        const key = PHASE1_MODULES[i]
        interimModuleScores[key] = score
        scoreSum += score
        scoreCount++
      }

      if (scoreCount > 0) {
        interimOverallScore = Math.round(scoreSum / scoreCount)
      }
    }
  }

  return NextResponse.json({
    speedData: a.speed_data || null,
    overallScore: interimOverallScore,
    moduleScores: interimModuleScores,
    totalIssues: findingsCount,
    findingsCount,
    severityBreakdown,
    pagesCrawled: a.pages_crawled ?? 0,
    stage: a.audit_stage || null,
  })
}
