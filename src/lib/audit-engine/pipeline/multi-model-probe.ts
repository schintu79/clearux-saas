// ============================================================
// ClearUX Audit Engine — Multi-Model AI Benchmarking
// ============================================================
// Probes multiple AI models (Claude, GPT-4o, Gemini) about the
// audited domain and compares their knowledge/accuracy.
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

export type AIModelId = 'claude' | 'gpt4o' | 'gemini'

export interface ModelProbeResult {
  modelId: AIModelId
  modelLabel: string
  question: string
  answer: string
  accuracy: LlmProbeAccuracy
  accuracyNote: string
}

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
 * Probe using Claude — direct Anthropic SDK call.
 */
async function probeClaude(
  domain: string,
  questions: string[],
): Promise<Array<{ question: string; answer: string }>> {
  const client = getClient()
  const results: Array<{ question: string; answer: string }> = []

  for (const q of questions) {
    try {
      const resp = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: 'You are answering questions about websites and companies. Share what you know confidently — most well-known products and companies are in your training data. Provide specific details: names, features, pricing tiers. Only say "I don\'t know" if the company is genuinely obscure. Never redirect users to "visit the website." Give a direct, substantive answer.',
        messages: [{ role: 'user', content: q }],
      })
      const answer = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim()
      results.push({ question: q, answer })
    } catch {
      results.push({ question: q, answer: '[Probe failed]' })
    }
  }
  return results
}

/**
 * Probe using GPT-4o via OpenAI-compatible API.
 * Falls back gracefully if OPENAI_API_KEY is not set.
 */
async function probeOpenAI(
  domain: string,
  questions: string[],
): Promise<Array<{ question: string; answer: string }>> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return questions.map((q) => ({
      question: q,
      answer: '[OpenAI API key not configured — skipped]',
    }))
  }

  const results: Array<{ question: string; answer: string }> = []

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
        results.push({ question: q, answer: `[GPT-4o probe failed: HTTP ${resp.status}]` })
        continue
      }

      const data = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const answer = data.choices?.[0]?.message?.content?.trim() || '[No response]'
      results.push({ question: q, answer })
    } catch {
      results.push({ question: q, answer: '[GPT-4o probe timed out]' })
    }
  }
  return results
}

/**
 * Probe using Gemini via Google AI API.
 * Falls back gracefully if GOOGLE_AI_API_KEY is not set.
 */
async function probeGemini(
  domain: string,
  questions: string[],
): Promise<Array<{ question: string; answer: string }>> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) {
    return questions.map((q) => ({
      question: q,
      answer: '[Google AI API key not configured — skipped]',
    }))
  }

  const results: Array<{ question: string; answer: string }> = []

  for (const q of questions) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: q }] }],
            generationConfig: { maxOutputTokens: 400, temperature: 0.3 },
            systemInstruction: {
              parts: [{ text: 'You are answering questions about websites and companies. Share what you know confidently — most well-known products and companies are in your training data. Provide specific details: names, features, pricing tiers. Only say "I don\'t know" if the company is genuinely obscure. Never redirect users to "visit the website." Give a direct, substantive answer.' }],
            },
          }),
          signal: AbortSignal.timeout(20_000),
        },
      )

      if (!resp.ok) {
        const errBody = await resp.text().catch(() => 'no body')
        console.error(`[gemini-probe] HTTP ${resp.status} for "${q.slice(0, 60)}": ${errBody.slice(0, 300)}`)
        results.push({ question: q, answer: `[Gemini probe failed: HTTP ${resp.status}]` })
        continue
      }

      const data = (await resp.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> }
          finishReason?: string
        }>
        promptFeedback?: { blockReason?: string }
        error?: { message?: string; code?: number }
      }

      // Check for API-level error
      if (data.error) {
        console.error(`[gemini-probe] API error for "${q.slice(0, 60)}": ${data.error.message} (code ${data.error.code})`)
        results.push({ question: q, answer: `[Gemini API error: ${data.error.message}]` })
        continue
      }

      // Check for prompt blocked by safety filters
      if (data.promptFeedback?.blockReason) {
        console.warn(`[gemini-probe] Prompt blocked: ${data.promptFeedback.blockReason}`)
        results.push({ question: q, answer: `[Gemini blocked: ${data.promptFeedback.blockReason}]` })
        continue
      }

      // Check for empty candidates (safety filter on response)
      if (!data.candidates || data.candidates.length === 0) {
        console.warn(`[gemini-probe] No candidates returned for "${q.slice(0, 60)}" — response: ${JSON.stringify(data).slice(0, 300)}`)
        results.push({ question: q, answer: '[Gemini returned no candidates]' })
        continue
      }

      const candidate = data.candidates[0]
      if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
        console.warn(`[gemini-probe] Unusual finishReason: ${candidate.finishReason}`)
      }

      const answer = candidate.content?.parts?.[0]?.text?.trim() || '[No response text]'
      results.push({ question: q, answer })
    } catch (err) {
      console.error(`[gemini-probe] Exception for "${q.slice(0, 60)}":`, err)
      results.push({ question: q, answer: '[Gemini probe timed out]' })
    }
  }
  return results
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
      modelId: modelLabel.toLowerCase().includes('claude')
        ? 'claude' as AIModelId
        : modelLabel.toLowerCase().includes('gpt')
          ? 'gpt4o' as AIModelId
          : 'gemini' as AIModelId,
      modelLabel,
      question: a.question,
      answer: a.answer,
      accuracy: normalizeAccuracy(grades[i]?.accuracy),
      accuracyNote: grades[i]?.note || 'Grading unavailable',
    }))
  } catch {
    return answers.map((a) => ({
      modelId: modelLabel.toLowerCase().includes('claude')
        ? 'claude' as AIModelId
        : modelLabel.toLowerCase().includes('gpt')
          ? 'gpt4o' as AIModelId
          : 'gemini' as AIModelId,
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
  const score = total > 0
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
  }
}

/* ── Main engine ───────────────────────────────────────────── */

/**
 * Run multi-model benchmarking: probe Claude, GPT-4o, and Gemini
 * about the same domain, grade all answers, and compare.
 */
export async function runMultiModelBenchmark(
  domain: string,
  groundTruth: SiteGroundTruth,
): Promise<MultiModelComparison> {
  const questions = BENCHMARK_QUESTIONS.map((q) => q.replace('{domain}', domain))

  // Probe all models in parallel
  const [claudeAnswers, gptAnswers, geminiAnswers] = await Promise.all([
    probeClaude(domain, questions),
    probeOpenAI(domain, questions),
    probeGemini(domain, questions),
  ])

  // Grade all answers in parallel
  const [claudeGrades, gptGrades, geminiGrades] = await Promise.all([
    gradeModelAnswers(domain, 'Claude', claudeAnswers, groundTruth),
    gradeModelAnswers(domain, 'GPT-4o', gptAnswers, groundTruth),
    gradeModelAnswers(domain, 'Gemini', geminiAnswers, groundTruth),
  ])

  // Build benchmarks
  const benchmarks: ModelBenchmark[] = [
    buildBenchmark('claude', 'Claude', claudeGrades),
    buildBenchmark('gpt4o', 'GPT-4o', gptGrades),
    buildBenchmark('gemini', 'Gemini', geminiGrades),
  ]

  // Filter out models that returned all skipped/failed
  const activeBenchmarks = benchmarks.filter(
    (b) => !b.results.every((r) => r.answer.startsWith('[') && r.answer.endsWith(']')),
  )

  // Find best and worst
  const sorted = [...activeBenchmarks].sort((a, b) => b.accuracyScore - a.accuracyScore)
  const bestModel = sorted[0]?.modelId || 'claude'
  const worstModel = sorted[sorted.length - 1]?.modelId || 'claude'

  const avgAccuracy = activeBenchmarks.length > 0
    ? Math.round(activeBenchmarks.reduce((s, b) => s + b.accuracyScore, 0) / activeBenchmarks.length)
    : 0

  // Generate insight — handle low-accuracy and new/unknown sites
  let insight: string
  if (activeBenchmarks.length <= 1) {
    insight = `AI knowledge benchmarked with ${sorted[0]?.modelLabel || 'one model'}. Multi-model comparison available when additional AI providers are configured.`
  } else if (avgAccuracy <= 15) {
    // All models know very little — site is new/niche or lacks structured data
    const hallucinatedTotal = activeBenchmarks.reduce((s, b) => s + b.hallucinatedCount, 0)
    const inaccurateTotal = activeBenchmarks.reduce((s, b) => s + b.inaccurateCount, 0)
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
    benchmarks: activeBenchmarks.length > 0 ? activeBenchmarks : benchmarks,
    bestModel,
    worstModel,
    averageAccuracy: avgAccuracy,
    insight,
  }
}
