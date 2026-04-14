// ============================================================
// ClearUX API — GET /api/dashboard/stats
// Returns aggregate stats for the dashboard header
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()

    // Run all queries in parallel
    const [
      totalAuditsRes,
      completedAuditsRes,
      avgScoreRes,
      findingsRes,
      fixedFindingsRes,
      recentScoresRes,
    ] = await Promise.all([
      // Total audits
      db.from('audits').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      // Completed audits
      db.from('audits').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'completed'),
      // Average score from reports
      db.from('reports').select('overall_score').eq('user_id', user.id).not('overall_score', 'is', null),
      // Total findings
      db.from('audit_findings')
        .select('id, severity, status', { count: 'exact' })
        .in('audit_id', (await db.from('audits').select('id').eq('user_id', user.id)).data?.map((a: any) => a.id) || []),
      // Fixed findings
      db.from('audit_findings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'fixed')
        .in('audit_id', (await db.from('audits').select('id').eq('user_id', user.id)).data?.map((a: any) => a.id) || []),
      // Recent scores for trend (last 5 completed audits)
      db.from('audits')
        .select('id, product_url, completed_at')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(5),
    ])

    // Calculate average score
    const scores = (avgScoreRes.data || []).map((r: any) => r.overall_score).filter(Boolean)
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null

    // Severity breakdown
    const allFindings = (findingsRes.data || []) as any[]
    const severityBreakdown = {
      critical: allFindings.filter((f: any) => f.severity === 'critical').length,
      high: allFindings.filter((f: any) => f.severity === 'high').length,
      medium: allFindings.filter((f: any) => f.severity === 'medium').length,
      low: allFindings.filter((f: any) => f.severity === 'low').length,
    }

    // Get scores for recent audits
    const recentAuditIds = (recentScoresRes.data || []).map((a: any) => a.id)
    let recentScores: Array<{ url: string; score: number; date: string }> = []
    if (recentAuditIds.length > 0) {
      const { data: recentReports } = await db
        .from('reports')
        .select('audit_id, overall_score')
        .in('audit_id', recentAuditIds)

      recentScores = (recentScoresRes.data || [])
        .map((a: any) => {
          const report = (recentReports || []).find((r: any) => r.audit_id === a.id)
          return report ? {
            url: a.product_url as string,
            score: (report as any).overall_score as number,
            date: a.completed_at as string,
          } : null
        })
        .filter((x): x is { url: string; score: number; date: string } => x !== null)
        .reverse() // oldest first for chart
    }

    return NextResponse.json({
      totalAudits: totalAuditsRes.count ?? 0,
      completedAudits: completedAuditsRes.count ?? 0,
      avgScore,
      totalFindings: allFindings.length,
      fixedFindings: fixedFindingsRes.count ?? 0,
      severityBreakdown,
      recentScores,
    })
  } catch (err) {
    console.error('GET /api/dashboard/stats error:', err)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
