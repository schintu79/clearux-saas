// ============================================================
// ClearUX API — /api/scheduled-audits
// GET  → list user's scheduled audits
// POST → create a new scheduled audit
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

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
