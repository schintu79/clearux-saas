// ============================================================
// ClearUX API — PATCH /api/audit-pages/:id/exclude
// Toggle a crawled page's exclusion from the AI readability
// average. Excluded pages remain visible but don't count toward
// the overall score (e.g. dashboard/auth pages AI can't read).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: pageId } = await params

    // Auth: resolve the current user from the session cookie
    const authClient = await createServerSupabase()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const excluded = body?.excluded === true

    // Ownership check: the page's audit must belong to the caller.
    const db = createServiceSupabase()
    const { data: page, error: pageErr } = await db
      .from('audit_pages')
      .select('id, audit_id')
      .eq('id', pageId)
      .single()
    if (pageErr || !page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    const { data: audit } = await db
      .from('audits')
      .select('id, user_id')
      .eq('id', (page as any).audit_id)
      .is('deleted_at', null)
      .single()
    if (!audit || (audit as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const { error: updateErr } = await db
      .from('audit_pages')
      .update({ excluded_from_score: excluded } as any)
      .eq('id', pageId)
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, excluded })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[audit-pages/exclude] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
