// ============================================================
// ClearUX Admin API — /api/admin/notifications
// GET    — list all notifications (admin only)
// POST   — create a notification
// PATCH  — update a notification (toggle active, edit)
// DELETE — delete a notification
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

async function requireAdmin(request: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const db = createServiceSupabase()
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes((profile as any).role)) return null
  return user
}

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceSupabase()
  const { data } = await db
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })

  return NextResponse.json({ notifications: data || [] })
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, message, icon, color, show_in_overview } = await request.json()
  if (!title || !message) return NextResponse.json({ error: 'title and message required' }, { status: 400 })

  const db = createServiceSupabase()

  // If show_in_overview, unpin any existing overview notification first
  if (show_in_overview) {
    await db.from('notifications').update({ show_in_overview: false, updated_at: new Date().toISOString() } as any).eq('show_in_overview', true)
  }

  const { data, error } = await db
    .from('notifications')
    .insert({
      title,
      message,
      icon: icon || 'info',
      color: color || 'blue',
      show_in_overview: show_in_overview || false,
      is_active: true,
      created_by: user.id,
    } as any)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notification: data })
}

export async function PATCH(request: NextRequest) {
  const user = await requireAdmin(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const db = createServiceSupabase()

  // If pinning to overview, unpin others first
  if (updates.show_in_overview) {
    await db.from('notifications').update({ show_in_overview: false, updated_at: new Date().toISOString() } as any).eq('show_in_overview', true)
  }

  const { error } = await db
    .from('notifications')
    .update({ ...updates, updated_at: new Date().toISOString() } as any)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const user = await requireAdmin(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const db = createServiceSupabase()
  await db.from('notifications').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
