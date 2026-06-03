// ============================================================
// Fixpath API — /api/ai-interrogation/usage
// GET → returns the workspace's AI interrogation usage
// (checks used, limit, remaining, billing period)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { getInterrogationUsage } from '@/lib/ai/interrogation-usage'

export async function GET(request: NextRequest) {
  try {
    // ── Auth check ──────────────────────────────────────────────
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Validate workspace_id param ─────────────────────────────
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspace_id')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 })
    }

    // ── Verify user owns the workspace ──────────────────────────
    const db = createServiceSupabase()
    const { data: workspace, error: wsError } = await db
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (wsError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // ── Fetch interrogation usage ───────────────────────────────
    const usage = await getInterrogationUsage(user.id, workspaceId, db)

    return NextResponse.json({
      checksUsed: usage.checksUsed,
      checksLimit: usage.checksLimit,
      checksRemaining: usage.checksRemaining,
      canInterrogate: usage.canInterrogate,
      billingPeriodStart: usage.billingPeriodStart,
      billingPeriodEnd: usage.billingPeriodEnd,
    })
  } catch (err) {
    console.error('GET /api/ai-interrogation/usage error:', err)
    return NextResponse.json({ error: 'Failed to fetch interrogation usage' }, { status: 500 })
  }
}
