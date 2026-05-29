// ============================================================
// Fixpath AI Gateway — Unified Routing Layer
// ============================================================
// All AI calls route through Claude direct (Anthropic SDK).
// OpenRouter has been removed — all tasks use Claude Haiku.
// ============================================================

import Anthropic from '@anthropic-ai/sdk'

export type AITaskType =
  | 'crawler'
  | 'analyzer'
  | 'competitors'
  | 'voice'
  | 'answers'
  | 'reports'
  | 'grading'
  | 'surgical_fix'

/* ── Claude singleton ───────────────────────────────────────── */

let _anthropic: Anthropic | null = null
function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      timeout: 30_000,
    })
  }
  return _anthropic
}

/* ── Main gateway ───────────────────────────────────────────── */

/**
 * Route an AI call — all tasks go through Claude direct.
 */
export async function aiGateway(opts: {
  task: AITaskType
  model?: string  // Ignored — all calls go to Claude
  systemPrompt?: string
  userPrompt: string
  maxTokens?: number
  temperature?: number
}): Promise<{ content: string; model: string; provider: string }> {
  const result = await claudeDirect({
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
  })
  return { content: result.content, model: result.model, provider: 'anthropic' }
}

/* ── Claude direct path ─────────────────────────────────────── */

/**
 * Claude-direct path — uses the Anthropic SDK with prompt caching support.
 */
export async function claudeDirect(opts: {
  systemPrompt?: string
  userPrompt: string
  maxTokens?: number
  temperature?: number
  cacheSystemPrompt?: boolean
}): Promise<{ content: string; model: string }> {
  const client = getAnthropicClient()

  if (opts.cacheSystemPrompt && opts.systemPrompt) {
    // Use the beta prompt caching API for cached system prompts
    const resp = await client.beta.promptCaching.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: opts.maxTokens ?? 1000,
      temperature: opts.temperature ?? 0,
      system: [{ type: 'text', text: opts.systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: opts.userPrompt }],
    })
    const content = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
    return { content, model: resp.model }
  }

  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: opts.maxTokens ?? 1000,
    temperature: opts.temperature ?? 0,
    ...(opts.systemPrompt ? { system: opts.systemPrompt } : {}),
    messages: [{ role: 'user', content: opts.userPrompt }],
  })

  const content = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()

  return { content, model: resp.model }
}

/* ── Probe convenience (uses Claude direct) ───────────────────── */

/**
 * Probe a question against Claude.
 * Returns a clean result with status for the multi-model benchmark.
 * (Previously routed through OpenRouter — now all Claude.)
 */
export async function probeModel(opts: {
  modelSlug: string
  question: string
  systemPrompt: string
  maxTokens?: number
}): Promise<{
  content: string
  model: string
  status: 'measured' | 'error'
  error?: string
}> {
  try {
    const result = await claudeDirect({
      systemPrompt: opts.systemPrompt,
      userPrompt: opts.question,
      maxTokens: opts.maxTokens ?? 400,
      temperature: 0,
    })
    return { content: result.content, model: result.model, status: 'measured' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { content: '', model: opts.modelSlug, status: 'error', error: msg }
  }
}
