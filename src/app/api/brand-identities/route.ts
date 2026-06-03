// ============================================================
// ClearUX API — /api/brand-identities
// GET  → list all brand identities for the current user
// POST → create a new brand identity
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { normalizeColorArray, normalizeStringArray, normalizeUrl } from '@/lib/brand-dna'
import { safeListBrandIdentities } from '@/lib/supabase-safe-filters'

/* ── GET — list brand identities ─────────────────────────── */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()
    const workspace_id = request.nextUrl.searchParams.get('workspace_id')

    // Safe query — handles missing deleted_at / tag columns gracefully
    const identities = await safeListBrandIdentities(db, user.id, workspace_id)

    return NextResponse.json({ identities })
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

    const body = await request.json()
    const { name, description, website_url, brand_voice, tone_keywords, primary_colors, logo_url, workspace_id } = body || {}
    if (!name?.trim())
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!workspace_id)
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 })

    const db = createServiceSupabase()
    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      workspace_id,
      name: name.trim(),
      description: typeof description === 'string' ? description.trim() || null : null,
      website_url: normalizeUrl(website_url),
      brand_voice: typeof brand_voice === 'string' ? brand_voice.trim().slice(0, 4000) || null : null,
      tone_keywords: normalizeStringArray(tone_keywords),
      primary_colors: normalizeColorArray(primary_colors),
      logo_url: normalizeUrl(logo_url),
    }

    const { data, error } = await db
      .from('brand_identities')
      .insert(insertPayload as any)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ identity: data }, { status: 201 })
  } catch (err) {
    console.error('POST /api/brand-identities error:', err)
    return NextResponse.json({ error: 'Failed to create brand identity' }, { status: 500 })
  }
}

