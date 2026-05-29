// ============================================================
// Fixpath AI Gateway — OpenRouter Client
// ============================================================
// Single gateway for all non-Claude AI model calls.
// Uses OpenAI-compatible request structure via OpenRouter's
// /api/v1/chat/completions endpoint.
//
// API key: OPENROUTER_API_KEY or OPENROUTE_API_KEY (env var)
// ============================================================

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

/* ── Types ──────────────────────────────────────────────────── */

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenRouterChoice {
  message: { role: string; content: string }
  finish_reason: string
}

interface OpenRouterResponse {
  id: string
  choices: OpenRouterChoice[]
  model: string
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

interface OpenRouterModelInfo {
  id: string
  name: string
  description?: string
  pricing?: { prompt: string; completion: string }
  context_length?: number
}

/* ── API key ────────────────────────────────────────────────── */

function getApiKey(): string | null {
  return process.env.OPENROUTER_API_KEY || process.env.OPENROUTE_API_KEY || null
}

/* ── Retry with exponential backoff ─────────────────────────── */

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries: number = 2,
  baseDelayMs: number = 2000,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const isRateLimit = err instanceof Error && (
        err.message.includes('rate') ||
        err.message.includes('429') ||
        err.message.includes('overloaded') ||
        err.message.includes('529')
      )
      const isTimeout = err instanceof Error && err.message.includes('Timeout')
      if (attempt < maxRetries && (isRateLimit || isTimeout)) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000
        console.warn(`[openrouter][${label}] Attempt ${attempt + 1} failed (${isRateLimit ? 'rate limit' : 'timeout'}), retrying in ${Math.round(delay)}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}

/* ── Chat completions ───────────────────────────────────────── */

/**
 * Send a chat completion request through OpenRouter.
 * Throws if the API key is missing or the request fails after retries.
 *
 * When `fallbackModels` is provided, OpenRouter will automatically try the
 * next model in the list if the primary model's provider is down or rate-
 * limited — no retry delay needed. The response's `model` field tells you
 * which model actually served the request. Leave `fallbackModels` empty
 * (the default) for model-specific probes where you need a particular
 * provider's answer.
 */
export async function openRouterChat(opts: {
  model: string
  messages: OpenRouterMessage[]
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
  /** Optional fallback models for automatic provider-level failover.
   *  When set, OpenRouter tries each model in order until one succeeds.
   *  Only use for general tasks — never for model-specific benchmarks. */
  fallbackModels?: string[]
}): Promise<{
  content: string
  model: string
  usage?: { promptTokens: number; completionTokens: number }
}> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured (OPENROUTER_API_KEY / OPENROUTE_API_KEY)')
  }

  const timeoutMs = opts.timeoutMs ?? 20_000

  // Build request body — add fallback routing when fallbackModels are provided
  const requestBody: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 1000,
    temperature: opts.temperature ?? 0,
  }

  if (opts.fallbackModels && opts.fallbackModels.length > 0) {
    requestBody.models = [opts.model, ...opts.fallbackModels]
    requestBody.route = 'fallback'
  }

  return withRetry(async () => {
    const resp = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://fixpath.co',
        'X-Title': 'Fixpath',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!resp.ok) {
      const body = await resp.text().catch(() => '')
      throw new Error(`OpenRouter HTTP ${resp.status}: ${body.slice(0, 300)}`)
    }

    const data = (await resp.json()) as OpenRouterResponse

    if (!data.choices || data.choices.length === 0) {
      throw new Error('OpenRouter returned empty choices')
    }

    const content = data.choices[0].message?.content?.trim() || ''

    return {
      content,
      model: data.model || opts.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
          }
        : undefined,
    }
  }, `openrouter(${opts.model})`)
}

/* ── Model listing ──────────────────────────────────────────── */

/**
 * Fetch the list of available models from OpenRouter.
 * Useful for refreshing the local catalog.
 */
export async function fetchOpenRouterModels(): Promise<
  Array<{ id: string; name: string; description?: string; contextLength?: number }>
> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured')
  }

  const resp = await fetch(`${OPENROUTER_BASE_URL}/models`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://fixpath.co',
      'X-Title': 'Fixpath',
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!resp.ok) {
    throw new Error(`OpenRouter models API HTTP ${resp.status}`)
  }

  const data = (await resp.json()) as { data: OpenRouterModelInfo[] }

  return (data.data || []).map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    contextLength: m.context_length,
  }))
}

/**
 * Check whether an OpenRouter API key is configured.
 */
export function isOpenRouterConfigured(): boolean {
  return Boolean(getApiKey())
}
