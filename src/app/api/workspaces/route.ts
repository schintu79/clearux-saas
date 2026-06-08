// ============================================================
// /api/workspaces — CRUD for workspaces
// GET  → list user's workspaces
// POST → create a new workspace (with plan-based limit enforcement)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { getAuditUsage } from '@/lib/audit-usage'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch per-workspace audit counts split by type and status
  // Only count completed audits (status = 'completed') for accurate display.
  // Separate website audits (audit_type is null or 'website') from brand audits ('brand_identity').
  const workspaceIds = (data || []).map((ws: any) => ws.id)
  let websiteCounts: Record<string, number> = {}
  let brandCounts: Record<string, number> = {}

  if (workspaceIds.length > 0) {
    // Website audits (completed, non-brand)
    const { data: waRows } = await supabase
      .from('audits')
      .select('workspace_id')
      .in('workspace_id', workspaceIds)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .or('audit_type.is.null,audit_type.eq.website')

    for (const r of waRows || []) {
      websiteCounts[r.workspace_id] = (websiteCounts[r.workspace_id] || 0) + 1
    }

    // Brand audits (completed)
    const { data: baRows } = await supabase
      .from('audits')
      .select('workspace_id')
      .in('workspace_id', workspaceIds)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .eq('audit_type', 'brand_identity')

    for (const r of baRows || []) {
      brandCounts[r.workspace_id] = (brandCounts[r.workspace_id] || 0) + 1
    }
  }

  const workspaces = (data || []).map((ws: any) => ({
    ...ws,
    audit_count: (websiteCounts[ws.id] || 0) + (brandCounts[ws.id] || 0),
    website_audit_count: websiteCounts[ws.id] || 0,
    brand_audit_count: brandCounts[ws.id] || 0,
  }))

  return NextResponse.json({ workspaces })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, primary_domain, brand_name, workspace_type } = body

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  // ── Workspace limit enforcement ────────────────────────────
  // Two independent checks must BOTH pass:
  //   1. Active inventory: active workspaces < max_active_workspaces
  //   2. Monthly usage: workspace creations this cycle < workspace_creations_per_cycle
  // Deleting a workspace frees an active slot but does NOT refund a creation slot.
  const db = createServiceSupabase()
  const usage = await getAuditUsage(user.id, db)

  // Check 1: Active workspace inventory cap
  if (usage.active_workspaces >= usage.max_active_workspaces) {
    return NextResponse.json({
      error: `Active workspace limit reached (${usage.active_workspaces}/${usage.max_active_workspaces}). Archive or delete an existing workspace, or upgrade to add more.`,
    }, { status: 403 })
  }

  // Check 2: Monthly workspace creation cap
  if (usage.workspace_creations_used >= usage.workspace_creations_limit) {
    const resetMsg = usage.next_reset_date
      ? ` Resets on ${new Date(usage.next_reset_date).toLocaleDateString()}.`
      : ' Resets on your next billing cycle.'
    return NextResponse.json({
      error: `Workspace creation limit reached for this billing cycle (${usage.workspace_creations_used}/${usage.workspace_creations_limit}).${resetMsg} Upgrade for more.`,
    }, { status: 403 })
  }

  // Generate a clean, human-readable slug from the workspace name.
  // Only append a numeric suffix (-2, -3, ...) if the slug is already taken.
  let baseSlug = slugify(name || primary_domain || 'workspace')
  if (!baseSlug) baseSlug = 'workspace'

  // Try the clean slug first, then increment if collision.
  // Only check ACTIVE workspaces — archived/deleted ones should not reserve slugs.
  let slug = baseSlug
  const { count } = await supabase
    .from('workspaces')
    .select('id', { count: 'exact', head: true })
    .eq('slug', slug)
    .eq('status', 'active')

  if (count && count > 0) {
    // Find the next available number among active workspaces only
    const { data: existing } = await supabase
      .from('workspaces')
      .select('slug')
      .like('slug', `${baseSlug}%`)
      .eq('status', 'active')
    const taken = new Set((existing || []).map((w: any) => w.slug))
    let suffix = 2
    while (taken.has(`${baseSlug}-${suffix}`)) suffix++
    slug = `${baseSlug}-${suffix}`
  }

  const { data, error } = await supabase
    .from('workspaces')
    .insert({
      user_id: user.id,
      name,
      slug,
      primary_domain: primary_domain || null,
      brand_name: brand_name || null,
      workspace_type: workspace_type || 'website',
      status: 'active',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ workspace: data }, { status: 201 })
}
