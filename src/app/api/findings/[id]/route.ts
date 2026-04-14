// ============================================================
// ClearUX API — PATCH /api/findings/:id
// Update finding status (open → in_progress → fixed → backlog)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: findingId } = await params
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { status, note } = await request.json()

    if (!['open', 'in_progress', 'fixed', 'backlog'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const db = createServiceSupabase()

    // Verify the user owns this finding's audit
    const { data: finding } = await db
      .from('audit_findings')
      .select('audit_id')
      .eq('id', findingId)
      .single()

    if (!finding) return NextResponse.json({ error: 'Finding not found' }, { status: 404 })

    const { data: audit } = await db
      .from('audits')
      .select('user_id')
      .eq('id', (finding as any).audit_id)
      .single()

    if (!audit || (audit as any).user_id !== user.id)
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

    // Update the finding status
    const { error: updateErr } = await db
      .from('audit_findings')
      .update({
        status,
        status_updated_at: new Date().toISOString(),
        status_note: note || null,
      } as any)
      .eq('id', findingId)

    if (updateErr) throw updateErr

    return NextResponse.json({ success: true, status })
  } catch (err) {
    console.error('PATCH /api/findings error:', err)
    return NextResponse.json({ error: 'Failed to update finding' }, { status: 500 })
  }
}
