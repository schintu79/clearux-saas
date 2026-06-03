// ============================================================
// Fixpath API — /api/ai-interrogation/run
// POST → execute an AI interrogation across selected models
// GET  → fetch past interrogation results
//
// Each interrogation runs a question against 1-3 AI models in
// parallel and stores the responses with themes, token counts,
// and cost estimates. Usage is query-derived from records.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { checkInterrogationQuota, getInterrogationUsage } from '@/lib/ai/interrogation-usage'
import { runInterrogation, generateFollowups } from '@/lib/ai/interrogation-engine'
import { findModelBySlug, DEFAULT_MODEL_CATALOG } from '@/lib/ai/model-catalog'
import { isOpenRouterConfigured } from '@/lib/ai/openrouter-client'

export const maxDuration = 60

// Valid model slugs from the catalog
const VALID_MODEL_SLUGS = new Set(DEFAULT_MODEL_CATALOG.map((m) => m.slug))

/* ── POST — execute an AI interrogation ──────────────────────── */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      workspace_id: workspaceId,
      question_id: questionId,
      question_text: questionText,
      question_family: questionFamily,
      selected_models: selectedModels,
    } = body

    // ── Validate required fields ────────────────────────────────
    if (!workspaceId)
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 })
    if (!questionText)
      return NextResponse.json({ error: 'question_text is required' }, { status: 400 })
    if (!questionFamily)
      return NextResponse.json({ error: 'question_family is required' }, { status: 400 })
    if (!Array.isArray(selectedModels) || selectedModels.length === 0)
      return NextResponse.json({ error: 'selected_models must be a non-empty array' }, { status: 400 })

    // ── Validate model count and slugs ──────────────────────────
    if (selectedModels.length > 3)
      return NextResponse.json({ error: 'Maximum 3 models allowed per interrogation' }, { status: 400 })

    const invalidSlugs = selectedModels.filter((slug: string) => !VALID_MODEL_SLUGS.has(slug))
    if (invalidSlugs.length > 0)
      return NextResponse.json({
        error: `Invalid model slug(s): ${invalidSlugs.join(', ')}`,
      }, { status: 400 })

    // ── Verify OpenRouter API key is configured ────────────────
    if (!isOpenRouterConfigured()) {
      return NextResponse.json({
        error: 'AI interrogation is not configured. The OPENROUTER_API_KEY environment variable is missing.',
      }, { status: 503 })
    }

    const db = createServiceSupabase()

    // ── Verify user owns this workspace ─────────────────────────
    const { data: workspace, error: wsError } = await db
      .from('workspaces')
      .select('id, primary_domain, brand_name, category, region, language')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (wsError || !workspace)
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    // ── Check interrogation quota ───────────────────────────────
    const quota = await checkInterrogationQuota(user.id, workspaceId, db)
    if (!quota.allowed)
      return NextResponse.json({ error: quota.reason }, { status: 400 })

    // ── Build business context from workspace data ──────────────
    // Enrich with latest audit's detected_industry when available
    let detectedIndustry: string | null = null
    const { data: latestAudit } = await db
      .from('audits')
      .select('detected_industry')
      .eq('workspace_id', workspaceId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestAudit?.detected_industry) {
      detectedIndustry = latestAudit.detected_industry
    }

    const ws = workspace as any
    const businessContext = {
      domain: ws.primary_domain ?? null,
      brandName: ws.brand_name ?? null,
      category: ws.category ?? detectedIndustry ?? null,
      region: ws.region ?? null,
      language: ws.language ?? null,
      description: null,
    }

    // ── Run the interrogation ───────────────────────────────────
    const result = await runInterrogation(
      {
        workspaceId,
        userId: user.id,
        questionId: questionId ?? null,
        questionText,
        questionFamily,
        selectedModelSlugs: selectedModels,
        businessContext,
      },
      db,
    )

    // ── Generate follow-up suggestions ──────────────────────────
    const responseTexts = result.results
      .filter((r) => r.status === 'completed' && r.responseText)
      .map((r) => r.responseText)

    const followups = await generateFollowups(questionFamily, responseTexts, db)

    // ── Fetch updated usage for the response ────────────────────
    const usage = await getInterrogationUsage(user.id, workspaceId, db)

    return NextResponse.json({
      interrogationId: result.interrogationId,
      status: result.status,
      results: result.results,
      followups,
      usage: {
        checksUsed: usage.checksUsed,
        checksLimit: usage.checksLimit,
        checksRemaining: usage.checksRemaining,
      },
    })
  } catch (err) {
    console.error('POST /api/ai-interrogation/run error:', err)
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred'
    return NextResponse.json(
      { error: message.slice(0, 500) },
      { status: 500 },
    )
  }
}

/* ── GET — fetch past interrogation results ──────────────────── */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspace_id')
    const interrogationId = searchParams.get('interrogation_id')

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

    // ── Single interrogation by ID ──────────────────────────────
    if (interrogationId) {
      const { data: interrogation, error: intError } = await db
        .from('workspace_ai_interrogations')
        .select('*')
        .eq('id', interrogationId)
        .eq('workspace_id', workspaceId)
        .single()

      if (intError || !interrogation)
        return NextResponse.json({ error: 'Interrogation not found' }, { status: 404 })

      // Fetch associated model results
      const { data: results } = await db
        .from('workspace_ai_interrogation_results')
        .select('*')
        .eq('interrogation_id', interrogationId)
        .order('created_at', { ascending: true })

      return NextResponse.json({
        interrogation,
        results: results ?? [],
      })
    }

    // ── Recent interrogations for the workspace ─────────────────
    const { data: interrogations, error: listError } = await db
      .from('workspace_ai_interrogations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .in('status', ['completed', 'partial', 'failed'])
      .order('created_at', { ascending: false })
      .limit(20)

    if (listError) {
      console.error('Failed to fetch interrogations:', listError.message)
      return NextResponse.json({ error: 'Failed to fetch interrogations' }, { status: 500 })
    }

    // Fetch results for all interrogations in one query
    const interrogationIds = (interrogations ?? []).map((i: any) => i.id)
    let allResults: any[] = []

    if (interrogationIds.length > 0) {
      const { data: results } = await db
        .from('workspace_ai_interrogation_results')
        .select('*')
        .in('interrogation_id', interrogationIds)
        .order('created_at', { ascending: true })

      allResults = results ?? []
    }

    // Group results by interrogation ID
    const resultsByInterrogation = new Map<string, any[]>()
    for (const result of allResults) {
      const intId = result.interrogation_id as string
      if (!resultsByInterrogation.has(intId)) {
        resultsByInterrogation.set(intId, [])
      }
      resultsByInterrogation.get(intId)!.push(result)
    }

    // Assemble response
    const items = (interrogations ?? []).map((i: any) => ({
      interrogation: i,
      results: resultsByInterrogation.get(i.id) ?? [],
    }))

    return NextResponse.json({ interrogations: items })
  } catch (err) {
    console.error('GET /api/ai-interrogation/run error:', err)
    return NextResponse.json({ error: 'Failed to fetch interrogation results' }, { status: 500 })
  }
}
