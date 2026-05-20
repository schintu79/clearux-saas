// ============================================================
// ClearUX Audit Engine — Multi-Model AI Benchmarking
// ============================================================
// Probes multiple AI models (Claude, GPT-4o, Gemini, Perplexity)
// about the audited domain and compares their knowledge/accuracy.
// Tracks how different models represent the site over time.
//
// "Semrush tells you your SEO score. ClearUX shows you what
//  AI actually thinks about your website — across every model."
//
// PROPRIETARY — do not distribute outside the ClearUX codebase.
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import type { LlmProbeAccuracy } from '@/types/database'
import type { SiteGroundTruth } from './llm-probe'

/* ── Types ──────────────────────────────────────────────────── */

export type AIModelId = 'claude' | 'gpt4o' | 'gemini' | 'perplexity'

export interface ModelProbeResult {
  modelId: AIModelId
  modelLabel: string
  question: string
  answer: string
  accuracy: LlmProbeAccuracy
  accuracyNote: string
}

/**
 * Lifecycle state for a provider's benchmark row.
 *
 *  - `measured` — the provider answered at least one question. Real
 *    accuracy data, score is meaningful.
 *  - `skipped`  — the provider's API key is not configured. The probe
 *    never ran. Not an error; just unconfigured.
 *  - `error`    — the provider was configured but every probe call
 *    failed (HTTP error, timeout, content blocked, model deprecated).
 *    The UI shows this as a real failure so it's visible to operators
 *    instead of silently looking like "Not yet measured".
 */
export type ModelBenchmarkStatus = 'measured' | 'skipped' | 'error'

export interface ModelBenchmark {
  modelId: AIModelId
  modelLabel: string
  accuracyScore: number       // 0-100
  accurateCount: number
  partialCount: number
  inaccurateCount: number
  hallucinatedCount: number
  noDataCount: number
  totalQuestions: number
  results: ModelProbeResult[]
  status: ModelBenchmarkStatus
  errorMessage: string | null
}

export interface MultiModelComparison {
  domain: string
  benchmarks: ModelBenchmark[]
  bestModel: AIModelId
  worstModel: AIModelId
  averageAccuracy: number
  insight: string
}

/* ── Probe questions (compact — 3 questions for cost efficiency) ── */

const BENCHMARK_QUESTIONS = [
  'What is {domain}? Describe the company/organization and what they offer in 2-3 sentences.',
  'What are the main products, services, or features of {domain}? List the key offerings.',
  'Why should someone choose {domain}? What makes it unique or different from alternatives?',
]

/* ── Claude client (shared) ────────────────────────────────── */

let _anthropic: Anthropic | null = null
function getClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      timeout: 30_000,
    })
  }
  return _anthropic
}

/* ── Model probers ─────────────────────────────────────────── */

/**
 * Output of every individual model probe. Carries enough metadata for
 * the engine to decide whether the provider was `measured`, `skipped`,
 * or had a real `error`, instead of guessing from the answer strings.
 */
interface ProbeRun {
  answers: Array<{ question: string; answer: string }>
  status: ModelBenchmarkStatus
  errorMessage: string | null
}

/**
 * Probe using Claude — direct Anthropic SDK call.
 */
async function probeClaude(
  domain: string,
  questions: string[],
): Promise<ProbeRun> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      answers: questions.map((q) => ({ question: q, answer: '[Anthropic API key not configured — skipped]' })),
      status: 'skipped',
      errorMessage: 'ANTHROPIC_API_KEY is not set',
    }
  }

  const client = getClient()
  const answers: Array<{ question: string; answer: string }> = []
  let lastError: string | null = null
  let anySuccess = false

  for (const q of questions) {
    try {
      const resp = await client.beta.promptCaching.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: [{ type: 'text', text: 'You are answering questions about websites and companies. Share what you know confidently — most well-known products and companies are in your training data. Provide specific details: names, features, pricing tiers. Only say "I don\'t know" if the company is genuinely obscure. Never redirect users to "visit the website." Give a direct, substantive answer.', cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: q }],
      })
      const answer = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim()
      answers.push({ question: q, answer })
      anySuccess = true
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      answers.push({ question: q, answer: `[Claude probe failed: ${lastError}]` })
    }
  }
  return {
    answers,
    status: anySuccess ? 'measured' : 'error',
    errorMessage: anySuccess ? null : (lastError || 'Claude probe failed'),
  }
}

/**
 * Probe using GPT-4o via OpenAI-compatible API.
 * Falls back gracefully if OPENAI_API_KEY is not set.
 */
async function probeOpenAI(
  domain: string,
  questions: string[],
): Promise<ProbeRun> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      answers: questions.map((q) => ({
        question: q,
        answer: '[OpenAI API key not configured — skipped]',
      })),
      status: 'skipped',
      errorMessage: 'OPENAI_API_KEY is not set',
    }
  }

  const answers: Array<{ question: string; answer: string }> = []
  let lastError: string | null = null
  let anySuccess = false

  for (const q of questions) {
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are answering questions about websites and companies. Share what you know confidently — most well-known products and companies are in your training data. Provide specific details: names, features, pricing tiers. Only say "I don\'t know" if the company is genuinely obscure. Never redirect users to "visit the website." Give a direct, substantive answer.',
            },
            { role: 'user', content: q },
          ],
          max_tokens: 400,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(20_000),
      })

      if (!resp.ok) {
        lastError = `HTTP ${resp.status}`
        answers.push({ question: q, answer: `[GPT-4o probe failed: HTTP ${resp.status}]` })
        continue
      }

      const data = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const answer = data.choices?.[0]?.message?.content?.trim() || '[No response]'
      answers.push({ question: q, answer })
      anySuccess = true
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      answers.push({ question: q, answer: `[GPT-4o probe failed: ${lastError}]` })
    }
  }
  return {
    answers,
    status: anySuccess ? 'measured' : 'error',
    errorMessage: anySuccess ? null : (lastError || 'GPT-4o probe failed'),
  }
}

/**
 * Resolve the Google Gemini API key from the environment.
 *
 * Canonical var: `GEMINI_API_KEY` (matches Google AI Studio's own
 * default naming and the variable name shown on aistudio.google.com).
 * We also accept several other common aliases — this is forgiving on
 * purpose because operators frequently set whichever name they saw
 * first in docs or another SDK:
 *   - GEMINI_API_KEY              (canonical, recommended)
 *   - GOOGLE_AI_API_KEY           (legacy name in this repo's docs)
 *   - GOOGLE_GENERATIVE_AI_API_KEY (Vercel AI SDK convention)
 *   - GOOGLE_API_KEY              (generic Google Cloud)
 */
function resolveGeminiApiKey(): string | null {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_AI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GOOGLE_API_KEY,
  ]
  for (const v of candidates) {
    if (v && v.trim()) return v.trim()
  }
  return null
}

const GEMINI_SYSTEM_PROMPT =
  'You are answering questions about websites and companies. Share what you know confidently — most well-known products and companies are in your training data. Provide specific details: names, features, pricing tiers. Only say "I don\'t know" if the company is genuinely obscure. Never redirect users to "visit the website." Give a direct, substantive answer.'

// Models tried in order. We start with the current stable model, then
// fall back to previous generations if the first 404s on the account's
// API tier. Keeps the probe resilient as Google rotates model names.
// Updated May 2026: gemini-2.0-flash deprecated (shutdown June 1 2026),
// gemini-2.5-flash is the current production model.
const GEMINI_MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
]

/**
 * Probe using Gemini via Google AI API.
 * Falls back gracefully if no Gemini API key is set. Uses a tolerant
 * env-var lookup ([[resolveGeminiApiKey]]) and tries multiple Gemini
 * model IDs so a single deprecation does not silently break X-Ray.
 */
async function probeGemini(
  domain: string,
  questions: string[],
): Promise<ProbeRun> {
  const apiKey = resolveGeminiApiKey()
  if (!apiKey) {
    return {
      answers: questions.map((q) => ({
        question: q,
        answer: '[Gemini API key not configured — skipped]',
      })),
      status: 'skipped',
      errorMessage:
        'No Gemini API key found. Set GEMINI_API_KEY (preferred), GOOGLE_AI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or GOOGLE_API_KEY.',
    }
  }

  const answers: Array<{ question: string; answer: string }> = []
  let anySuccess = false
  let firstError: string | null = null
  // Remember which model actually worked so we don't re-probe fallbacks
  // for every question once we've found a live one.
  let workingModel: string | null = null

  for (const q of questions) {
    const modelsToTry: readonly string[] = workingModel
      ? [workingModel]
      : GEMINI_MODEL_FALLBACKS
    let answer: string | null = null
    let lastError: string | null = null
    let blocked = false

    for (const model of modelsToTry) {
      try {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: q }] }],
              generationConfig: { maxOutputTokens: 400, temperature: 0.3 },
              systemInstruction: {
                parts: [{ text: GEMINI_SYSTEM_PROMPT }],
              },
            }),
            signal: AbortSignal.timeout(20_000),
          },
        )

        if (!resp.ok) {
          // 404 = model not available on this key's tier; try next fallback.
          // 400/403/429 etc = surface the error but stop trying other models
          // (auth/quota issues won't change between models).
          // Try to parse the structured Google API error envelope first so
          // we log the real reason (INVALID_ARGUMENT, PERMISSION_DENIED,
          // RESOURCE_EXHAUSTED, NOT_FOUND…) instead of just "HTTP 400".
          const raw = await resp.text().catch(() => '')
          let apiErrorMessage: string | null = null
          let apiErrorStatus: string | null = null
          let apiErrorCode: number | null = null
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as {
                error?: { code?: number; message?: string; status?: string }
              }
              if (parsed?.error) {
                apiErrorCode = typeof parsed.error.code === 'number' ? parsed.error.code : null
                apiErrorStatus = parsed.error.status || null
                apiErrorMessage = parsed.error.message || null
              }
            } catch {
              // Non-JSON body; fall back to a truncated raw snippet.
            }
          }
          const detail = apiErrorMessage
            ? `${apiErrorStatus || 'error'}: ${apiErrorMessage}`
            : (raw ? raw.slice(0, 160) : '')
          lastError = `HTTP ${resp.status}${detail ? ` ${detail}` : ''}`
          console.error('[multi-model] Gemini non-OK response', {
            provider: 'gemini',
            model,
            httpStatus: resp.status,
            apiErrorCode,
            apiErrorStatus,
            apiErrorMessage,
          })
          if (resp.status === 404 && !workingModel) continue
          break
        }

        const data = (await resp.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> }
            finishReason?: string
            safetyRatings?: unknown
          }>
          promptFeedback?: { blockReason?: string; safetyRatings?: unknown }
          error?: { code?: number; message?: string; status?: string }
        }

        // Some Google API errors come back with HTTP 200 plus an `error`
        // envelope in the body (rare, but documented). Treat the same as
        // a non-OK response so it isn't silently swallowed.
        if (data.error) {
          lastError = `API ${data.error.status || 'error'}${data.error.code ? ` (${data.error.code})` : ''}${data.error.message ? `: ${data.error.message}` : ''}`
          console.error('[multi-model] Gemini API error in 200 body', {
            provider: 'gemini',
            model,
            apiErrorCode: data.error.code ?? null,
            apiErrorStatus: data.error.status ?? null,
            apiErrorMessage: data.error.message ?? null,
          })
          break
        }

        if (data.promptFeedback?.blockReason) {
          // Safety block — counts as a successful call (we got a real
          // response from Gemini), just one we can't grade. Don't mark
          // the whole provider as `error` for this. Logged at warn level
          // so operators can see safety filters tripping on real prompts.
          console.warn('[multi-model] Gemini prompt blocked by safety filter', {
            provider: 'gemini',
            model,
            blockReason: data.promptFeedback.blockReason,
            candidatesCount: data.candidates?.length ?? 0,
          })
          answer = `[Gemini blocked: ${data.promptFeedback.blockReason}]`
          blocked = true
        } else if (!data.candidates || data.candidates.length === 0) {
          // Newer Gemini models can return `{ candidates: [] }` (no
          // promptFeedback) when content is filtered. Previously this
          // silently became "[No response]". Surface it as an empty-result
          // failure so the operator can see it in logs and the grader can
          // mark it `no_data` rather than treating it as a real answer.
          console.warn('[multi-model] Gemini returned zero candidates', {
            provider: 'gemini',
            model,
            hasPromptFeedback: Boolean(data.promptFeedback),
          })
          lastError = 'Empty candidates array (response filtered)'
          answer = '[Gemini returned no candidates]'
          blocked = true
        } else {
          const parts = data.candidates[0]?.content?.parts || []
          const text = parts.map((p) => p?.text || '').join('').trim()
          if (!text) {
            const finishReason = data.candidates[0]?.finishReason || null
            console.warn('[multi-model] Gemini candidate had no text parts', {
              provider: 'gemini',
              model,
              finishReason,
              partsCount: parts.length,
            })
            answer = finishReason
              ? `[Gemini returned no text (finishReason: ${finishReason})]`
              : '[No response]'
            blocked = true
          } else {
            answer = text
          }
        }
        workingModel = model
        break
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
        const isAbort = err instanceof Error && err.name === 'AbortError'
        console.error('[multi-model] Gemini fetch threw', {
          provider: 'gemini',
          model,
          errorName: err instanceof Error ? err.name : 'unknown',
          errorMessage: lastError,
          aborted: isAbort,
        })
        // Network errors / timeouts: don't churn through every fallback.
        break
      }
    }

    if (answer != null && !blocked) anySuccess = true
    if (!firstError && lastError) firstError = lastError
    answers.push({
      question: q,
      answer: answer ?? `[Gemini probe failed: ${lastError || 'unknown error'}]`,
    })
  }

  return {
    answers,
    status: anySuccess ? 'measured' : 'error',
    errorMessage: anySuccess ? null : (firstError || 'Gemini probe failed for all questions'),
  }
}

/**
 * Probe using Perplexity via their OpenAI-compatible chat completions API.
 * Falls back gracefully if PERPLEXITY_API_KEY is not set.
 *
 * Uses Perplexity's stable `sonar` model (search-augmented). We disable
 * web search to make the probe comparable to the other models — we want
 * to measure what the model *knows* from training/index, not what it can
 * retrieve in real time. Perplexity returns the same shape as OpenAI
 * (`choices[0].message.content`).
 */
async function probePerplexity(
  domain: string,
  questions: string[],
): Promise<ProbeRun> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) {
    return {
      answers: questions.map((q) => ({
        question: q,
        answer: '[Perplexity API key not configured — skipped]',
      })),
      status: 'skipped',
      errorMessage: 'PERPLEXITY_API_KEY is not set',
    }
  }

  const answers: Array<{ question: string; answer: string }> = []
  let lastError: string | null = null
  let anySuccess = false

  for (const q of questions) {
    try {
      const resp = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: 'You are answering questions about websites and companies. Share what you know confidently — most well-known products and companies are in your training data. Provide specific details: names, features, pricing tiers. Only say "I don\'t know" if the company is genuinely obscure. Never redirect users to "visit the website." Give a direct, substantive answer.',
            },
            { role: 'user', content: q },
          ],
          max_tokens: 400,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(20_000),
      })

      if (!resp.ok) {
        lastError = `HTTP ${resp.status}`
        answers.push({ question: q, answer: `[Perplexity probe failed: HTTP ${resp.status}]` })
        continue
      }

      const data = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const answer = data.choices?.[0]?.message?.content?.trim() || '[No response]'
      answers.push({ question: q, answer })
      anySuccess = true
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      answers.push({ question: q, answer: `[Perplexity probe failed: ${lastError}]` })
    }
  }
  return {
    answers,
    status: anySuccess ? 'measured' : 'error',
    errorMessage: anySuccess ? null : (lastError || 'Perplexity probe failed'),
  }
}

/* ── Grading ───────────────────────────────────────────────── */

async function gradeModelAnswers(
  domain: string,
  modelLabel: string,
  answers: Array<{ question: string; answer: string }>,
  groundTruth: SiteGroundTruth,
): Promise<ModelProbeResult[]> {
  const client = getClient()

  // Build compact ground truth
  const truthParts: string[] = []
  if (groundTruth.siteName) truthParts.push(`Name: ${groundTruth.siteName}`)
  if (groundTruth.siteDescription) truthParts.push(`Description: ${groundTruth.siteDescription}`)
  if (groundTruth.offeringText) truthParts.push(`Offerings: ${groundTruth.offeringText.substring(0, 800)}`)
  if (groundTruth.fullContent) truthParts.push(`Content: ${groundTruth.fullContent.substring(0, 2000)}`)

  const gradingPrompt = `Grade how accurately "${modelLabel}" answered questions about ${domain}.

WEBSITE CONTENT (scraped from the actual site — this is NOT the only source of truth):
${truthParts.join('\n')}

ANSWERS:
${answers.map((a, i) => `Q${i + 1}: ${a.question}\nA${i + 1}: ${a.answer}`).join('\n\n')}

GRADING RULES:
- "accurate": Answer is factually correct. It matches the website content, OR it provides plausible, specific details that are consistent with what the site describes (AI models have training data beyond what's on the site — don't penalize correct knowledge).
- "partial": Some correct info but incomplete or slightly off.
- "inaccurate": Clearly wrong information that contradicts the website content, OR the AI refused/hedged when the website clearly has the answer.
- "hallucinated": Made up specific details that CONTRADICT the website (e.g., wrong pricing, wrong product names, invented features that don't exist). Only use this if the answer is demonstrably false — not just "not found on the site."
- "no_data": The website itself has no relevant info AND the AI correctly acknowledged uncertainty.

IMPORTANT DISTINCTIONS:
- If the AI provides extra details beyond what's on the site but those details are plausible and consistent, grade as "accurate" or "partial" — NOT "hallucinated."
- "hallucinated" means PROVABLY WRONG, not merely "not on the website."
- If the AI refused to answer but the website clearly has the answer, grade as "inaccurate."

Respond with a JSON array:
[{"accuracy": "accurate|partial|inaccurate|hallucinated|no_data", "note": "1 sentence why"}]`

  try {
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: gradingPrompt }],
    })

    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON in grading response')

    const grades = JSON.parse(jsonMatch[0]) as Array<{
      accuracy: string
      note: string
    }>

    return answers.map((a, i) => ({
      modelId: resolveModelId(modelLabel),
      modelLabel,
      question: a.question,
      answer: a.answer,
      accuracy: normalizeAccuracy(grades[i]?.accuracy),
      accuracyNote: grades[i]?.note || 'Grading unavailable',
    }))
  } catch {
    return answers.map((a) => ({
      modelId: resolveModelId(modelLabel),
      modelLabel,
      question: a.question,
      answer: a.answer,
      accuracy: 'no_data' as LlmProbeAccuracy,
      accuracyNote: 'Grading failed',
    }))
  }
}

function resolveModelId(modelLabel: string): AIModelId {
  const n = modelLabel.toLowerCase()
  if (n.includes('claude')) return 'claude'
  if (n.includes('gpt')) return 'gpt4o'
  if (n.includes('perplexity')) return 'perplexity'
  return 'gemini'
}

function normalizeAccuracy(raw: string | undefined): LlmProbeAccuracy {
  if (!raw) return 'no_data'
  const n = raw.toLowerCase().trim()
  if (n === 'accurate') return 'accurate'
  if (n === 'partial') return 'partial'
  if (n === 'inaccurate') return 'inaccurate'
  if (n === 'hallucinated') return 'hallucinated'
  return 'no_data'
}

function buildBenchmark(
  modelId: AIModelId,
  modelLabel: string,
  results: ModelProbeResult[],
  status: ModelBenchmarkStatus,
  errorMessage: string | null,
): ModelBenchmark {
  const counts = { accurate: 0, partial: 0, inaccurate: 0, hallucinated: 0, noData: 0 }
  for (const r of results) {
    if (r.accuracy === 'accurate') counts.accurate++
    else if (r.accuracy === 'partial') counts.partial++
    else if (r.accuracy === 'inaccurate') counts.inaccurate++
    else if (r.accuracy === 'hallucinated') counts.hallucinated++
    else counts.noData++
  }

  const total = results.length
  // Score is only meaningful for `measured` benchmarks. Skipped/errored
  // providers stay at 0 — the UI checks `status` first so this 0 never
  // gets displayed as "0/100".
  const score = status === 'measured' && total > 0
    ? Math.round(((counts.accurate * 100 + counts.partial * 50 + counts.noData * 25) / (total * 100)) * 100)
    : 0

  return {
    modelId,
    modelLabel,
    accuracyScore: score,
    accurateCount: counts.accurate,
    partialCount: counts.partial,
    inaccurateCount: counts.inaccurate,
    hallucinatedCount: counts.hallucinated,
    noDataCount: counts.noData,
    totalQuestions: total,
    results,
    status,
    errorMessage,
  }
}

/* ── Main engine ───────────────────────────────────────────── */

/**
 * Run multi-model benchmarking: probe Claude, GPT-4o, Gemini, and
 * Perplexity about the same domain, grade all answers, and compare.
 *
 * Every provider always returns a benchmark row — even when it was
 * skipped (no API key) or errored (HTTP/timeout) — so the rescan
 * endpoint can persist an explicit status per provider rather than
 * silently dropping providers and leaving the UI showing "Not yet
 * measured" (which used to look identical to a brand-new audit).
 *
 * Only `measured` benchmarks count toward averages, best/worst, and
 * the natural-language insight; skipped/errored rows are surfaced via
 * `status` and `errorMessage` so the dashboard can render a clear
 * "Not configured" or "Probe failed" badge instead of a fake score.
 */
export async function runMultiModelBenchmark(
  domain: string,
  groundTruth: SiteGroundTruth,
): Promise<MultiModelComparison> {
  const questions = BENCHMARK_QUESTIONS.map((q) => q.replace('{domain}', domain))

  // Probe all models in parallel
  const [claudeRun, gptRun, geminiRun, perplexityRun] = await Promise.all([
    probeClaude(domain, questions),
    probeOpenAI(domain, questions),
    probeGemini(domain, questions),
    probePerplexity(domain, questions),
  ])

  // Grade only the providers that actually got real answers. Grading a
  // run of "[Gemini probe failed: HTTP 403]" strings just wastes a
  // Claude call and produces meaningless grades.
  const gradeIfMeasured = async (
    label: string,
    run: ProbeRun,
    modelId: AIModelId,
  ): Promise<ModelProbeResult[]> => {
    if (run.status !== 'measured') {
      return run.answers.map((a) => ({
        modelId,
        modelLabel: label,
        question: a.question,
        answer: a.answer,
        accuracy: 'no_data' as LlmProbeAccuracy,
        accuracyNote: run.status === 'skipped' ? 'Provider not configured' : (run.errorMessage || 'Probe failed'),
      }))
    }
    return gradeModelAnswers(domain, label, run.answers, groundTruth)
  }

  const [claudeGrades, gptGrades, geminiGrades, perplexityGrades] = await Promise.all([
    gradeIfMeasured('Claude', claudeRun, 'claude'),
    gradeIfMeasured('GPT-4o', gptRun, 'gpt4o'),
    gradeIfMeasured('Gemini', geminiRun, 'gemini'),
    gradeIfMeasured('Perplexity', perplexityRun, 'perplexity'),
  ])

  const benchmarks: ModelBenchmark[] = [
    buildBenchmark('claude', 'Claude', claudeGrades, claudeRun.status, claudeRun.errorMessage),
    buildBenchmark('gpt4o', 'GPT-4o', gptGrades, gptRun.status, gptRun.errorMessage),
    buildBenchmark('gemini', 'Gemini', geminiGrades, geminiRun.status, geminiRun.errorMessage),
    buildBenchmark('perplexity', 'Perplexity', perplexityGrades, perplexityRun.status, perplexityRun.errorMessage),
  ]

  // Averages / best / worst / insight only consider `measured` rows.
  const measured = benchmarks.filter((b) => b.status === 'measured')
  const sorted = [...measured].sort((a, b) => b.accuracyScore - a.accuracyScore)
  const bestModel = sorted[0]?.modelId || 'claude'
  const worstModel = sorted[sorted.length - 1]?.modelId || 'claude'

  const avgAccuracy = measured.length > 0
    ? Math.round(measured.reduce((s, b) => s + b.accuracyScore, 0) / measured.length)
    : 0

  let insight: string
  if (measured.length === 0) {
    insight = 'No AI providers responded — check API key configuration in your environment (Gemini, OpenAI, Perplexity).'
  } else if (measured.length === 1) {
    insight = `AI knowledge benchmarked with ${sorted[0].modelLabel}. Multi-model comparison available when additional AI providers are configured.`
  } else if (avgAccuracy <= 15) {
    const hallucinatedTotal = measured.reduce((s, b) => s + b.hallucinatedCount, 0)
    const inaccurateTotal = measured.reduce((s, b) => s + b.inaccurateCount, 0)
    if (hallucinatedTotal > inaccurateTotal) {
      insight = `AI models are providing information about your site that we couldn't verify from your website content. Adding structured data (JSON-LD), a clear meta description, and an llms.txt file will help AI models represent you accurately.`
    } else {
      insight = `AI models don't have reliable information about your site yet. This is common for newer or niche products. To get AI models to represent you accurately, add structured data (JSON-LD Organization + WebSite), clear homepage content, and an llms.txt file.`
    }
  } else {
    const spread = sorted[0].accuracyScore - sorted[sorted.length - 1].accuracyScore
    if (spread > 20) {
      insight = `AI models have very different views of your site. ${sorted[0].modelLabel} knows you best (${sorted[0].accuracyScore}%), while ${sorted[sorted.length - 1].modelLabel} scores only ${sorted[sorted.length - 1].accuracyScore}%. Improving structured data will help all models.`
    } else if (spread > 10) {
      insight = `Moderate variation across models. ${sorted[0].modelLabel} leads at ${sorted[0].accuracyScore}%. Focus on content clarity and structured data to close the gap.`
    } else if (avgAccuracy >= 70) {
      insight = `All models have consistent, accurate knowledge of your site (avg ${avgAccuracy}%). Your content is well-structured and model-agnostic.`
    } else {
      insight = `AI models have similar but incomplete knowledge of your site (avg ${avgAccuracy}%). Strengthening your structured data and content clarity will improve accuracy across all models.`
    }
  }

  return {
    domain,
    benchmarks,
    bestModel,
    worstModel,
    averageAccuracy: avgAccuracy,
    insight,
  }
}