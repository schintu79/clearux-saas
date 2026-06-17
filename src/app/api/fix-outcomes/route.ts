// ============================================================
// Fixpath API — /api/fix-outcomes (Phase 3)
// The "we proved it" feed: verified fix outcomes for the workspace. RLS on
// fix_outcomes (auth.uid() = user_id) scopes every row to the owner, so no
// manual user filtering is needed.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = request.nextUrl.searchParams.get('workspace_id')

    let q = supabase
      .from('fix_outcomes')
      .select('id, finding_id, page_url, detection_source, outcome, severity_before, evidence_before, evidence_after, time_to_fix_seconds, verified_at')
      .order('verified_at', { ascending: false })
      .limit(200)
    if (workspaceId) q = q.eq('workspace_id', workspaceId)

    const { data, error } = await q
    if (error) {
      console.error('[api/fix-outcomes] GET failed:', error.message)
      return NextResponse.json({ error: 'Failed to load fix outcomes' }, { status: 500 })
    }
    const outcomes = (data || []) as Array<Record<string, any>>

    // Attach finding titles in one RLS-scoped follow-up (avoids a fragile embed).
    const ids = [...new Set(outcomes.map((o) => o.finding_id).filter(Boolean))]
    const titleById = new Map<string, string>()
    if (ids.length > 0) {
      const { data: findings } = await supabase.from('audit_findings').select('id, title').in('id', ids)
      for (const f of (findings || []) as Array<any>) titleById.set(f.id, f.title)
    }
    const rows: Array<Record<string, any>> = outcomes.map((o) => ({ ...o, title: titleById.get(o.finding_id) || null }))

    // Headline stats over the "verified_fixed" rows only.
    const verified = rows.filter((r) => r.outcome === 'verified_fixed')
    const times = verified.map((r) => r.time_to_fix_seconds).filter((n): n is number => typeof n === 'number')
    const medianDays = times.length
      ? Math.round((median(times) / 86400) * 10) / 10
      : null

    return NextResponse.json({
      outcomes: rows,
      summary: {
        verified_fixed: verified.length,
        not_fixed: rows.filter((r) => r.outcome === 'not_fixed').length,
        median_time_to_fix_days: medianDays,
      },
    })
  } catch (err) {
    console.error('[api/fix-outcomes] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
