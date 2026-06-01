// ============================================================
// Fixpath API — /api/brand-identities/[id]/analyze-files
// POST → Classify uploaded files by CONTENT (not filename),
//         detect brand fields, and optionally auto-populate
//         the brand profile.
//
// Returns: { suggestion: BrandProfileSuggestion, applied?: boolean }
// Body (optional): { apply: true } to auto-write detected fields
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { classifyAndSuggestProfile } from '@/lib/audit-engine/brand-file-extractor'
import { normalizeColorArray, normalizeStringArray } from '@/lib/brand-dna'

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

    const db = createServiceSupabase()

    // Fetch brand identity with files
    const { data: identity, error: fetchErr } = await db
      .from('brand_identities')
      .select('*, brand_identity_files(*)')
      .eq('id', brandIdentityId)
      .eq('user_id', user.id)
      .single()

    if (fetchErr || !identity)
      return NextResponse.json({ error: 'Brand identity not found' }, { status: 404 })

    const files = ((identity as any).brand_identity_files || []) as Array<{
      file_name: string
      file_url: string
      file_type: string | null
    }>

    if (files.length === 0)
      return NextResponse.json({ error: 'No files uploaded to analyze' }, { status: 400 })

    // Run content-based classification
    const suggestion = await classifyAndSuggestProfile(files)

    // Optionally auto-apply detected fields to the brand profile
    let applied = false
    let body: Record<string, unknown> = {}
    try { body = await request.json() } catch { /* no body is fine */ }

    if (body.apply === true) {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }

      // Only populate fields that are currently empty on the identity
      const id = identity as any

      if (suggestion.brand_voice && !id.brand_voice) {
        updates.brand_voice = suggestion.brand_voice.slice(0, 4000)
      }
      if (suggestion.tone_keywords.length > 0 && (!id.tone_keywords || id.tone_keywords.length === 0)) {
        updates.tone_keywords = normalizeStringArray(suggestion.tone_keywords)
      }
      if (suggestion.primary_colors.length > 0 && (!id.primary_colors || id.primary_colors.length === 0)) {
        updates.primary_colors = normalizeColorArray(suggestion.primary_colors)
      }
      if (suggestion.description && !id.description) {
        updates.description = suggestion.description.slice(0, 600)
      }

      // Only write if there's something new to add
      if (Object.keys(updates).length > 1) {
        await db
          .from('brand_identities')
          .update(updates as any)
          .eq('id', brandIdentityId)

        applied = true
      }
    }

    // Also update file tags based on classification
    for (const cf of suggestion.files) {
      const d = cf.detection
      let tag: string | null = null
      if (d.isBrandGuide) tag = 'Brand guide'
      else if (d.isLogo) tag = 'Logo'
      else if (d.isIcon) tag = 'Icon'
      else if (d.hasVoice) tag = 'Voice'
      else if (d.hasColours) tag = 'Colours'
      else if (d.hasPromise) tag = 'Messaging'

      if (tag) {
        // Find the file record by name and update its tag
        const fileRecord = files.find(f => f.file_name === cf.fileName)
        if (fileRecord) {
          await db
            .from('brand_identity_files')
            .update({ tag } as any)
            .eq('brand_identity_id', brandIdentityId)
            .eq('file_name', cf.fileName)
        }
      }
    }

    return NextResponse.json({ suggestion, applied })
  } catch (err) {
    console.error('POST /api/brand-identities/[id]/analyze-files error:', err)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
