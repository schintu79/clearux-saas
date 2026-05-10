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

    // Get all completed audits for this domain by this user
    const { data: audits } = await db
      .from('audits')
      .select('id, product_url, status, completed_at, created_at')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: true })

    // Filter to matching domain
    const domainAudits = (audits || []).filter((a: any) => {
      try {
        return new URL(a.product_url).hostname.replace(/^www\./, '') === domain
      } catch { return false }
    })

    if (domainAudits.length === 0) {
      return NextResponse.json({ domain, trend: [], totalAudits: 0 })
    }

    // Get reports for those audits
    const auditIds = domainAudits.map((a: any) => a.id)
    const { data: reports } = await db
      .from('reports')
      .select('audit_id, overall_score, ux_score, conversion_score, mobile_score, ai_discoverability_score, content_score, total_issues, critical_count, high_count')
      .in('audit_id', auditIds)

    const reportsMap: Record<string, any> = {}
    for (const r of (reports || [])) reportsMap[(r as any).audit_id] = r

    const trend = domainAudits.map((a: any) => {
      const r = reportsMap[a.id]
      return {
        auditId: a.id,
        date: a.completed_at || a.created_at,
        overallScore: r?.overall_score ?? null,
        uxScore: r?.ux_score ?? null,
        conversionScore: r?.conversion_score ?? null,
        mobileScore: r?.mobile_score ?? null,
        aiScore: r?.ai_discoverability_score ?? null,
        contentScore: r?.content_score ?? null,
        totalIssues: r?.total_issues ?? 0,
        criticalCount: r?.critical_count ?? 0,
        highCount: r?.high_count ?? 0,
      }
    }).filter((t: any) => t.overallScore !== null)

    // Improvement = latest score vs previous audit (not vs first ever)
    const improvement = trend.length >= 2
      ? trend[trend.length - 1].overallScore - trend[trend.length - 2].overallScore
      : 0

    // Also track total change from baseline
    const totalChange = trend.length >= 2
      ? trend[trend.length - 1].overallScore - trend[0].overallScore
      : 0

    return NextResponse.json({
      domain,
      totalAudits: trend.length,
      trend,
      improvement,
      totalChange,
      latestScore: trend.length > 0 ? trend[trend.length - 1].overallScore : null,
      baselineScore: trend.length > 0 ? trend[0].overallScore : null,
    })
  } catch (err) {
    console.error('GET /api/audits/score-trend error:', err)
    return NextResponse.json({ error: 'Failed to fetch score trend' }, { status: 500 })
  }
}
