// ============================================================
// ClearUX Audit Engine — Multi-Model AI Benchmarking
// ============================================================
// Probes multiple AI models about the audited domain and compares
// their knowledge/accuracy. Now routes all non-Claude models
// through OpenRouter for a single-gateway architecture.
//
// Claude stays on the direct Anthropic SDK (prompt caching).
// All other models go through openRouterChat().
//
// PROPRIETARY — do not distribute outside the ClearUX codebase.
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import type { LlmProbeAccuracy } from '@/types/database'
import type { SiteGroundTruth } from './llm-probe'
import { openRouterChat, isOpenRouterConfigured } from '@/lib/ai/openrouter-client'
import {
  DEFAULT_MODEL_CATALOG,
  findModelBySlug,
  type AIModelDef,
} from '@/lib/ai/model-catalog'

/* ── Types ──────────────────────────────────────────────────── */

/** Model ID is now a string (dynamic) to support user-enabled models */
export type AIModelId = string

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
 *  - `measured` — the provider answered at least one question.
 *  - `skipped`  — the provider's API key is not configured.
 *  - `error`    — the provider was configured but every probe failed.
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

/* ── Fallback questions (used when no workspace shortlist is available) ── */

const FALLBACK_BENCHMARK_QUESTIONS = [
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

/** Retry an async function with exponential backoff */
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
        console.warn(`[${label}] Attempt ${attempt + 1} failed (${isRateLimit ? 'rate limit' : 'timeout'}), retrying in ${Math.round(delay)}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}

/* ── Model probers ─────────────────────────────────────────── */

interface ProbeRun {
  answers: Array<{ question: string; answer: string }>
  status: ModelBenchmarkStatus
  errorMessage: string | null
}

const SYSTEM_PROMPT =
  'You are answering questions about websites and companies. Share what you know confidently — most well-known products and companies are in your training data. Provide specific details: names, features, pricing tiers. Only say "I don\'t know" if the company is genuinely obscure. Never redirect users to "visit the website." Give a direct, substantive answer.'

/**
 * Probe using Claude — direct Anthropic SDK call.
 * Stays on direct SDK for prompt caching support.
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
      const resp = await withRetry(
        () => client.beta.promptCaching.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          temperature: 0,
          system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: q }],
        }),
        `multi-model-claude(${q.substring(0, 40)})`,
      )
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
 * Probe using any non-Claude model via OpenRouter.
 * Replaces the old provider-specific probeOpenAI, probeGemini, probePerplexity.
 */
async function probeViaOpenRouter(
  modelDef: AIModelDef,
  questions: string[],
): Promise<ProbeRun> {
  if (!isOpenRouterConfigured()) {
    return {
      answers: questions.map((q) => ({
        question: q,
        answer: `[OpenRouter API key not configured — ${modelDef.displayName} skipped]`,
      })),
      status: 'skipped',
      errorMessage: 'OPENROUTER_API_KEY is not set',
    }
  }

  const answers: Array<{ question: string; answer: string }> = []
  let lastError: string | null = null
  let anySuccess = false

  for (const q of questions) {
    try {
      const result = await openRouterChat({
        model: modelDef.slug,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: q },
        ],
        maxTokens: 400,
        temperature: 0,
        timeoutMs: 20_000,
      })
      answers.push({ question: q, answer: result.content || '[No response]' })
      anySuccess = true
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      answers.push({ question: q, answer: `[${modelDef.displayName} probe failed: ${lastError}]` })
    }
  }

  return {
    answers,
    status: anySuccess ? 'measured' : 'error',
    errorMessage: anySuccess ? null : (lastError || `${modelDef.displayName} probe failed`),
  }
}

/* ── Grading ───────────────────────────────────────────────── */

async function gradeModelAnswers(
  domain: string,
  modelLabel: string,
  modelId: string,
  answers: Array<{ question: string; answer: string }>,
  groundTruth: SiteGroundTruth,
): Promise<ModelProbeResult[]> {
  const client = getClient()

  const truthParts: string[] = []
  if (groundTruth.siteName) truthParts.push(`Name: ${groundTruth.siteName}`)
  if (groundTruth.siteDescription) truthParts.push(`Description: ${groundTruth.siteDescription}`)
  if (groundTruth.offeringText) truthParts.push(`Offerings: ${groundTruth.offeringText.substring(0, 800)}`)
  if (groundTruth.fullContent) truthParts.push(`Content: ${groundTruth.fullContent.substring(0, 2000)}`)

  const gradingPrompt = `Grade how accurately "${modelLabel}" answered questions about ${domain}.

WEBSITE CONTENT (scraped from the actual site — use as reference, not as the ONLY truth):
${truthParts.join('\n')}

ANSWERS:
${answers.map((a, i) => `Q${i + 1}: ${a.question}\nA${i + 1}: ${a.answer}`).join('\n\n')}

GRADING RULES (apply in order — use the FIRST one that fits):
1. "accurate": Answer is factually correct and substantive. It matches the website content, OR it provides plausible, specific details consistent with what the site describes. If the answer correctly conveys what the company does, its products/services, or its value proposition — even with different wording — grade as accurate.
2. "partial": Some correct info but incomplete, vague, or slightly off. The AI knows the brand exists and provides SOME real details, but is missing key aspects or includes minor inaccuracies.
3. "no_data": The AI honestly admitted it doesn't know or doesn't have information about this brand/company. This includes phrases like "I'm not familiar with", "I don't have information about", "I cannot find", or similar hedging/refusals. Also use this when the website itself has no relevant info for the question.
4. "inaccurate": The AI gave specific information that is WRONG — it claimed the company does something it doesn't, described wrong products, or stated incorrect facts. Only use this when the answer contains concrete claims that contradict the website content.
5. "hallucinated": The AI invented specific details that are PROVABLY FALSE (e.g., wrong pricing, fabricated product names, invented features that don't exist on the site). This is worse than inaccurate — it requires demonstrably fabricated specifics.

CRITICAL DISTINCTIONS:
- An AI saying "I don't know about this brand" is "no_data", NOT "inaccurate". Honest uncertainty is neutral.
- An AI giving a generic/vague answer that's mostly consistent with the site is "partial", NOT "inaccurate".
- Extra details beyond what's on the site that are plausible and consistent = "accurate" or "partial", NOT "hallucinated".
- "hallucinated" means PROVABLY WRONG with fabricated specifics, not merely "not on the website".
- Grade generously when the answer captures the spirit of what the brand does, even if the exact wording differs.

Respond with a JSON array:
[{"accuracy": "accurate|partial|inaccurate|hallucinated|no_data", "note": "1 sentence why"}]`

  try {
    const resp = await withRetry(
      () => client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        temperature: 0,
        messages: [{ role: 'user', content: gradingPrompt }],
      }),
      `multi-model-grading(${modelLabel})`,
    )

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
      modelId,
      modelLabel,
      question: a.question,
      answer: a.answer,
      accuracy: normalizeAccuracy(grades[i]?.accuracy),
      accuracyNote: grades[i]?.note || 'Grading unavailable',
    }))
  } catch {
    return answers.map((a) => ({
      modelId,
      modelLabel,
      question: a.question,
      answer: a.answer,
      accuracy: 'no_data' as LlmProbeAccuracy,
      accuracyNote: 'Grading failed',
    }))
  }
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
 * Run multi-model benchmarking: probe Claude + all enabled models
 * about the same domain, grade all answers, and compare.
 *
 * @param enabledModels Optional list of OpenRouter model slugs to
 *   probe (from user settings). If not provided, uses the default
 *   catalog with defaultEnabled: true.
 * @param benchmarkQuestions Optional list of category-specific questions
 *   from the workspace shortlist (Top 10). When provided, these replace
 *   the generic fallback questions and become the scoring basis.
 *   Questions should already have {business} interpolated but may still
 *   contain {domain} placeholders.
 */
export async function runMultiModelBenchmark(
  domain: string,
  groundTruth: SiteGroundTruth,
  enabledModels?: string[],
  benchmarkQuestions?: string[],
): Promise<MultiModelComparison> {
  const rawQuestions = benchmarkQuestions && benchmarkQuestions.length > 0
    ? benchmarkQuestions
    : FALLBACK_BENCHMARK_QUESTIONS
  const questions = rawQuestions.map((q) => q.replace('{domain}', domain))

  // Determine which non-Claude models to probe
  const modelsToProbe: AIModelDef[] = enabledModels
    ? enabledModels
        .map((slug) => findModelBySlug(slug))
        .filter((m): m is AIModelDef => m != null)
    : DEFAULT_MODEL_CATALOG.filter((m) => m.defaultEnabled)

  // Probe all models in parallel: Claude direct + OpenRouter models.
  // Each model probe gets its own 45s timeout so one hanging model
  // doesn't block the entire benchmark. Promise.allSettled ensures
  // we get results from every model that finishes in time.
  const PER_MODEL_TIMEOUT = 45_000

  const wrapWithTimeout = <T>(promise: Promise<T>, label: string): Promise<T> => {
    let timer: ReturnType<typeof setTimeout>
    return Promise.race([
      promise.then(v => { clearTimeout(timer); return v }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${PER_MODEL_TIMEOUT}ms`)), PER_MODEL_TIMEOUT)
      }),
    ])
  }

  const timedOutProbe = (label: string, qs: string[]): ProbeRun => ({
    answers: qs.map(q => ({ question: q, answer: `[${label} timed out]` })),
    status: 'error',
    errorMessage: `${label} exceeded ${PER_MODEL_TIMEOUT / 1000}s timeout`,
  })

  const claudePromise = wrapWithTimeout(probeClaude(domain, questions), 'Claude')
  const openRouterPromises = modelsToProbe.map((modelDef) =>
    wrapWithTimeout(
      probeViaOpenRouter(modelDef, questions).then((run) => ({ modelDef, run })),
      modelDef.displayName,
    ),
  )

  const settled = await Promise.allSettled([claudePromise, ...openRouterPromises])

  const claudeRun: ProbeRun = settled[0].status === 'fulfilled'
    ? settled[0].value
    : timedOutProbe('Claude', questions)

  const openRouterResults = settled.slice(1).map((r, i) => {
    if (r.status === 'fulfilled') return r.value as { modelDef: AIModelDef; run: ProbeRun }
    console.warn(`[multi-model] ${modelsToProbe[i].displayName} probe timed out`)
    return { modelDef: modelsToProbe[i], run: timedOutProbe(modelsToProbe[i].displayName, questions) }
  })

  // Grade only providers that actually got real answers
  const gradeIfMeasured = async (
    label: string,
    modelId: string,
    run: ProbeRun,
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
    return gradeModelAnswers(domain, label, modelId, run.answers, groundTruth)
  }

  // Grade Claude
  const claudeGradesPromise = gradeIfMeasured('Claude', 'claude', claudeRun)

  // Grade all OpenRouter models
  const openRouterGradePromises = openRouterResults.map(({ modelDef, run }) =>
    gradeIfMeasured(modelDef.displayName, modelDef.shortId, run).then((grades) => ({
      modelDef,
      run,
      grades,
    })),
  )

  const gradingSettled = await Promise.allSettled([
    wrapWithTimeout(claudeGradesPromise, 'grade-Claude'),
    ...openRouterGradePromises.map((p, i) =>
      wrapWithTimeout(p, `grade-${modelsToProbe[i]?.displayName || i}`),
    ),
  ])

  const emptyGrades = (modelId: string, label: string, qs: string[]): ModelProbeResult[] =>
    qs.map(q => ({
      modelId, modelLabel: label, question: q, answer: '[grading timed out]',
      accuracy: 'no_data' as LlmProbeAccuracy, accuracyNote: 'Grading timed out',
    }))

  const claudeGrades: ModelProbeResult[] = gradingSettled[0].status === 'fulfilled'
    ? gradingSettled[0].value
    : emptyGrades('claude', 'Claude', questions)

  const openRouterGraded = gradingSettled.slice(1).map((r, i) => {
    const { modelDef, run } = openRouterResults[i]
    if (r.status === 'fulfilled') {
      // r.value is { modelDef, run, grades } from the .then() mapper — extract grades
      const fulfilled = r.value as { modelDef: AIModelDef; run: ProbeRun; grades: ModelProbeResult[] }
      return { modelDef, run, grades: fulfilled.grades }
    }
    console.warn(`[multi-model] Grading ${modelDef.displayName} timed out`)
    return { modelDef, run, grades: emptyGrades(modelDef.shortId, modelDef.displayName, questions) }
  })

  // Build benchmarks
  const benchmarks: ModelBenchmark[] = [
    buildBenchmark('claude', 'Claude', claudeGrades, claudeRun.status, claudeRun.errorMessage),
    ...openRouterGraded.map(({ modelDef, run, grades }) =>
      buildBenchmark(modelDef.shortId, modelDef.displayName, grades, run.status, run.errorMessage),
    ),
  ]

  // Averages / best / worst / insight only consider `measured` rows
  const measured = benchmarks.filter((b) => b.status === 'measured')
  const sorted = [...measured].sort((a, b) => b.accuracyScore - a.accuracyScore)
  const bestModel = sorted[0]?.modelId || 'claude'
  const worstModel = sorted[sorted.length - 1]?.modelId || 'claude'

  const avgAccuracy = measured.length > 0
    ? Math.round(measured.reduce((s, b) => s + b.accuracyScore, 0) / measured.length)
    : 0

  let insight: string
  if (measured.length === 0) {
    insight = 'No AI providers responded — check API key configuration in your environment.'
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
