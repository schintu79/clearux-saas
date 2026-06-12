/**
 * Prompt Library System — Tier 2
 *
 * Manages a library of non-branded category prompts that are run against
 * multiple AI models to calculate real visibility %, placement scores,
 * and share of voice for a brand within its category.
 *
 * Key features:
 * - Category-based prompt selection
 * - Multi-model execution (Claude, GPT-4o, Gemini, Perplexity)
 * - Visibility % calculation (mentioned vs not mentioned)
 * - Placement scoring (where in the response)
 * - Share of voice (brand % vs competitors)
 * - Competitor detection in responses
 */

import Anthropic from '@anthropic-ai/sdk'
import { createServiceSupabase } from '@/lib/supabase-server'
import { openRouterChat, isOpenRouterConfigured } from '@/lib/ai/openrouter-client'
import { DEFAULT_MODEL_CATALOG, type AIModelDef } from '@/lib/ai/model-catalog'

/* ── Types ───────────────────────────────────────────── */

export interface PromptEntry {
  id: string
  category: string
  promptText: string
  promptType: 'branded' | 'non_branded'
  intent: string | null
}

export interface PromptExecutionResult {
  promptId: string
  promptText: string
  modelId: string
  responseText: string
  brandMentioned: boolean
  placement: number | null // 1-5
  sentimentScore: number // 0-100
  shareOfVoice: number // 0-100
  competitorsMentioned: Array<{ name: string; placement: number | null }>
}

export interface PromptLibraryAnalysis {
  totalPromptsRun: number
  visibilityPercent: number // % of prompts where brand was mentioned
  avgPlacement: number | null // average position when mentioned
  avgShareOfVoice: number // average content share
  avgSentiment: number
  results: PromptExecutionResult[]
  topCompetitors: Array<{ name: string; mentionCount: number; avgPlacement: number | null }>
  fetchedAt: string
}

/* ── Prompt fetching ─────────────────────────────────── */

/**
 * Get prompts for a specific category from the prompt library.
 * Falls back to 'saas' if category has no prompts.
 */
export async function getPromptsForCategory(
  category: string,
  limit = 10,
): Promise<PromptEntry[]> {
  const db = createServiceSupabase()

  // Try exact category first
  let { data: prompts } = await db
    .from('prompt_library')
    .select('id, category, prompt_text, prompt_type, intent')
    .eq('category', category.toLowerCase())
    .eq('prompt_type', 'non_branded')
    .limit(limit)

  // Fallback to saas if no category-specific prompts
  if (!prompts || prompts.length === 0) {
    const { data: fallback } = await db
      .from('prompt_library')
      .select('id, category, prompt_text, prompt_type, intent')
      .eq('category', 'saas')
      .eq('prompt_type', 'non_branded')
      .limit(limit)
    prompts = fallback
  }

  return (prompts || []).map((p: any) => ({
    id: p.id,
    category: p.category,
    promptText: p.prompt_text,
    promptType: p.prompt_type,
    intent: p.intent,
  }))
}

/* ── Prompt execution ────────────────────────────────── */

const ANALYSIS_PROMPT = `You are analyzing an AI response to determine brand visibility. Given:
- Brand name: "{brand}"
- AI response to a category question

Analyze and return JSON only (no markdown):
{
  "brandMentioned": true/false,
  "placement": 1-5 or null (1=first mentioned, 5=barely mentioned, null=not mentioned),
  "sentimentScore": 0-100 (sentiment towards the brand, 50 if not mentioned),
  "shareOfVoice": 0-100 (% of response content about this brand),
  "competitorsMentioned": [{"name": "competitor name", "placement": 1-5}]
}`

async function analyzeResponseForBrand(
  brandName: string,
  response: string,
): Promise<{
  brandMentioned: boolean
  placement: number | null
  sentimentScore: number
  shareOfVoice: number
  competitorsMentioned: Array<{ name: string; placement: number | null }>
}> {
  try {
    const client = new Anthropic()
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `${ANALYSIS_PROMPT.replace('{brand}', brandName)}\n\nAI Response:\n${response.slice(0, 2000)}`,
      }],
    })

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    const parsed = JSON.parse(text)
    return {
      brandMentioned: parsed.brandMentioned ?? false,
      placement: parsed.brandMentioned ? (parsed.placement ?? null) : null,
      sentimentScore: parsed.sentimentScore ?? 50,
      shareOfVoice: parsed.shareOfVoice ?? 0,
      competitorsMentioned: parsed.competitorsMentioned ?? [],
    }
  } catch {
    // Simple heuristic fallback
    const mentioned = response.toLowerCase().includes(brandName.toLowerCase())
    return {
      brandMentioned: mentioned,
      placement: mentioned ? 3 : null,
      sentimentScore: 50,
      shareOfVoice: mentioned ? 20 : 0,
      competitorsMentioned: [],
    }
  }
}

/**
 * Execute a single prompt against a model and analyze for brand visibility.
 * Routes through OpenRouter for non-Claude models; uses direct Anthropic SDK for Claude.
 */
async function executePromptAgainstModel(
  prompt: string,
  brandName: string,
  modelId: string,
  modelSlug?: string,
): Promise<{ response: string; analysis: Awaited<ReturnType<typeof analyzeResponseForBrand>> }> {
  try {
    let response: string

    if (modelId === 'claude' || !modelSlug) {
      // Claude direct path
      const client = new Anthropic()
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      })
      response = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    } else {
      // OpenRouter path for all other models
      const result = await openRouterChat({
        model: modelSlug,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 1000,
        temperature: 0,
      })
      response = result.content
    }

    const analysis = await analyzeResponseForBrand(brandName, response)
    return { response, analysis }
  } catch {
    return {
      response: '',
      analysis: { brandMentioned: false, placement: null, sentimentScore: 50, shareOfVoice: 0, competitorsMentioned: [] },
    }
  }
}

/* ── Public API ──────────────────────────────────────── */

/**
 * Run the prompt library against AI models for a brand.
 * Executes category-relevant prompts and calculates visibility metrics.
 *
 * @param enabledModelSlugs Optional list of OpenRouter model slugs to
 *   query in addition to Claude. If not provided, uses default-enabled
 *   models from the catalog when OpenRouter is configured.
 */
export async function runPromptLibrary(
  brandDomain: string,
  brandName: string,
  category: string,
  auditId: string,
  enabledModelSlugs?: string[],
): Promise<PromptLibraryAnalysis> {
  const prompts = await getPromptsForCategory(category, 10)

  if (prompts.length === 0) {
    return {
      totalPromptsRun: 0,
      visibilityPercent: 0,
      avgPlacement: null,
      avgShareOfVoice: 0,
      avgSentiment: 50,
      results: [],
      topCompetitors: [],
      fetchedAt: new Date().toISOString(),
    }
  }

  // Build the list of models to query
  interface ModelTarget { modelId: string; modelSlug?: string; label: string }
  const targets: ModelTarget[] = [{ modelId: 'claude', label: 'Claude' }]

  if (isOpenRouterConfigured()) {
    const modelsToAdd: AIModelDef[] = enabledModelSlugs
      ? DEFAULT_MODEL_CATALOG.filter((m) => enabledModelSlugs.includes(m.slug))
      : DEFAULT_MODEL_CATALOG.filter((m) => m.defaultEnabled)

    for (const m of modelsToAdd) {
      targets.push({ modelId: m.shortId, modelSlug: m.slug, label: m.displayName })
    }
  }

  const results: PromptExecutionResult[] = []
  const db = createServiceSupabase()

  for (const prompt of prompts) {
    // Run each prompt against all target models in parallel
    const modelResults = await Promise.all(
      targets.map(async (target) => {
        const { response, analysis } = await executePromptAgainstModel(
          prompt.promptText,
          brandName,
          target.modelId,
          target.modelSlug,
        )
        return { target, response, analysis }
      }),
    )

    for (const { target, response, analysis } of modelResults) {
      const result: PromptExecutionResult = {
        promptId: prompt.id,
        promptText: prompt.promptText,
        modelId: target.modelId,
        responseText: response,
        brandMentioned: analysis.brandMentioned,
        placement: analysis.placement,
        sentimentScore: analysis.sentimentScore,
        shareOfVoice: analysis.shareOfVoice,
        competitorsMentioned: analysis.competitorsMentioned,
      }
      results.push(result)

      // Store result in DB
      const { error: uncheckedInsertErr1 } = await db.from('prompt_results').insert({
        audit_id: auditId,
        prompt_id: prompt.id,
        brand_domain: brandDomain,
        model_id: target.modelId,
        prompt_text: prompt.promptText,
        response_text: response,
        brand_mentioned: analysis.brandMentioned,
        placement: analysis.placement,
        sentiment_score: analysis.sentimentScore,
        share_of_voice: analysis.shareOfVoice,
        competitors_mentioned: analysis.competitorsMentioned,
      } as any)
      if (uncheckedInsertErr1) console.error(`[db] insert failed (prompt_results): ${uncheckedInsertErr1.message}`)
    }
  }

  // Compute aggregates
  const mentioned = results.filter(r => r.brandMentioned)
  const visibilityPercent = results.length > 0
    ? Math.round((mentioned.length / results.length) * 100)
    : 0

  const placements = mentioned.filter(r => r.placement != null).map(r => r.placement as number)
  const avgPlacement = placements.length > 0
    ? Math.round((placements.reduce((a, b) => a + b, 0) / placements.length) * 10) / 10
    : null

  const avgShareOfVoice = results.length > 0
    ? Math.round(results.reduce((a, r) => a + r.shareOfVoice, 0) / results.length)
    : 0

  const avgSentiment = mentioned.length > 0
    ? Math.round(mentioned.reduce((a, r) => a + r.sentimentScore, 0) / mentioned.length)
    : 50

  // Top competitors
  const competitorMap = new Map<string, { count: number; placements: number[] }>()
  for (const r of results) {
    for (const c of r.competitorsMentioned) {
      const name = c.name.toLowerCase()
      const existing = competitorMap.get(name)
      if (existing) {
        existing.count++
        if (c.placement) existing.placements.push(c.placement)
      } else {
        competitorMap.set(name, { count: 1, placements: c.placement ? [c.placement] : [] })
      }
    }
  }
  const topCompetitors = [...competitorMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([name, { count, placements }]) => ({
      name,
      mentionCount: count,
      avgPlacement: placements.length > 0
        ? Math.round((placements.reduce((a, b) => a + b, 0) / placements.length) * 10) / 10
        : null,
    }))

  return {
    totalPromptsRun: results.length,
    visibilityPercent,
    avgPlacement,
    avgShareOfVoice,
    avgSentiment,
    results,
    topCompetitors,
    fetchedAt: new Date().toISOString(),
  }
}
