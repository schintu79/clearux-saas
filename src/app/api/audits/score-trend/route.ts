// ============================================================
// ClearUX API — GET /api/audits/score-trend?url=xxx
// Returns score history for a specific URL (all audits of same domain)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { applySeverityCapFromCounts } from '@/lib/scoring/severity-cap'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = request.nextUrl.searchParams.get('url')
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

    // Normalize domain
    let domain: string
    try { domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '') } catch { return NextResponse.json({ error: 'Invalid URL' }, { status: 400 }) }

    const db = createServiceSupabase()

    // Optional workspace scoping
    const workspaceId = request.nextUrl.searchParams.get('workspace_id')

    // Get all completed, non-deleted website audits for this domain by this user
    let auditsQuery = db
      .from('audits')
      .select('id, product_url, status, completed_at, created_at, audit_type, deleted_at')
      .eq('user_id', user.id)
      .in('status', ['completed', 'completed_with_warnings'])
      .is('deleted_at', null)
      .order('completed_at', { ascending: true })

    if (workspaceId) {
      auditsQuery = auditsQuery.eq('workspace_id', workspaceId)
    }

    const { data: audits } = await auditsQuery

    // Filter to matching domain — site audits only (no brand identity audits)
    const domainAudits = (audits || []).filter((a: any) => {
      // Exclude brand identity audits
      const auditType = a.audit_type || (a.brand_identity_id && !a.product_url ? 'brand_identity' : 'website')
      if (auditType === 'brand_identity') return false
      if (!a.product_url) return false
      try {
        return new URL(a.product_url).hostname.replace(/^www\./, '') === domain
      } catch { return false }
    })

    if (domainAudits.length === 0) {
      return NextResponse.json({ domain, trend: [], totalAudits: 0 })
    }

    // Get reports for those audits (include raw_json for category-level recomputation)
    const auditIds = domainAudits.map((a: any) => a.id)
    const { data: reports } = await db
      .from('reports')
      .select('audit_id, overall_score, ux_score, conversion_score, mobile_score, ai_discoverability_score, content_score, total_issues, critical_count, high_count, medium_count, ai_visibility_breakdown, raw_json')
      .in('audit_id', auditIds)

    const reportsMap: Record<string, any> = {}
    for (const r of (reports || [])) reportsMap[(r as any).audit_id] = r

    const trend = domainAudits.map((a: any) => {
      const r = reportsMap[a.id]
      const aiVis = r?.ai_visibility_breakdown as any

      // Recompute overall score from categoryScores, filtering out -1 sentinel
      // values (unanalyzed categories like Design Consistency without Brand DNA in legacy audits).
      // The stored overall_score may include -1 values, dragging the average down.
      let overallScore: number | null = r?.overall_score ?? null
      const rawJson = r?.raw_json as any
      if (rawJson?.categoryScores && Array.isArray(rawJson.categoryScores)) {
        const catScores = rawJson.categoryScores as Array<{ score: number }>
        // Sanitize stale Design Consistency data (indices 24-27): if all four
        // sub-categories scored between 0 and 5, the module predates the -1
        // sentinel fix and should be excluded from the overall average.
        const dcCats = catScores.slice(24, 28)
        const dcStale = dcCats.length === 4 && dcCats.every(c => c.score >= 0 && c.score <= 5)
        const analyzed = catScores.filter((c, idx) => {
          if (c.score < 0) return false
          if (dcStale && idx >= 24 && idx < 28) return false
          return true
        })
        if (analyzed.length > 0) {
          overallScore = Math.round(analyzed.reduce((s, c) => s + c.score, 0) / analyzed.length)
        }
      }

      // Score model v2 (2026-06-11): the recompute above exists only to strip
      // -1 sentinels, but it was OVERWRITING the stored capped score with the
      // raw category mean — the trend showed 89 while the health score showed
      // the true capped 65. Re-apply the severity cap from the report's own
      // severity counts so the trend always matches the verdict.
      if (overallScore != null && r) {
        overallScore = applySeverityCapFromCounts(overallScore, {
          critical: r.critical_count ?? 0,
          high: r.high_count ?? 0,
          medium: r.medium_count ?? 0,
        }).overall
      }

      return {
        auditId: a.id,
        date: a.completed_at || a.created_at,
        overallScore,
        uxScore: r?.ux_score ?? null,
        conversionScore: r?.conversion_score ?? null,
        mobileScore: r?.mobile_score ?? null,
        aiScore: r?.ai_discoverability_score ?? null,
        contentScore: r?.content_score ?? null,
        aiVisibilityScore: aiVis?.overall ?? null,
        totalIssues: r?.total_issues ?? 0,
        criticalCount: r?.critical_count ?? 0,
        highCount: r?.high_count ?? 0,
      }
    }).filter((t: any) => t.overallScore !== null)

    // Improvement = latest score vs previous audit (not vs first ever)
    const improvement = trend.length >= 2
      ? (trend[trend.length - 1].overallScore ?? 0) - (trend[trend.length - 2].overallScore ?? 0)
      : 0

    // Also track total change from baseline
    const totalChange = trend.length >= 2
      ? (trend[trend.length - 1].overallScore ?? 0) - (trend[0].overallScore ?? 0)
      : 0

    // AI visibility improvement
    const aiVisTrend = trend.filter((t: any) => t.aiVisibilityScore !== null)
    const aiVisImprovement = aiVisTrend.length >= 2
      ? aiVisTrend[aiVisTrend.length - 1].aiVisibilityScore - aiVisTrend[aiVisTrend.length - 2].aiVisibilityScore
      : 0

    return NextResponse.json({
      domain,
      totalAudits: trend.length,
      trend,
      improvement,
      totalChange,
      aiVisImprovement,
      latestScore: trend.length > 0 ? trend[trend.length - 1].overallScore : null,
      baselineScore: trend.length > 0 ? trend[0].overallScore : null,
      latestAiVisScore: aiVisTrend.length > 0 ? aiVisTrend[aiVisTrend.length - 1].aiVisibilityScore : null,
    })
  } catch (err) {
    console.error('GET /api/audits/score-trend error:', err)
    return NextResponse.json({ error: 'Failed to fetch score trend' }, { status: 500 })
  }
}
