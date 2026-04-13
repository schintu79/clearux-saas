// ============================================================
// ClearUX Admin API — /api/admin/audits
// GET → List all audits with user info, filter by user/status
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error
    const { db } = auth

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id') || ''
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = (page - 1) * limit

    let query = db
      .from('audits')
      .select(`
        id, user_id, status, product_url, product_type, plan, pages_crawled,
        created_at, completed_at,
        reports ( overall_score, total_issues, critical_count )
      `, { count: 'exact' })

    if (userId) query = query.eq('user_id', userId)
    if (status) query = query.eq('status', status)
    if (search) query = query.ilike('product_url', `%${search}%`)

    const { data: audits, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Admin audits list error:', error)
      return NextResponse.json({ error: 'Failed to fetch audits' }, { status: 500 })
    }

    // Enrich with user email (batch lookup)
    const userIds = [...new Set((audits || []).map((a: any) => a.user_id))]
    let userMap: Record<string, string> = {}
    if (userIds.length > 0) {
      const { data: users } = await db
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds)
      for (const u of users || []) {
        userMap[(u as any).id] = (u as any).full_name || (u as any).email
      }
    }

    const enriched = (audits || []).map((a: any) => ({
      ...a,
      user_display: userMap[a.user_id] || a.user_id,
    }))

    return NextResponse.json({
      audits: enriched,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch (err) {
    console.error('GET /api/admin/audits error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
