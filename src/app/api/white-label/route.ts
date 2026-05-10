// ============================================================
// ClearUX API — /api/white-label
// GET  → returns white-label settings for current user
// PUT  → creates or updates white-label settings
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

// Package tiers that include white-label access
const WHITE_LABEL_TIERS = ['growth', 'agency', 'scale']

/* ── GET — fetch white-label settings ────────────────────── */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()

    // Fetch profile to check tier eligibility
    const { data: profile } = await db
      .from('profiles')
      .select('package_tier, white_label')
      .eq('id', user.id)
      .single()

    const tier = (profile as any)?.package_tier ?? 'starter'
    const canEdit = WHITE_LABEL_TIERS.includes(tier)

    // Fetch existing settings (may be null)
    const { data: settings } = await db
      .from('white_label_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({
      settings: settings ?? null,
      can_edit: canEdit,
      package_tier: tier,
    })
  } catch (err) {
    console.error('GET /api/white-label error:', err)
    return NextResponse.json({ error: 'Failed to fetch white-label settings' }, { status: 500 })
  }
}

/* ── PUT — create or update white-label settings ─────────── */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()

    // Verify tier eligibility
    const { data: profile } = await db
      .from('profiles')
      .select('package_tier')
      .eq('id', user.id)
      .single()

    const tier = (profile as any)?.package_tier ?? 'starter'
    if (!WHITE_LABEL_TIERS.includes(tier))
      return NextResponse.json(
        { error: 'White-label is available on Growth, Agency, and Scale plans' },
        { status: 403 }
      )

    const body = await request.json()
    const {
      company_name,
      logo_url,
      brand_color,
      contact_email,
      footer_text,
      is_active,
    } = body

    // Validate brand_color format if provided
    if (brand_color && !/^#[0-9A-Fa-f]{6}$/.test(brand_color))
      return NextResponse.json({ error: 'brand_color must be a valid hex color (e.g. #6366F1)' }, { status: 400 })

    // Validate contact_email format if provided
    if (contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email))
      return NextResponse.json({ error: 'Invalid contact email' }, { status: 400 })

    const payload = {
      company_name: company_name ?? null,
      logo_url: logo_url ?? null,
      brand_color: brand_color ?? null,
      contact_email: contact_email ?? null,
      footer_text: footer_text ?? null,
      is_active: is_active !== undefined ? is_active : true,
      updated_at: new Date().toISOString(),
    }

    // Check if settings already exist
    const { data: existing } = await db
      .from('white_label_settings')
      .select('id')
      .eq('user_id', user.id)
      .single()

    let result
    if (existing) {
      // Update
      const { data, error } = await db
        .from('white_label_settings')
        .update(payload as any)
        .eq('user_id', user.id)
        .select()
        .single()
      if (error) throw error
      result = data
    } else {
      // Insert
      const { data, error } = await db
        .from('white_label_settings')
        .insert({ ...payload, user_id: user.id } as any)
        .select()
        .single()
      if (error) throw error
      result = data
    }

    return NextResponse.json({ settings: result, success: true })
  } catch (err) {
    console.error('PUT /api/white-label error:', err)
    return NextResponse.json({ error: 'Failed to save white-label settings' }, { status: 500 })
  }
}
