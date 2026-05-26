// ============================================================
// ClearUX API — POST/DELETE /api/audits/:id/share
// Toggle shareable link for an audit
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import crypto from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: auditId } = await params
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()

    // Verify ownership
    const { data: audit } = await db.from('audits').select('user_id, share_token').eq('id', auditId).single()
    if (!audit || (audit as any).user_id !== user.id)
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

    // Generate token if not already set
    const token = (audit as any).share_token || crypto.randomBytes(16).toString('hex')

    await db.from('audits').update({
      share_token: token,
      share_enabled: true,
      updated_at: new Date().toISOString(),
    } as any).eq('id', auditId)

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.fixpath.ai'
    return NextResponse.json({
      share_url: `${siteUrl}/shared/${token}`,
      token,
    })
  } catch (err) {
    console.error('POST /api/audits/share error:', err)
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: auditId } = await params
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()

    const { data: audit } = await db.from('audits').select('user_id').eq('id', auditId).single()
    if (!audit || (audit as any).user_id !== user.id)
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

    await db.from('audits').update({
      share_enabled: false,
      updated_at: new Date().toISOString(),
    } as any).eq('id', auditId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/audits/share error:', err)
    return NextResponse.json({ error: 'Failed to disable share link' }, { status: 500 })
  }
}
