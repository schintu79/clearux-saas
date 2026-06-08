// ============================================================
// /api/workspaces/[id] — Single workspace operations
// GET    → fetch workspace details
// PATCH  → update workspace
// DELETE → archive workspace (soft delete)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  return NextResponse.json({ workspace: data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const allowedFields = [
    'name', 'primary_domain', 'brand_name', 'workspace_type',
    'active_audit_id', 'active_brand_identity_id', 'settings_json',
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowedFields) {
    if (key in body) update[key] = body[key]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('workspaces')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ workspace: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use service client for cascade operations (RLS bypass needed for child tables)
  const db = createServiceSupabase()

  // Verify ownership first
  const { data: ws } = await db
    .from('workspaces')
    .select('slug')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const now = new Date().toISOString()
  const releasedSlug = ws.slug
    ? `${ws.slug}_archived_${Date.now()}`
    : `archived_${Date.now()}`

  // ── CASCADE DELETE all child records ─────────────────────────
  // This ensures no orphaned data can leak into future workspaces.
  // Order: children first, then workspace.
  //
  // SECURITY: FTP connections are HARD-DELETED (contain encrypted passwords).
  // Other records are soft-deleted (set deleted_at) or deactivated.

  await Promise.all([
    // 1. HARD-DELETE FTP connections — encrypted credentials must not persist
    db.from('ftp_connections')
      .delete()
      .eq('workspace_id', id),

    // 2. Soft-delete all audits belonging to this workspace
    db.from('audits')
      .update({ deleted_at: now } as any)
      .eq('workspace_id', id)
      .is('deleted_at', null),

    // 3. Soft-delete brand identities
    db.from('brand_identities')
      .update({ deleted_at: now } as any)
      .eq('workspace_id', id)
      .is('deleted_at', null),

    // 4. Deactivate scheduled audits
    db.from('scheduled_audits')
      .update({ is_active: false } as any)
      .eq('workspace_id', id),

    // 5. Deactivate site notes
    db.from('site_notes')
      .update({ is_active: false } as any)
      .eq('workspace_id', id),

    // 6. Delete competitor benchmarks (no sensitive data, hard delete OK)
    db.from('competitor_benchmarks')
      .delete()
      .eq('workspace_id', id),
  ])

  // ── Archive the workspace itself ─────────────────────────────
  const { error } = await db
    .from('workspaces')
    .update({
      status: 'archived',
      archived_at: now,
      slug: releasedSlug,
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
