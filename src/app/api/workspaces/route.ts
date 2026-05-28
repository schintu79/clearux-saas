// ============================================================
// /api/workspaces — CRUD for workspaces
// GET  → list user's workspaces
// POST → create a new workspace
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

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
    .select('*, audits(count)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flatten the audit count from Supabase's nested aggregate format
  const workspaces = (data || []).map((ws: any) => ({
    ...ws,
    audit_count: ws.audits?.[0]?.count ?? 0,
    audits: undefined,
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

  // Generate a clean, human-readable slug from the workspace name.
  // Only append a numeric suffix (-2, -3, ...) if the slug is already taken.
  let baseSlug = slugify(name || primary_domain || 'workspace')
  if (!baseSlug) baseSlug = 'workspace'

  // Try the clean slug first, then increment if collision
  let slug = baseSlug
  const { count } = await supabase
    .from('workspaces')
    .select('id', { count: 'exact', head: true })
    .eq('slug', slug)

  if (count && count > 0) {
    // Find the next available number
    const { data: existing } = await supabase
      .from('workspaces')
      .select('slug')
      .like('slug', `${baseSlug}%`)
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
