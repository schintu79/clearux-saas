// ============================================================
// Fixpath AI Gateway — Unified Routing Layer
// ============================================================
// One function to call any model for any task.
//
// - crawler, analyzer, grading, surgical_fix -> always Claude direct
// - Everything else -> OpenRouter with the specified model
//
// Claude stays on the direct Anthropic SDK for prompt caching.
// ============================================================

import { openRouterChat, type OpenRouterMessage } from './openrouter-client'
import { findModelBySlug } from './model-catalog'
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

/* ── Tasks that always go to Claude direct ──────────────────── */

const CLAUDE_ONLY_TASKS = new Set<AITaskType>([
  'crawler',
  'analyzer',
  'grading',
  'surgical_fix',
])

/* ── Main gateway ───────────────────────────────────────────── */

/**
 * Route an AI call based on task type.
 * - 'crawler', 'analyzer', 'grading', 'surgical_fix' -> always Claude direct
 * - Everything else -> OpenRouter with the specified model
 */
export async function aiGateway(opts: {
  task: AITaskType
  model?: string  // OpenRouter model slug, or 'claude' for direct
  systemPrompt?: string
  userPrompt: string
  maxTokens?: number
  temperature?: number
}): Promise<{ content: string; model: string; provider: string }> {
  const isClaude = CLAUDE_ONLY_TASKS.has(opts.task) || opts.model === 'claude' || !opts.model

  if (isClaude) {
    const result = await claudeDirect({
      systemPrompt: opts.systemPrompt,
      userPrompt: opts.userPrompt,
      maxTokens: opts.maxTokens,
      temperature: opts.temperature,
    })
    return { content: result.content, model: result.model, provider: 'anthropic' }
  }

  // OpenRouter path
  const messages: OpenRouterMessage[] = []
  if (opts.systemPrompt) {
    messages.push({ role: 'system', content: opts.systemPrompt })
  }
  messages.push({ role: 'user', content: opts.userPrompt })

  const result = await openRouterChat({
    model: opts.model!,
    messages,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
  })

  const modelDef = findModelBySlug(opts.model!)
  return {
    content: result.content,
    model: result.model,
    provider: modelDef?.provider || 'unknown',
  }
}

/* ── Claude direct path ─────────────────────────────────────── */

/**
 * Claude-direct path (for crawler/scanner/analyzer flows only).
 * Uses the Anthropic SDK with prompt caching support.
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

/* ── Probe convenience ──────────────────────────────────────── */

/**
 * Probe a question against a specific OpenRouter model.
 * Returns a clean result with status for the multi-model benchmark.
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
    const messages: OpenRouterMessage[] = [
      { role: 'system', content: opts.systemPrompt },
      { role: 'user', content: opts.question },
    ]
    const result = await openRouterChat({
      model: opts.modelSlug,
      messages,
      maxTokens: opts.maxTokens ?? 400,
      temperature: 0,
    })
    return { content: result.content, model: result.model, status: 'measured' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { content: '', model: opts.modelSlug, status: 'error', error: msg }
  }
}
