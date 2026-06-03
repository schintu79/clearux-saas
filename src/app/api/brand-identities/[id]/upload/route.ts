// ============================================================
// ClearUX API — /api/brand-identities/[id]/upload
// POST → upload a file to storage and register it for a brand identity
// Uses service role to bypass storage RLS
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { safeFetchBrandOwner } from '@/lib/supabase-safe-filters'

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

    // Verify ownership (safe against missing deleted_at column)
    const identity = await safeFetchBrandOwner(db, brandIdentityId)

    if (!identity || identity.user_id !== user.id)
      return NextResponse.json({ error: 'Brand identity not found' }, { status: 404 })

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const asLogo = formData.get('as_logo') === 'true'

    if (!file)
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    if (file.size > MAX_FILE_SIZE)
      return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 })

    if (!ALLOWED_TYPES.includes(file.type))
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })

    if (asLogo && !file.type.startsWith('image/'))
      return NextResponse.json({ error: 'Logo must be an image file' }, { status: 400 })

    // Upload to Supabase storage using service role (bypasses RLS)
    const ext = file.name.split('.').pop() || 'bin'
    const storagePath = `${user.id}/${brandIdentityId}/${Date.now()}-${file.name}`
    const buffer = Buffer.from(await file.arrayBuffer())

    // Ensure bucket exists (auto-create if missing)
    const { data: buckets } = await db.storage.listBuckets()
    const bucketExists = buckets?.some((b: any) => b.name === 'brand-assets')
    if (!bucketExists) {
      const { error: createErr } = await db.storage.createBucket('brand-assets', {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE,
        allowedMimeTypes: ALLOWED_TYPES,
      })
      if (createErr) {
        console.error('Bucket creation error:', createErr)
        return NextResponse.json({ error: 'Storage not configured — please contact support' }, { status: 500 })
      }
    }

    const { error: uploadErr } = await db.storage
      .from('brand-assets')
      .upload(storagePath, buffer, {
        cacheControl: '31536000',
        upsert: false,
        contentType: file.type,
      })

    if (uploadErr) {
      console.error('Storage upload error:', uploadErr)
      return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 })
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

    // If caller asked to set this asset as the brand logo, update logo_url
    // on the parent brand identity in the same request.
    if (asLogo) {
      await db
        .from('brand_identities')
        .update({ logo_url: urlData.publicUrl, updated_at: new Date().toISOString() } as any)
        .eq('id', brandIdentityId)
    }

    return NextResponse.json({ file: data, logo_url: asLogo ? urlData.publicUrl : null }, { status: 201 })
  } catch (err) {
    console.error('POST /api/brand-identities/[id]/upload error:', err)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}
