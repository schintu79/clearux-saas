// ============================================================
// ClearUX API — POST /api/free-audit/claim
// Claims a free preview audit for the authenticated user.
// Called after payment to move the audit to their dashboard.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()
    const { audit_id } = body

    // Validate input
    if (!audit_id || typeof audit_id !== 'string') {
      return NextResponse.json(
        { error: 'audit_id is required and must be a string' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify audit exists and is a free preview that hasn't been claimed
    const { data: audit, error: fetchError } = await supabase
      .from('audits')
      .select('id, is_free_preview, claimed_by')
      .eq('id', audit_id)
      .single()

    if (fetchError || !audit) {
      return NextResponse.json(
        { error: 'Audit not found' },
        { status: 404 }
      )
    }

    if (!audit.is_free_preview) {
      return NextResponse.json(
        { error: 'Audit is not a free preview' },
        { status: 400 }
      )
    }

    if (audit.claimed_by !== null) {
      return NextResponse.json(
        { error: 'Audit has already been claimed' },
        { status: 400 }
      )
    }

    // Update audit: claim it for the user
    const { error: updateError } = await supabase
      .from('audits')
      .update({
        claimed_by: user.id,
        user_id: user.id,
        is_free_preview: false,
      })
      .eq('id', audit_id)

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to claim audit' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      audit_id,
    })
  } catch (error) {
    console.error('Error claiming free audit:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
