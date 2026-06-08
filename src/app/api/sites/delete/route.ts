// ============================================================
// Fixpath API — POST /api/sites/delete
// Soft-delete all audits for a given domain WITHIN A WORKSPACE.
//
// WORKSPACE-SCOPED: workspace_id is REQUIRED. Domain is used
// only as a filter within the workspace boundary — never as the
// primary identity key. This prevents cross-workspace deletion
// when two workspaces share the same domain.
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

    const { domain, workspace_id } = await request.json()
    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 })
    }
    if (!workspace_id || typeof workspace_id !== 'string') {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 })
    }

    const db = createServiceSupabase()

    // ── Verify workspace ownership ────────────────────────────
    const { data: ws } = await db
      .from('workspaces')
      .select('id')
      .eq('id', workspace_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!ws) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // ── Find audits scoped by workspace_id + domain ───────────
    const { data: audits, error: fetchErr } = await db
      .from('audits')
      .select('id, product_url')
      .eq('user_id', user.id)
      .eq('workspace_id', workspace_id)
      .is('deleted_at', null)

    if (fetchErr) throw fetchErr

    // Filter to audits matching this domain within the workspace
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
      return NextResponse.json({ error: 'No audits found for this domain in this workspace' }, { status: 404 })
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
