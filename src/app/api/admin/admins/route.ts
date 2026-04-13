// ============================================================
// ClearUX Admin API — /api/admin/admins
// GET  → List all admins
// POST → Promote/demote a user's role (super_admin only)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requireSuperAdmin } from '@/lib/admin'

/* ── GET — list all admins ─────────────────────────────── */
export async function GET() {
  try {
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error
    const { db } = auth

    const { data, error } = await db
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .in('role', ['admin', 'super_admin'])
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 })
    }

    return NextResponse.json({ admins: data || [] })
  } catch (err) {
    console.error('GET /api/admin/admins error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/* ── POST — promote/demote role (super_admin only) ──── */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin()
    if ('error' in auth && auth.error) return auth.error
    const { db, user: adminUser } = auth

    const { user_id, role } = await request.json() as {
      user_id: string
      role: 'user' | 'admin' | 'super_admin'
    }

    if (!user_id || !['user', 'admin', 'super_admin'].includes(role)) {
      return NextResponse.json({ error: 'Valid user_id and role required' }, { status: 400 })
    }

    // Prevent demoting yourself
    if (user_id === adminUser.id && role !== 'super_admin') {
      return NextResponse.json({ error: 'Cannot demote yourself' }, { status: 400 })
    }

    const { error } = await db
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() } as any)
      .eq('id', user_id)

    if (error) {
      console.error('Admin role update error:', error)
      return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
    }

    // Log it
    await db.from('audit_logs').insert({
      audit_id: '00000000-0000-0000-0000-000000000000',
      event: 'admin_role_change',
      status: 'info',
      message: `Admin ${adminUser.email} changed role of ${user_id} to ${role}`,
      metadata: { admin_id: adminUser.id, target_user_id: user_id, new_role: role },
    } as any)

    return NextResponse.json({ success: true, role })
  } catch (err) {
    console.error('POST /api/admin/admins error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
