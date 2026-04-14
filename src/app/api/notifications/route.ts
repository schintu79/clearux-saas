// ============================================================
// ClearUX API — /api/notifications
// GET  — list notifications for current user (with read status)
// POST — mark a notification as read
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()

    // Get all active notifications
    const { data: notifications } = await db
      .from('notifications')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(50)

    // Get user's read notifications
    const { data: reads } = await db
      .from('notification_reads')
      .select('notification_id')
      .eq('user_id', user.id)

    const readIds = new Set((reads || []).map((r: any) => r.notification_id))

    const result = (notifications || []).map((n: any) => ({
      ...n,
      is_read: readIds.has(n.id),
    }))

    const unreadCount = result.filter((n: any) => !n.is_read).length

    return NextResponse.json({ notifications: result, unreadCount })
  } catch (err) {
    console.error('GET /api/notifications error:', err)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { notification_id } = await request.json()
    if (!notification_id) return NextResponse.json({ error: 'notification_id required' }, { status: 400 })

    const db = createServiceSupabase()
    await db.from('notification_reads').upsert({
      notification_id,
      user_id: user.id,
      read_at: new Date().toISOString(),
    } as any, { onConflict: 'notification_id,user_id' })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/notifications error:', err)
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 })
  }
}
