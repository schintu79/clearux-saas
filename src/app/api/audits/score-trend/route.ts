// ============================================================
// ClearUX API — GET /api/audits/score-trend?url=xxx
// Returns score history for a specific URL (all audits of same domain)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

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
      .eq('status', 'completed')
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
      .select('audit_id, overall_score, ux_score, conversion_score, mobile_score, ai_discoverability_score, content_score, total_issues, critical_count, high_count, ai_visibility_breakdown, raw_json')
      .in('audit_id', auditIds)

    const reportsMap: Record<string, any> = {}
    for (const r of (reports || [])) reportsMap[(r as any).audit_id] = r

    const trend = domainAudits.map((a: any) => {
      const r = reportsMap[a.id]
      const aiVis = r?.ai_visibility_breakdown as any

      // Recompute overall score from categoryScores, filtering out -1 sentinel
      // values (unanalyzed categories like Brand Consistency without Brand DNA).
      // The stored overall_score may include -1 values, dragging the average down.
      let overallScore: number | null = r?.overall_score ?? null
      const rawJson = r?.raw_json as any
      if (rawJson?.categoryScores && Array.isArray(rawJson.categoryScores)) {
        const analyzed = (rawJson.categoryScores as Array<{ score: number }>).filter(c => c.score >= 0)
        if (analyzed.length > 0) {
          overallScore = Math.round(analyzed.reduce((s, c) => s + c.score, 0) / analyzed.length)
        }
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
