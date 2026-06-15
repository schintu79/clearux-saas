// ============================================================
// Fixpath API — /api/alerts (Phase 2 #2)
// Per-user monitoring regression alerts. RLS on audit_alerts scopes every
// query to the authenticated owner, so no manual user_id filtering is needed.
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
      .from('audit_alerts')
      .select('id, type, level, title, body, meta, product_url, audit_id, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    if (workspaceId) q = q.eq('workspace_id', workspaceId)

    const { data, error } = await q
    if (error) {
      console.error('[api/alerts] GET failed:', error.message)
      return NextResponse.json({ error: 'Failed to load alerts' }, { status: 500 })
    }
    const alerts = data || []
    const unreadCount = alerts.filter((a: any) => !a.read_at).length
    return NextResponse.json({ alerts, unreadCount })
  } catch (err) {
    console.error('[api/alerts] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, all } = await request.json().catch(() => ({}))
    const nowIso = new Date().toISOString()

    // RLS (audit_alerts_update_own) restricts these updates to the user's rows.
    let q = supabase.from('audit_alerts').update({ read_at: nowIso } as any)
    if (all) {
      q = q.is('read_at', null)
    } else if (id) {
      q = q.eq('id', id)
    } else {
      return NextResponse.json({ error: 'Provide id or all' }, { status: 400 })
    }

    const { error } = await q
    if (error) {
      console.error('[api/alerts] PATCH failed:', error.message)
      return NextResponse.json({ error: 'Failed to update alerts' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[api/alerts] PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
