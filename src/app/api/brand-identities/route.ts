// ============================================================
// ClearUX API — /api/brand-identities
// GET  → list all brand identities for the current user
// POST → create a new brand identity
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

/* ── GET — list brand identities ─────────────────────────── */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()
    const { data: identities, error } = await db
      .from('brand_identities')
      .select('*, brand_identity_files(id, file_name, file_type, file_size_bytes, created_at)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ identities: identities || [] })
  } catch (err) {
    console.error('GET /api/brand-identities error:', err)
    return NextResponse.json({ error: 'Failed to fetch brand identities' }, { status: 500 })
  }
}

/* ── POST — create brand identity ────────────────────────── */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name, description } = await request.json()
    if (!name?.trim())
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const db = createServiceSupabase()
    const { data, error } = await db
      .from('brand_identities')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
      } as any)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ identity: data }, { status: 201 })
  } catch (err) {
    console.error('POST /api/brand-identities error:', err)
    return NextResponse.json({ error: 'Failed to create brand identity' }, { status: 500 })
  }
}
