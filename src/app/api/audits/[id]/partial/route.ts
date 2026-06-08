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
  'Design Consistency',
] as const

/**
 * Severity deductions — MUST match analyzer.ts generateReport() exactly.
 * Using different penalties here caused interim scores to be 10-15 points
 * higher than the final report, making the score appear to "drop" on completion.
 *
 * BASE_SCORE = 97 must match analyzer.ts and latest-audit.ts.
 */
const SEVERITY_DEDUCTION: Record<string, number> = {
  critical: 18,
  high: 12,
  medium: 6,
  low: 2,
}
const BASE_SCORE = 97

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
    .is('deleted_at', null)
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
    // Group findings by category (0-27) — same structure as analyzer.ts
    const categoryDeductions = new Array(28).fill(0) as number[]
    const categoryHasFindings = new Array(28).fill(false) as boolean[]
    let anyCategorized = false

    for (const f of findings) {
      if (f.category_index == null) continue
      if (f.category_index < 0 || f.category_index >= 28) continue
      anyCategorized = true
      categoryDeductions[f.category_index] += SEVERITY_DEDUCTION[f.severity] ?? 6
      categoryHasFindings[f.category_index] = true
    }

    if (anyCategorized) {
      interimModuleScores = {}
      const allCatScores: number[] = []

      for (let i = 0; i < PHASE1_MODULES.length; i++) {
        const start = i * 4
        const end = start + 4
        let sum = 0
        let count = 0
        for (let ci = start; ci < end; ci++) {
          if (!categoryHasFindings[ci]) continue
          const score = Math.max(0, Math.min(100, BASE_SCORE - categoryDeductions[ci]))
          sum += score
          count++
          allCatScores.push(score)
        }
        if (count === 0) continue // Don't show modules with no findings yet
        const key = PHASE1_MODULES[i]
        interimModuleScores[key] = Math.round(sum / count)
      }

      if (allCatScores.length > 0) {
        interimOverallScore = Math.round(allCatScores.reduce((s, v) => s + v, 0) / allCatScores.length)
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
