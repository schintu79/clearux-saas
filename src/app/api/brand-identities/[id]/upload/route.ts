// ============================================================
// ClearUX API — /api/brand-identities/[id]/upload
// POST → upload a file to storage and register it for a brand identity
// Uses service role to bypass storage RLS
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'image/webp',
]

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

    // Verify ownership of brand identity
    const { data: identity } = await db
      .from('brand_identities')
      .select('user_id')
      .eq('id', brandIdentityId)
      .single()

    if (!identity || (identity as any).user_id !== user.id)
      return NextResponse.json({ error: 'Brand identity not found' }, { status: 404 })

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file)
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    if (file.size > MAX_FILE_SIZE)
      return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 })

    if (!ALLOWED_TYPES.includes(file.type))
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })

    // Upload to Supabase storage using service role (bypasses RLS)
    const ext = file.name.split('.').pop() || 'bin'
    const storagePath = `${user.id}/${brandIdentityId}/${Date.now()}-${file.name}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadErr } = await db.storage
      .from('brand-assets')
      .upload(storagePath, buffer, {
        cacheControl: '31536000',
        upsert: false,
        contentType: file.type,
      })

    if (uploadErr) {
      console.error('Storage upload error:', uploadErr)
      return NextResponse.json({ error: 'Failed to upload file to storage' }, { status: 500 })
    }

    const { data: urlData } = db.storage
      .from('brand-assets')
      .getPublicUrl(storagePath)

    // Register file in DB
    const { data, error } = await db
      .from('brand_identity_files')
      .insert({
        brand_identity_id: brandIdentityId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: ext,
        file_size_bytes: file.size,
      } as any)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ file: data }, { status: 201 })
  } catch (err) {
    console.error('POST /api/brand-identities/[id]/upload error:', err)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}
