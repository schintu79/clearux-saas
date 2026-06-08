// ============================================================
// ClearUX API — POST /api/audits/cleanup
// Admin tool: recalculate scores & bulk soft-delete old audits
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { action, workspace_id } = body as { action: string; workspace_id?: string }

    if (!action) {
      return NextResponse.json({ error: 'action required' }, { status: 400 })
    }

    const db = createServiceSupabase()

    // ─── ACTION: recalculate ─────────────────────────────────────
    // Recomputes overall_score on all reports from raw_json.categoryScores
    // filtering out -1 sentinel values (unanalyzed categories).
    if (action === 'recalculate') {
      let auditsQuery = db
        .from('audits')
        .select('id')
        .eq('user_id', user.id)
        .in('status', ['completed', 'completed_with_warnings'])
        .is('deleted_at', null)

      if (workspace_id) {
        auditsQuery = auditsQuery.eq('workspace_id', workspace_id)
      }

      const { data: audits } = await auditsQuery
      if (!audits || audits.length === 0) {
        return NextResponse.json({ recalculated: 0, message: 'No completed audits found' })
      }

      const auditIds = audits.map((a: any) => a.id)

      // Fetch reports with raw_json
      const { data: reports } = await db
        .from('reports')
        .select('id, audit_id, overall_score, raw_json')
        .in('audit_id', auditIds)

      let recalculated = 0
      const updates: { id: string; newScore: number; oldScore: number }[] = []

      for (const report of (reports || [])) {
        const rawJson = (report as any).raw_json as any
        if (!rawJson?.categoryScores || !Array.isArray(rawJson.categoryScores)) continue

        const analyzed = (rawJson.categoryScores as Array<{ score: number }>).filter(c => c.score >= 0)
        if (analyzed.length === 0) continue

        const correctScore = Math.round(analyzed.reduce((s, c) => s + c.score, 0) / analyzed.length)
        const storedScore = (report as any).overall_score as number | null

        if (storedScore !== correctScore) {
          await db
            .from('reports')
            .update({ overall_score: correctScore })
            .eq('id', (report as any).id)

          updates.push({
            id: (report as any).audit_id,
            oldScore: storedScore ?? 0,
            newScore: correctScore,
          })
          recalculated++
        }
      }

      return NextResponse.json({
        recalculated,
        totalReports: (reports || []).length,
        updates,
        message: recalculated > 0
          ? `Recalculated ${recalculated} report scores`
          : 'All scores are already correct',
      })
    }

    // ─── ACTION: wipe ────────────────────────────────────────────
    // Soft-deletes ALL audits for this user (or workspace).
    // This clears the score history and starts fresh.
    if (action === 'wipe') {
      const now = new Date().toISOString()

      let auditsQuery = db
        .from('audits')
        .update({ deleted_at: now })
        .eq('user_id', user.id)
        .is('deleted_at', null)

      if (workspace_id) {
        auditsQuery = auditsQuery.eq('workspace_id', workspace_id)
      }

      const { data, error } = await auditsQuery.select('id')

      if (error) {
        return NextResponse.json({ error: 'Failed to wipe audits' }, { status: 500 })
      }

      return NextResponse.json({
        wiped: (data || []).length,
        message: `Soft-deleted ${(data || []).length} audits. They will be permanently removed after 30 days.`,
      })
    }

    // ─── ACTION: wipe_old ────────────────────────────────────────
    // Soft-deletes only audits older than a specified number of days.
    if (action === 'wipe_old') {
      const { days_threshold = 90 } = body as { days_threshold?: number }
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - days_threshold)

      let auditsQuery = db
        .from('audits')
        .update({ deleted_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .lt('created_at', cutoff.toISOString())

      if (workspace_id) {
        auditsQuery = auditsQuery.eq('workspace_id', workspace_id)
      }

      const { data, error } = await auditsQuery.select('id')

      if (error) {
        return NextResponse.json({ error: 'Failed to wipe old audits' }, { status: 500 })
      }

      return NextResponse.json({
        wiped: (data || []).length,
        message: `Soft-deleted ${(data || []).length} audits older than ${days_threshold} days.`,
      })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    console.error('POST /api/audits/cleanup error:', err)
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 })
  }
}

// GET endpoint — preview what would be affected
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()
    const workspaceId = request.nextUrl.searchParams.get('workspace_id')

    // Count total audits
    let countQuery = db
      .from('audits')
      .select('id, status, created_at, completed_at', { count: 'exact' })
      .eq('user_id', user.id)
      .is('deleted_at', null)

    if (workspaceId) {
      countQuery = countQuery.eq('workspace_id', workspaceId)
    }

    const { data: allAudits, count } = await countQuery

    // Count audits with potentially incorrect scores
    const completedAudits = (allAudits || []).filter((a: any) => a.status === 'completed')
    const completedIds = completedAudits.map((a: any) => a.id)

    let mismatchCount = 0
    if (completedIds.length > 0) {
      const { data: reports } = await db
        .from('reports')
        .select('id, audit_id, overall_score, raw_json')
        .in('audit_id', completedIds)

      for (const report of (reports || [])) {
        const rawJson = (report as any).raw_json as any
        if (!rawJson?.categoryScores || !Array.isArray(rawJson.categoryScores)) continue

        const analyzed = (rawJson.categoryScores as Array<{ score: number }>).filter(c => c.score >= 0)
        if (analyzed.length === 0) continue

        const correctScore = Math.round(analyzed.reduce((s, c) => s + c.score, 0) / analyzed.length)
        if ((report as any).overall_score !== correctScore) {
          mismatchCount++
        }
      }
    }

    // Count old audits (>90 days)
    const cutoff90 = new Date()
    cutoff90.setDate(cutoff90.getDate() - 90)
    const oldAudits = (allAudits || []).filter((a: any) => new Date(a.created_at) < cutoff90)

    return NextResponse.json({
      totalAudits: count || 0,
      completedAudits: completedAudits.length,
      scoreMismatches: mismatchCount,
      oldAudits: oldAudits.length,
    })
  } catch (err) {
    console.error('GET /api/audits/cleanup error:', err)
    return NextResponse.json({ error: 'Failed to get cleanup stats' }, { status: 500 })
  }
}
