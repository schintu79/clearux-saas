// ============================================================
// ClearUX API — /api/site-notes
// GET    ?domain=xxx     — list notes for a domain
// POST   { domain, ... } — create a note (context, dismissal, discussion)
// DELETE ?id=xxx         — deactivate a note
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

function normalizeDomain(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return url.toLowerCase().replace(/^www\./, '')
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const domain = request.nextUrl.searchParams.get('domain')
    if (!domain) return NextResponse.json({ error: 'domain required' }, { status: 400 })

    const db = createServiceSupabase()
    const { data, error } = await db
      .from('site_notes')
      .select('*')
      .eq('user_id', user.id)
      .eq('domain', normalizeDomain(domain))
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ notes: data || [] })
  } catch (err) {
    console.error('GET /api/site-notes error:', err)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { domain, note_type, title, content, category, finding_ref } = body

    if (!domain || !title || !content) {
      return NextResponse.json({ error: 'domain, title, and content are required' }, { status: 400 })
    }

    if (!['context', 'dismissal', 'discussion'].includes(note_type || 'context')) {
      return NextResponse.json({ error: 'Invalid note_type' }, { status: 400 })
    }

    const db = createServiceSupabase()
    const { data, error } = await db
      .from('site_notes')
      .insert({
        user_id: user.id,
        domain: normalizeDomain(domain),
        note_type: note_type || 'context',
        title,
        content,
        category: category || null,
        finding_ref: finding_ref || null,
        is_active: true,
      } as any)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ note: data })
  } catch (err) {
    console.error('POST /api/site-notes error:', err)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const db = createServiceSupabase()
    await db
      .from('site_notes')
      .update({ is_active: false, updated_at: new Date().toISOString() } as any)
      .eq('id', id)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/site-notes error:', err)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
