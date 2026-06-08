// ============================================================
// ClearUX Admin API — /api/admin/stats
// GET → Dashboard stats (totals, recent activity)
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'

export async function GET() {
  try {
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error
    const { db } = auth

    // Run queries in parallel — exclude soft-deleted audits from all counts
    const [usersRes, auditsRes, creditsRes, recentUsersRes, recentAuditsRes] = await Promise.all([
      db.from('profiles').select('id', { count: 'exact', head: true }),
      db.from('audits').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      db.from('profiles').select('credits'),
      db.from('profiles').select('id, email, full_name, created_at, credits, role').order('created_at', { ascending: false }).limit(5),
      db.from('audits').select('id, product_url, status, created_at, user_id').is('deleted_at', null).order('created_at', { ascending: false }).limit(5),
    ])

    const totalCredits = (creditsRes.data || []).reduce((sum: number, p: any) => sum + (p.credits || 0), 0)

    // Count audits by status — exclude soft-deleted
    const statusRes = await db.from('audits').select('status').is('deleted_at', null)
    const statusCounts: Record<string, number> = {}
    for (const a of statusRes.data || []) {
      statusCounts[a.status] = (statusCounts[a.status] || 0) + 1
    }

    return NextResponse.json({
      totalUsers: usersRes.count || 0,
      totalAudits: auditsRes.count || 0,
      totalCreditsInCirculation: totalCredits,
      auditsByStatus: statusCounts,
      recentUsers: recentUsersRes.data || [],
      recentAudits: recentAuditsRes.data || [],
    })
  } catch (err) {
    console.error('GET /api/admin/stats error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
