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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
        results.push({ question: q, answer: `[Gemini probe failed: HTTP ${resp.status}]` })
        continue
      }

      const data = (await resp.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '[No response]'
      results.push({ question: q, answer })
    } catch {
      results.push({ question: q, answer: '[Gemini probe timed out]' })
    }
  }
  return results
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
): Promise<Array<{ question: string; answer: string }>> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) {
    return questions.map((q) => ({
      question: q,
      answer: '[Perplexity API key not configured — skipped]',
    }))
  }

  const results: Array<{ question: string; answer: string }> = []

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
        results.push({ question: q, answer: `[Perplexity probe failed: HTTP ${resp.status}]` })
        continue
      }

      const data = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const answer = data.choices?.[0]?.message?.content?.trim() || '[No response]'
      results.push({ question: q, answer })
    } catch {
      results.push({ question: q, answer: '[Perplexity probe timed out]' })
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

GROUND TRUTH (from actual website):
${truthParts.join('\n')}

ANSWERS:
${answers.map((a, i) => `Q${i + 1}: ${a.question}\nA${i + 1}: ${a.answer}`).join('\n\n')}

GRADING RULES:
- "accurate": Factually correct, matches ground truth.
- "partial": Some correct info but incomplete or slightly off.
- "inaccurate": Wrong info OR the AI refused/hedged when ground truth clearly has the answer.
- "hallucinated": Made up specific details not on the site.
- "no_data": ONLY if ground truth itself has no relevant info AND AI correctly said so.

CRITICAL: If the AI refused to answer or said "I don't have information" but the ground truth DOES contain the answer, grade as "inaccurate". Unnecessary refusals are failures.

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
  const [claudeAnswers, gptAnswers, geminiAnswers, perplexityAnswers] = await Promise.all([
    probeClaude(domain, questions),
    probeOpenAI(domain, questions),
    probeGemini(domain, questions),
    probePerplexity(domain, questions),
  ])

  // Grade all answers in parallel
  const [claudeGrades, gptGrades, geminiGrades, perplexityGrades] = await Promise.all([
    gradeModelAnswers(domain, 'Claude', claudeAnswers, groundTruth),
    gradeModelAnswers(domain, 'GPT-4o', gptAnswers, groundTruth),
    gradeModelAnswers(domain, 'Gemini', geminiAnswers, groundTruth),
    gradeModelAnswers(domain, 'Perplexity', perplexityAnswers, groundTruth),
  ])

  // Build benchmarks
  const benchmarks: ModelBenchmark[] = [
    buildBenchmark('claude', 'Claude', claudeGrades),
    buildBenchmark('gpt4o', 'GPT-4o', gptGrades),
    buildBenchmark('gemini', 'Gemini', geminiGrades),
    buildBenchmark('perplexity', 'Perplexity', perplexityGrades),
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
      insight = `AI models are fabricating information about your site — none have accurate knowledge. This means users asking AI about you get wrong answers. Adding structured data (JSON-LD), a clear meta description, and an llms.txt file will give AI models correct facts to reference.`
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
