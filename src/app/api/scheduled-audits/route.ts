// ============================================================
// ClearUX API — /api/scheduled-audits
// GET  → list user's scheduled audits
// POST → create a new scheduled audit
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { getAuditUsage } from '@/lib/audit-usage'

function getNextRunDate(frequency: string): string {
  const now = new Date()
  switch (frequency) {
    case 'weekly': return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    case 'monthly': return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString()
    case 'quarterly': return new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()).toISOString()
    default: return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString()
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()
    const workspaceId = request.nextUrl.searchParams.get('workspace_id')
    let q = db
      .from('scheduled_audits')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
    if (workspaceId) q = q.eq('workspace_id', workspaceId)
    const { data, error } = await q.order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ schedules: data || [] })
  } catch (err) {
    console.error('GET /api/scheduled-audits error:', err)
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { product_url, frequency, language, workspace_id } = body
    if (!product_url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    if (!['weekly', 'monthly', 'quarterly'].includes(frequency))
      return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 })

    const db = createServiceSupabase()

    // Check if user already has a schedule for this URL (scoped to workspace)
    let existQ = db
      .from('scheduled_audits')
      .select('id')
      .eq('user_id', user.id)
      .eq('product_url', product_url)
      .eq('is_active', true)
    if (workspace_id) existQ = existQ.eq('workspace_id', workspace_id)
    const { data: existing } = await existQ.single()

    if (existing) {
      return NextResponse.json({ error: 'You already have an active schedule for this URL' }, { status: 409 })
    }

    const { data, error } = await db
      .from('scheduled_audits')
      .insert({
        user_id: user.id,
        product_url: product_url.startsWith('http') ? product_url : `https://${product_url}`,
        frequency,
        language: language || 'en',
        is_active: true,
        next_run_at: getNextRunDate(frequency),
        workspace_id: workspace_id || null,
      } as any)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ schedule: data })
  } catch (err) {
    console.error('POST /api/scheduled-audits error:', err)
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 })
  }
}

/* ── PUT — set monitoring cadence for a brand (Phase 2 #1) ────────
 * Upsert-style: enabled=false turns monitoring Off (deactivates any
 * existing schedule); enabled=true sets the cadence (weekly|monthly),
 * reactivating/creating the row and computing next_run_at. Gated to paid
 * plans (scheduled runs are an included subscription perk). Idempotent. */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { product_url, workspace_id, frequency, enabled, language } = body || {}
    if (!product_url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

    const db = createServiceSupabase()
    const normalizedUrl = product_url.startsWith('http') ? product_url : `https://${product_url}`

    // Find any existing schedule (active or not) for this url + workspace.
    let existQ = db
      .from('scheduled_audits')
      .select('id')
      .eq('user_id', user.id)
      .eq('product_url', normalizedUrl)
    existQ = workspace_id ? existQ.eq('workspace_id', workspace_id) : existQ.is('workspace_id', null)
    const { data: existing } = await existQ.maybeSingle()

    // ── Turn Off ──
    if (!enabled) {
      if (existing) {
        await db.from('scheduled_audits')
          .update({ is_active: false, next_run_at: null, updated_at: new Date().toISOString() } as any)
          .eq('id', (existing as any).id)
      }
      return NextResponse.json({ schedule: null, enabled: false })
    }

    // ── Turn On / change cadence — paid plans only ──
    if (!['weekly', 'monthly'].includes(frequency))
      return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 })

    const usage = await getAuditUsage(user.id, db)
    if (usage.subscription_status !== 'active') {
      return NextResponse.json({ error: 'Scheduled monitoring is available on paid plans.' }, { status: 403 })
    }

    const next_run_at = getNextRunDate(frequency)
    if (existing) {
      const { data, error } = await db.from('scheduled_audits')
        .update({ frequency, is_active: true, next_run_at, language: language || 'en', updated_at: new Date().toISOString() } as any)
        .eq('id', (existing as any).id)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ schedule: data, enabled: true })
    }

    const { data, error } = await db.from('scheduled_audits')
      .insert({
        user_id: user.id,
        product_url: normalizedUrl,
        frequency,
        language: language || 'en',
        is_active: true,
        next_run_at,
        workspace_id: workspace_id || null,
      } as any)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ schedule: data, enabled: true })
  } catch (err) {
    console.error('PUT /api/scheduled-audits error:', err)
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 })
  }
}
