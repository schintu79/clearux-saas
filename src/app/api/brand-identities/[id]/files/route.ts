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

    // ── 1. Fetch the file record (need file_url for storage cleanup) ──
    const { data: file, error: fetchErr } = await db
      .from('brand_identity_files')
      .select('id, file_url')
      .eq('id', fileId)
      .eq('brand_identity_id', brandIdentityId)
      .single()

    if (fetchErr || !file) {
      console.error('File not found for deletion:', fetchErr?.message ?? 'no match')
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // ── 2. Remove dependent rows that may block deletion via FK ──
    // brand_audit_file_snapshots.brand_file_id → brand_identity_files(id)
    // Migration says ON DELETE CASCADE but live DB may differ.
    try {
      await db
        .from('brand_audit_file_snapshots')
        .delete()
        .eq('brand_file_id', fileId)
    } catch { /* table may not exist — continue */ }

    // Self-referencing: brand_identity_files.replaces_file_id → brand_identity_files(id)
    // Migration says ON DELETE SET NULL but clear it explicitly to be safe.
    try {
      await db
        .from('brand_identity_files')
        .update({ replaces_file_id: null } as any)
        .eq('replaces_file_id', fileId)
    } catch { /* column may not exist — continue */ }

    // ── 3. Clear brand_identities fields that reference this file ──
    try {
      const updates: Record<string, unknown> = {}
      const { data: parent } = await db
        .from('brand_identities')
        .select('logo_file_id, brand_guide_file_id, logo_url')
        .eq('id', brandIdentityId)
        .single()

      if (parent?.logo_file_id === fileId) updates.logo_file_id = null
      if (parent?.brand_guide_file_id === fileId) updates.brand_guide_file_id = null
      // If logo_url matches the file being deleted, clear it too
      if (parent?.logo_url && file.file_url && parent.logo_url === file.file_url) updates.logo_url = null

      if (Object.keys(updates).length > 0) {
        await db
          .from('brand_identities')
          .update({ ...updates, updated_at: new Date().toISOString() } as any)
          .eq('id', brandIdentityId)
      }
    } catch { /* columns may not exist — continue */ }

    // ── 4. Delete the DB record — use .select() to verify something was deleted ──
    const { data: deleted, error: deleteError } = await db
      .from('brand_identity_files')
      .delete()
      .eq('id', fileId)
      .eq('brand_identity_id', brandIdentityId)
      .select('id')

    if (deleteError) {
      console.error('Failed to delete brand file record:', deleteError.message, deleteError.code)
      return NextResponse.json(
        { error: `Delete failed: ${deleteError.message}` },
        { status: 500 },
      )
    }

    if (!deleted || deleted.length === 0) {
      console.error('Delete matched 0 rows — file may already be deleted or filter mismatch',
        { fileId, brandIdentityId })
      return NextResponse.json({ error: 'File not found or already deleted' }, { status: 404 })
    }

    // ── 5. Best-effort storage cleanup ──
    if (file.file_url) {
      try {
        const url = new URL(file.file_url)
        const match = url.pathname.match(/\/storage\/v1\/object\/public\/brand-assets\/(.+)/)
        if (match?.[1]) {
          const { error: storageErr } = await db.storage.from('brand-assets').remove([match[1]])
          if (storageErr) console.warn('Storage cleanup failed (non-blocking):', storageErr.message)
        }
      } catch (e) {
        console.warn('Storage path parsing failed (non-blocking):', e)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/brand-identities/[id]/files error:', err)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}
