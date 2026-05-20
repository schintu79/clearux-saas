// ============================================================
// ClearUX Audit Engine — LLM Probe
// ============================================================
// Queries an AI model about the audited domain with standardized
// questions, then grades the responses for accuracy against the
// crawled site content. This is the core differentiator:
//   "What does AI actually think about your website?"
//
// PROPRIETARY — do not distribute outside the ClearUX codebase.
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import type { LlmProbeAccuracy } from '@/types/database'

/** A single probe question with context for grading */
export interface ProbeQuestion {
  id: string
  question: string
  /** What aspect of the business this tests */
  aspect: 'identity' | 'offering' | 'pricing' | 'reputation' | 'differentiator'
}

/** Result of a single LLM probe */
export interface ProbeResult {
  questionId: string
  question: string
  answer: string
  accuracy: LlmProbeAccuracy
  accuracyNote: string
  citedUrl: string | null
  modelUsed: string
}

/** Full probe session results */
export interface LlmProbeSession {
  domain: string
  results: ProbeResult[]
  accuracySummary: {
    accurate: number
    partial: number
    inaccurate: number
    hallucinated: number
    noData: number
    total: number
    scorePercent: number   // 0-100
  }
}

// Standardized questions — designed to test what AI "knows" about a business
const PROBE_QUESTIONS: ProbeQuestion[] = [
  {
    id: 'identity',
    question: 'What is {domain}? Describe the company or organization behind this website in 2-3 sentences.',
    aspect: 'identity',
  },
  {
    id: 'offering',
    question: 'What products or services does {domain} offer? List the main offerings.',
    aspect: 'offering',
  },
  {
    id: 'pricing',
    question: 'What is the pricing for {domain}? Describe their pricing model, plans, or costs.',
    aspect: 'pricing',
  },
  {
    id: 'reputation',
    question: 'What is the reputation of {domain}? Is it trustworthy? What do users say about it?',
    aspect: 'reputation',
  },
  {
    id: 'differentiator',
    question: 'Why should someone choose {domain} over its competitors? What makes it unique?',
    aspect: 'differentiator',
  },
]

/** Ground truth extracted from the crawled site for grading */
export interface SiteGroundTruth {
  /** Site name / company name */
  siteName: string | null
  /** Meta description or first paragraph */
  siteDescription: string | null
  /** Pricing text found on site */
  pricingText: string | null
  /** Product/service descriptions found */
  offeringText: string | null
  /** Full crawled content for fuzzy matching */
  fullContent: string
  /** Pages crawled with titles */
  pages: Array<{ url: string; title: string | null }>
}

let _anthropic: Anthropic | null = null
function getClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')
    _anthropic = new Anthropic({ apiKey, timeout: 30_000 })
  }
  return _anthropic
}

/** Retry an async function with exponential backoff (for rate limit resilience) */
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

/**
 * Run the full LLM probe session: ask questions, then grade answers.
 * Uses Claude Haiku for speed and cost efficiency.
 */
export async function runLlmProbe(
  domain: string,
  groundTruth: SiteGroundTruth,
  timeoutMs: number = 60_000,
): Promise<LlmProbeSession> {
  const client = getClient()
  const modelUsed = 'claude-haiku-4-5-20251001'

  // Phase 1: Ask all questions concurrently (no site context — testing what AI "knows")
  const askPromises = PROBE_QUESTIONS.map(async (q) => {
    const question = q.question.replace('{domain}', domain)
    try {
      const resp = await withRetry(
        () => Promise.race([
          client.beta.promptCaching.messages.create({
            model: modelUsed,
            max_tokens: 500,
            temperature: 0,
            system: [{ type: 'text', text: `You are a knowledgeable assistant answering questions about websites and companies. Share what you know confidently. Most well-known companies, products, and websites are in your training data — answer based on that knowledge. Provide specific, factual details: names, features, descriptions, pricing tiers if you know them. Only say "I don't know" if the company/website is genuinely obscure and you have no information at all. Never redirect users to "visit the website" — that defeats the purpose. Give a direct, substantive answer.`, cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content: question }],
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Probe timeout')), timeoutMs / PROBE_QUESTIONS.length),
          ),
        ]),
        `llm-probe(${q.id})`,
      )
      const answer = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim()
      return { questionId: q.id, question, answer, aspect: q.aspect }
    } catch (err) {
      return {
        questionId: q.id,
        question,
        answer: `[Probe failed: ${err instanceof Error ? err.message : 'unknown error'}]`,
        aspect: q.aspect,
      }
    }
  })

  const rawAnswers = await Promise.all(askPromises)

  // Phase 2: Grade all answers against ground truth in a single call
  const results = await gradeAnswers(client, modelUsed, domain, rawAnswers, groundTruth)

  // Calculate accuracy summary
  const counts = { accurate: 0, partial: 0, inaccurate: 0, hallucinated: 0, noData: 0 }
  for (const r of results) {
    if (r.accuracy === 'accurate') counts.accurate++
    else if (r.accuracy === 'partial') counts.partial++
    else if (r.accuracy === 'inaccurate') counts.inaccurate++
    else if (r.accuracy === 'hallucinated') counts.hallucinated++
    else counts.noData++
  }

  const total = results.length
  // Scoring: accurate=100, partial=50, noData=25, inaccurate=0, hallucinated=0
  const scorePercent = total > 0
    ? Math.round(
        ((counts.accurate * 100 + counts.partial * 50 + counts.noData * 25) / (total * 100)) * 100,
      )
    : 0

  return {
    domain,
    results,
    accuracySummary: { ...counts, total, scorePercent },
  }
}

/** Grade probe answers against crawled ground truth */
async function gradeAnswers(
  client: Anthropic,
  model: string,
  domain: string,
  rawAnswers: Array<{ questionId: string; question: string; answer: string; aspect: string }>,
  groundTruth: SiteGroundTruth,
): Promise<ProbeResult[]> {
  // Build ground truth context (truncated to stay within token limits)
  const truthContext = buildGroundTruthContext(groundTruth)

  const gradingPrompt = `You are grading how accurately an AI model answered questions about the website "${domain}".

Below is the GROUND TRUTH — real content crawled from the actual website:

<ground_truth>
${truthContext}
</ground_truth>

Below are the AI's answers to questions about this website. For each answer, grade its accuracy:

${rawAnswers.map((a, i) => `<answer_${i + 1}>
Question: ${a.question}
AI's Answer: ${a.answer}
</answer_${i + 1}>`).join('\n\n')}

GRADING RULES:
- "accurate": Factually correct answer that matches the ground truth.
- "partial": Some correct information but incomplete or slightly off.
- "inaccurate": Wrong information that contradicts ground truth.
- "hallucinated": Made up specific details not found anywhere on the site.
- "no_data": ONLY use this if the ground truth itself has no relevant information for this question AND the AI correctly acknowledged the gap.

CRITICAL: If the AI REFUSED to answer or said "I don't have information" but the ground truth DOES contain the answer, grade as "inaccurate" — not "no_data". An AI that declines to answer a question when the information is publicly available is failing the user just as much as one that gives wrong information. Unnecessary refusals and excessive hedging ("visit the website", "I'm not sure", "check their page") when the ground truth clearly has the data should be graded "inaccurate".

For each answer, respond with a JSON array where each item has:
- "questionId": the question identifier
- "accuracy": one of the grades above
- "accuracyNote": 1-2 sentence explanation of why you gave this grade
- "citedUrl": if the AI's answer corresponds to content from a specific page, provide that URL (or null)

Respond ONLY with a valid JSON array, no other text.`

  try {
    const resp = await withRetry(
      () => client.messages.create({
        model,
        max_tokens: 2000,
        temperature: 0,
        messages: [{ role: 'user', content: gradingPrompt }],
      }),
      'llm-probe-grading',
    )

    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array in grading response')

    const grades = JSON.parse(jsonMatch[0]) as Array<{
      questionId: string
      accuracy: string
      accuracyNote: string
      citedUrl: string | null
    }>

    return rawAnswers.map((a, i) => {
      const grade = grades[i] || grades.find((g) => g.questionId === a.questionId)
      const accuracy = normalizeAccuracy(grade?.accuracy)
      return {
        questionId: a.questionId,
        question: a.question,
        answer: a.answer,
        accuracy,
        accuracyNote: grade?.accuracyNote || 'Grading unavailable',
        citedUrl: grade?.citedUrl || null,
        modelUsed: model,
      }
    })
  } catch (err) {
    // If grading fails, return all as ungraded
    console.error('[llm-probe] Grading failed:', err)
    return rawAnswers.map((a) => ({
      questionId: a.questionId,
      question: a.question,
      answer: a.answer,
      accuracy: 'no_data' as LlmProbeAccuracy,
      accuracyNote: 'Automated grading failed — manual review needed',
      citedUrl: null,
      modelUsed: model,
    }))
  }
}

function normalizeAccuracy(raw: string | undefined): LlmProbeAccuracy {
  if (!raw) return 'no_data'
  const normalized = raw.toLowerCase().trim()
  if (normalized === 'accurate') return 'accurate'
  if (normalized === 'partial') return 'partial'
  if (normalized === 'inaccurate') return 'inaccurate'
  if (normalized === 'hallucinated') return 'hallucinated'
  return 'no_data'
}

function buildGroundTruthContext(gt: SiteGroundTruth): string {
  const parts: string[] = []
  if (gt.siteName) parts.push(`Site name: ${gt.siteName}`)
  if (gt.siteDescription) parts.push(`Description: ${gt.siteDescription}`)
  if (gt.offeringText) parts.push(`Products/services: ${gt.offeringText.substring(0, 1000)}`)
  if (gt.pricingText) parts.push(`Pricing: ${gt.pricingText.substring(0, 1000)}`)
  if (gt.pages.length > 0) {
    parts.push(`Pages crawled: ${gt.pages.map((p) => `${p.title || 'Untitled'} (${p.url})`).join(', ')}`)
  }
  // Add truncated full content as fallback context
  if (gt.fullContent) {
    parts.push(`\nFull site content (truncated):\n${gt.fullContent.substring(0, 4000)}`)
  }
  return parts.join('\n')
}

/** Format LLM probe results as text for analyzer context */
export function formatLlmProbeForAnalysis(session: LlmProbeSession): string {
  const lines: string[] = [`LLM Probe Results for ${session.domain}:`]
  lines.push(`  Accuracy score: ${session.accuracySummary.scorePercent}%`)
  lines.push(`  Breakdown: ${session.accuracySummary.accurate} accurate, ${session.accuracySummary.partial} partial, ${session.accuracySummary.inaccurate} inaccurate, ${session.accuracySummary.hallucinated} hallucinated, ${session.accuracySummary.noData} no data`)
  lines.push('')
  for (const r of session.results) {
    lines.push(`  Q: ${r.question}`)
    lines.push(`  A: ${r.answer.substring(0, 200)}${r.answer.length > 200 ? '...' : ''}`)
    lines.push(`  Grade: ${r.accuracy} — ${r.accuracyNote}`)
    lines.push('')
  }
  return lines.join('\n')
}
