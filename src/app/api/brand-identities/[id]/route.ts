// ============================================================
// ClearUX API — /api/brand-identities/[id]
// GET    → fetch single brand identity with files
// PUT    → update name/description and Phase 1 Brand DNA fields
// DELETE → delete identity and all associated files
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { normalizeColorArray, normalizeStringArray, normalizeUrl } from '@/lib/brand-dna'

/* ── GET — single brand identity ─────────────────────────── */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()
    const { data, error } = await db
      .from('brand_identities')
      .select('*, brand_identity_files(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !data)
      return NextResponse.json({ error: 'Brand identity not found' }, { status: 404 })

    return NextResponse.json({ identity: data })
  } catch (err) {
    console.error('GET /api/brand-identities/[id] error:', err)
    return NextResponse.json({ error: 'Failed to fetch brand identity' }, { status: 500 })
  }
}

/* ── PUT — update brand identity ─────────────────────────── */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { name, description, website_url, brand_voice, tone_keywords, primary_colors, logo_url } = body || {}
    if (!name?.trim())
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const db = createServiceSupabase()

    // Verify ownership
    const { data: existing } = await db
      .from('brand_identities')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing || (existing as any).user_id !== user.id)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Only set Brand DNA fields when the caller actually sent them — keeps
    // PUT idempotent for partial updates (e.g. "set as logo" sends just name + logo_url).
    const update: Record<string, unknown> = {
      name: name.trim(),
      updated_at: new Date().toISOString(),
    }
    if ('description' in (body || {})) {
      update.description = typeof description === 'string' ? description.trim() || null : null
    }
    if ('website_url' in (body || {})) update.website_url = normalizeUrl(website_url)
    if ('brand_voice' in (body || {})) {
      update.brand_voice = typeof brand_voice === 'string'
        ? brand_voice.trim().slice(0, 4000) || null
        : null
    }
    if ('tone_keywords' in (body || {})) update.tone_keywords = normalizeStringArray(tone_keywords)
    if ('primary_colors' in (body || {})) update.primary_colors = normalizeColorArray(primary_colors)
    if ('logo_url' in (body || {})) update.logo_url = normalizeUrl(logo_url)

    const { data, error } = await db
      .from('brand_identities')
      .update(update as any)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ identity: data })
  } catch (err) {
    console.error('PUT /api/brand-identities/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update brand identity' }, { status: 500 })
  }
}

/* ── DELETE — delete brand identity ──────────────────────── */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()

    // Verify ownership
    const { data: existing } = await db
      .from('brand_identities')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing || (existing as any).user_id !== user.id)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Delete associated files from storage
    const { data: files } = await db
      .from('brand_identity_files')
      .select('file_url')
      .eq('brand_identity_id', id)

    if (files && files.length > 0) {
      // Extract storage paths from URLs and delete from bucket
      const paths = (files as any[])
        .map((f) => {
          try {
            const url = new URL(f.file_url)
            const match = url.pathname.match(/\/storage\/v1\/object\/public\/brand-assets\/(.+)/)
            return match?.[1] || null
          } catch { return null }
        })
        .filter(Boolean) as string[]

      if (paths.length > 0) {
        await db.storage.from('brand-assets').remove(paths)
      }
    }

    // CASCADE will delete brand_identity_files rows
    const { error } = await db
      .from('brand_identities')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/brand-identities/[id] error:', err)
    return NextResponse.json({ error: 'Failed to delete brand identity' }, { status: 500 })
  }
}
