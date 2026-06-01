// ============================================================
// Fixpath API — /api/brand-identities/[id]/apply-suggestion
// POST → Apply pre-computed brand profile suggestion to DB.
//         This is the FAST path — no re-classification needed.
//         Accepts cached suggestion data from the client and
//         writes detected fields to the brand identity.
//
// Body: { suggestion: BrandProfileSuggestion }
// Returns: { applied: boolean, identity: BrandIdentity }
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { normalizeColorArray, normalizeStringArray, normalizeUrl } from '@/lib/brand-dna'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: brandIdentityId } = await params

    // Auth check
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const suggestion = body?.suggestion
    if (!suggestion)
      return NextResponse.json({ error: 'Missing suggestion data' }, { status: 400 })

    const db = createServiceSupabase()

    // Fetch current brand identity to check ownership and current field values
    const { data: identity, error: fetchErr } = await db
      .from('brand_identities')
      .select('*')
      .eq('id', brandIdentityId)
      .eq('user_id', user.id)
      .single()

    if (fetchErr || !identity)
      return NextResponse.json({ error: 'Brand identity not found' }, { status: 404 })

    const id = identity as any
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    // Voice — only populate if currently empty
    if (suggestion.brand_voice && !id.brand_voice) {
      updates.brand_voice = (suggestion.brand_voice as string).slice(0, 4000)
    }

    // Tone keywords — only populate if currently empty
    if (Array.isArray(suggestion.tone_keywords) && suggestion.tone_keywords.length > 0
      && (!id.tone_keywords || id.tone_keywords.length === 0)) {
      updates.tone_keywords = normalizeStringArray(suggestion.tone_keywords)
    }

    // Colours — only populate if currently empty
    if (Array.isArray(suggestion.primary_colors) && suggestion.primary_colors.length > 0
      && (!id.primary_colors || id.primary_colors.length === 0)) {
      updates.primary_colors = normalizeColorArray(suggestion.primary_colors)
    }

    // Promise / description — only populate if currently empty
    if (suggestion.description && !id.description) {
      updates.description = (suggestion.description as string).slice(0, 600)
    }

    // Logo — set logo_url from detected logo file URL if currently empty
    if (suggestion.logoFileUrl && !id.logo_url) {
      updates.logo_url = normalizeUrl(suggestion.logoFileUrl)
    }

    // Only write if there are actual changes beyond the timestamp
    let applied = false
    if (Object.keys(updates).length > 1) {
      const { data: updated, error: updateErr } = await db
        .from('brand_identities')
        .update(updates as any)
        .eq('id', brandIdentityId)
        .select('*, brand_identity_files(*)')
        .single()

      if (updateErr) throw updateErr
      applied = true
      return NextResponse.json({ applied, identity: updated })
    }

    // Nothing new to apply — return current identity
    return NextResponse.json({ applied, identity })
  } catch (err) {
    console.error('POST /api/brand-identities/[id]/apply-suggestion error:', err)
    return NextResponse.json({ error: 'Apply failed' }, { status: 500 })
  }
}
