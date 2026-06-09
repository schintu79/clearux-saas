// ============================================================
// ClearUX API — /api/brand-identities/[id]/files
// POST   → register an uploaded file for a brand identity
// DELETE → remove a file record (storage deletion via query param)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { safeFetchBrandOwner } from '@/lib/supabase-safe-filters'

/* ── POST — register a file ──────────────────────────────── */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: brandIdentityId } = await params
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()

    // Verify ownership (safe against missing deleted_at column)
    const identity = await safeFetchBrandOwner(db, brandIdentityId)

    if (!identity || identity.user_id !== user.id)
      return NextResponse.json({ error: 'Brand identity not found' }, { status: 404 })

    const { file_name, file_url, file_type, file_size_bytes } = await request.json()

    if (!file_name || !file_url)
      return NextResponse.json({ error: 'file_name and file_url are required' }, { status: 400 })

    const { data, error } = await db
      .from('brand_identity_files')
      .insert({
        brand_identity_id: brandIdentityId,
        file_name,
        file_url,
        file_type: file_type || null,
        file_size_bytes: file_size_bytes || null,
      } as any)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ file: data }, { status: 201 })
  } catch (err) {
    console.error('POST /api/brand-identities/[id]/files error:', err)
    return NextResponse.json({ error: 'Failed to register file' }, { status: 500 })
  }
}

/* ── DELETE — remove a file ──────────────────────────────── */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: brandIdentityId } = await params
    const fileId = request.nextUrl.searchParams.get('fileId')
    if (!fileId)
      return NextResponse.json({ error: 'fileId query param required' }, { status: 400 })

    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()

    // Verify ownership (safe against missing deleted_at column)
    const identity = await safeFetchBrandOwner(db, brandIdentityId)

    if (!identity || identity.user_id !== user.id)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Best-effort storage cleanup — fetch file_url to locate the blob
    try {
      const { data: file } = await db
        .from('brand_identity_files')
        .select('file_url')
        .eq('id', fileId)
        .eq('brand_identity_id', brandIdentityId)
        .single()

      if (file?.file_url) {
        try {
          const url = new URL((file as any).file_url)
          const match = url.pathname.match(/\/storage\/v1\/object\/public\/brand-assets\/(.+)/)
          if (match?.[1]) {
            await db.storage.from('brand-assets').remove([match[1]])
          }
        } catch { /* storage path parsing failed — continue with record delete */ }
      }
    } catch { /* file_url lookup failed — still delete the record below */ }

    // Always delete the DB record regardless of storage cleanup result
    const { error: deleteError } = await db
      .from('brand_identity_files')
      .delete()
      .eq('id', fileId)
      .eq('brand_identity_id', brandIdentityId)

    if (deleteError) {
      console.error('Failed to delete brand file record:', deleteError)
      return NextResponse.json({ error: 'Failed to delete file record' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/brand-identities/[id]/files error:', err)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}
