// ============================================================
// Fixpath API — /api/ai-interrogation/questions
// GET  → returns the workspace's curated question shortlist
// POST → forces a shortlist refresh (bypasses cache)
//
// Questions are ranked by relevance to the workspace's category,
// region, language, competitors, and recent finding themes.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import {
  getOrRefreshShortlist,
  generateShortlist,
  getWorkspaceContext,
} from '@/lib/ai/shortlist-generator'

/* ── GET — return active shortlist for the workspace ─────────── */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspace_id')
    if (!workspaceId)
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 })

    const db = createServiceSupabase()

    // Verify user owns this workspace
    const { data: workspace, error: wsError } = await db
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (wsError || !workspace)
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    // Get or refresh the shortlist (cached for 7 days)
    const questions = await getOrRefreshShortlist(workspaceId, db)

    // Fetch the latest question set record for timing metadata
    const { data: questionSet } = await db
      .from('workspace_ai_question_sets')
      .select('generated_at, valid_until')
      .eq('workspace_id', workspaceId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      questions,
      generatedAt: questionSet?.generated_at ?? new Date().toISOString(),
      validUntil: questionSet?.valid_until ?? null,
    })
  } catch (err) {
    console.error('GET /api/ai-interrogation/questions error:', err)
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
  }
}

/* ── POST — force a shortlist refresh (bypass cache) ─────────── */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspace_id: workspaceId } = await request.json()
    if (!workspaceId)
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 })

    const db = createServiceSupabase()

    // Verify user owns this workspace
    const { data: workspace, error: wsError } = await db
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (wsError || !workspace)
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    // Build fresh context and generate a new shortlist (bypass cache)
    const ctx = await getWorkspaceContext(workspaceId, db)
    const questions = await generateShortlist(ctx, db)

    // Fetch the freshly inserted question set record for timing metadata
    const { data: questionSet } = await db
      .from('workspace_ai_question_sets')
      .select('generated_at, valid_until')
      .eq('workspace_id', workspaceId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      questions,
      generatedAt: questionSet?.generated_at ?? new Date().toISOString(),
      validUntil: questionSet?.valid_until ?? null,
    })
  } catch (err) {
    console.error('POST /api/ai-interrogation/questions error:', err)
    return NextResponse.json({ error: 'Failed to refresh questions' }, { status: 500 })
  }
}
