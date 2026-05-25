// ============================================================
// ClearUX API — POST /api/sites/delete
// Soft-delete all audits for a given domain (site-level delete).
// Sites are implicit — no dedicated table, just grouped audits.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { domain } = await request.json()
    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 })
    }

    const db = createServiceSupabase()

    // Find all audits for this user whose product_url contains the domain
    const { data: audits, error: fetchErr } = await db
      .from('audits')
      .select('id, product_url')
      .eq('user_id', user.id)
      .is('deleted_at', null)

    if (fetchErr) throw fetchErr

    // Filter to audits matching this domain
    const domainLower = domain.toLowerCase()
    const matchingIds = (audits || [])
      .filter((a: any) => {
        try {
          const host = new URL(
            a.product_url.startsWith('http') ? a.product_url : `https://${a.product_url}`,
          ).hostname.replace(/^www\./, '')
          return host === domainLower
        } catch {
          return false
        }
      })
      .map((a: any) => a.id)

    if (matchingIds.length === 0) {
      return NextResponse.json({ error: 'No audits found for this domain' }, { status: 404 })
    }

    const now = new Date().toISOString()
    const { error: updateErr } = await db
      .from('audits')
      .update({ deleted_at: now } as any)
      .in('id', matchingIds)

    if (updateErr) throw updateErr

    return NextResponse.json({ ok: true, deletedCount: matchingIds.length })
  } catch (err) {
    console.error('POST /api/sites/delete error:', err)
    return NextResponse.json({ error: 'Failed to delete site' }, { status: 500 })
  }
}
