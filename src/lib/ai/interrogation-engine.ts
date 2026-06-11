/**
 * Fixpath AI Interrogation Engine
 *
 * Runs selected questions against selected AI models (up to 3),
 * stores results in the DB, and returns an assembled result with
 * themes, token counts, and cost estimates.
 *
 * All non-Claude models route through OpenRouter.
 * Usage tracking is query-derived — see interrogation-usage.ts.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { openRouterChat } from './openrouter-client'
import { findModelBySlug } from './model-catalog'

// ── Types ──────────────────────────────────────────────────────

export interface InterrogationRequest {
  workspaceId: string
  userId: string
  /** Null for ad-hoc / custom questions not from the library */
  questionId: string | null
  questionText: string
  questionFamily: string
  /** Model slugs to interrogate — max 3 */
  selectedModelSlugs: string[]
  businessContext: {
    domain: string | null
    brandName: string | null
    category: string | null
    region: string | null
    language: string | null
    description: string | null
  }
}

export interface ModelResult {
  modelSlug: string
  modelLabel: string
  provider: string
  responseText: string
  responseSummary: string | null
  themes: string[]
  accuracy: 'Accurate' | 'Partial' | 'Inaccurate' | null
  accuracyNote: string | null
  latencyMs: number
  tokenInput: number
  tokenOutput: number
  estimatedCostCents: number
  status: 'completed' | 'failed' | 'timeout'
  errorMessage: string | null
}

export interface InterrogationResult {
  interrogationId: string
  status: 'completed' | 'partial' | 'failed'
  results: ModelResult[]
  totalTokenInput: number
  totalTokenOutput: number
  estimatedCostCents: number
  completedAt: string
}

// ── Cost estimation ────────────────────────────────────────────

/**
 * Rough cost estimation per model in cents.
 *
 * Approximate rates (per 1M tokens):
 *   OpenAI:      $0.15 input, $0.60 output
 *   Google:      $0.075 input, $0.30 output
 *   Perplexity:  $1.00 input, $1.00 output
 *   Others:      $0.20 input, $0.60 output (safe average)
 */
export function estimateCostCents(
  modelSlug: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const model = findModelBySlug(modelSlug)
  const provider = model?.provider ?? 'unknown'

  // Rates in dollars per 1M tokens
  let inputRate: number
  let outputRate: number

  switch (provider) {
    case 'openai':
      inputRate = 0.15
      outputRate = 0.60
      break
    case 'google':
      inputRate = 0.075
      outputRate = 0.30
      break
    case 'perplexity':
      inputRate = 1.0
      outputRate = 1.0
      break
    default:
      inputRate = 0.20
      outputRate = 0.60
      break
  }

  const costDollars =
    (inputTokens / 1_000_000) * inputRate +
    (outputTokens / 1_000_000) * outputRate

  // Convert to cents and round to 2 decimal places
  return Math.round(costDollars * 100 * 100) / 100
}

// ── Prompt builder ─────────────────────────────────────────────

function buildInterrogationPrompt(
  questionText: string,
  ctx: InterrogationRequest['businessContext'],
): string {
  const domain = ctx.domain || 'unknown'
  const brandName = ctx.brandName || domain
  const category = ctx.category || 'general'
  const region = ctx.region || 'global'
  const language = ctx.language || 'en'

  return [
    'You are an AI assistant. A user is asking about a business.',
    'Answer naturally and helpfully based on what you know.',
    `Business: ${domain} (${brandName}).`,
    `Category: ${category}.`,
    `Region: ${region}.`,
    language !== 'en' ? `Please respond in the language: ${language}.` : '',
    `Question: ${questionText}`,
  ]
    .filter(Boolean)
    .join(' ')
}

// ── Theme extraction ───────────────────────────────────────────

/**
 * Simple keyword-based theme extraction.
 * Identifies recurring nouns/phrases that appear across model
 * responses and surfaces them as themes.
 */
function extractThemes(responseText: string): string[] {
  if (!responseText || responseText.length < 20) return []

  const text = responseText.toLowerCase()

  // Common stop words to ignore
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
    'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
    'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
    'same', 'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and',
    'or', 'if', 'while', 'about', 'up', 'also', 'this', 'that', 'these',
    'those', 'it', 'its', 'they', 'their', 'them', 'we', 'our', 'you',
    'your', 'he', 'she', 'him', 'her', 'his', 'i', 'me', 'my', 'what',
    'which', 'who', 'whom', 'however', 'although', 'though', 'since',
    'well', 'known', 'based', 'including', 'particularly', 'especially',
    'often', 'many', 'much', 'get', 'got', 'make', 'made', 'like',
    'one', 'two', 'first', 'new', 'way', 'use', 'used', 'using',
  ])

  // Thematic keyword groups relevant to brand perception
  const themePatterns: Array<{ pattern: RegExp; theme: string }> = [
    { pattern: /\b(trust|reliable|trustworthy|credible|reputation)\b/g, theme: 'trust' },
    { pattern: /\b(quality|premium|high[- ]quality|excellent|superior)\b/g, theme: 'quality' },
    { pattern: /\b(affordable|cheap|budget|cost[- ]effective|value|pricing)\b/g, theme: 'pricing' },
    { pattern: /\b(innovative|innovation|cutting[- ]edge|modern|advanced)\b/g, theme: 'innovation' },
    { pattern: /\b(customer service|support|responsive|helpful)\b/g, theme: 'customer service' },
    { pattern: /\b(user[- ]friendly|easy to use|intuitive|simple|usability)\b/g, theme: 'usability' },
    { pattern: /\b(fast|speed|quick|performance|efficient)\b/g, theme: 'performance' },
    { pattern: /\b(secure|security|safe|privacy|protected)\b/g, theme: 'security' },
    { pattern: /\b(popular|well[- ]known|recognized|famous|established)\b/g, theme: 'brand recognition' },
    { pattern: /\b(recommend|suggested|top pick|best choice|go[- ]to)\b/g, theme: 'recommendation' },
    { pattern: /\b(local|nearby|location|community|neighborhood)\b/g, theme: 'local presence' },
    { pattern: /\b(sustainable|eco[- ]friendly|green|environmental)\b/g, theme: 'sustainability' },
    { pattern: /\b(variety|selection|range|options|diverse)\b/g, theme: 'product range' },
    { pattern: /\b(delivery|shipping|logistics|fulfillment)\b/g, theme: 'delivery' },
    { pattern: /\b(review|rating|star|feedback|testimonial)\b/g, theme: 'reviews' },
    { pattern: /\b(competitor|alternative|compared|versus|vs)\b/g, theme: 'competitive positioning' },
    { pattern: /\b(experience|ambiance|atmosphere|vibe|feel)\b/g, theme: 'experience' },
    { pattern: /\b(expertise|expert|specialist|professional|authority)\b/g, theme: 'expertise' },
  ]

  const foundThemes: Map<string, number> = new Map()

  for (const { pattern, theme } of themePatterns) {
    const matches = text.match(pattern)
    if (matches && matches.length > 0) {
      foundThemes.set(theme, (foundThemes.get(theme) || 0) + matches.length)
    }
  }

  // Also extract frequent meaningful words (2+ occurrences) as supplementary themes
  const words = text
    .replace(/[^a-z\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stopWords.has(w))

  const wordCounts = new Map<string, number>()
  for (const word of words) {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
  }

  // Add frequent words not already captured by theme patterns
  const existingThemeKeys = Array.from(foundThemes.keys())
  for (const [word, count] of Array.from(wordCounts.entries())) {
    if (count >= 2 && !foundThemes.has(word)) {
      // Only add if this word isn't already a substring of an existing theme
      const isSubstring = existingThemeKeys.some(
        (t) => t.includes(word) || word.includes(t),
      )
      if (!isSubstring) {
        foundThemes.set(word, count)
        existingThemeKeys.push(word)
      }
    }
  }

  // Return top themes sorted by frequency, capped at 8
  return Array.from(foundThemes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([theme]) => theme)
}

/**
 * Generate a brief summary (1-2 sentences) of a model response.
 */
function summarizeResponse(responseText: string): string | null {
  if (!responseText || responseText.length < 30) return null

  // Take the first meaningful sentence(s), up to ~200 chars
  const sentences = responseText
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 10)

  if (sentences.length === 0) return null

  let summary = sentences[0]
  if (summary.length < 100 && sentences.length > 1) {
    summary += ' ' + sentences[1]
  }

  // Truncate if still too long
  if (summary.length > 250) {
    summary = summary.slice(0, 247) + '...'
  }

  return summary
}

// ── Accuracy assessment ───────────────────────────────────────

/**
 * Lightweight heuristic accuracy assessment for interrogation responses.
 *
 * Compares the AI response against known business context (domain, brand
 * name, category, region) to detect refusals, hallucinations, or partial
 * knowledge. This is less precise than the audit-time probe accuracy
 * (which has full website crawl data as ground truth), but catches the
 * most common failure modes.
 */
export function assessAccuracy(
  responseText: string,
  modelLabel: string,
  ctx: InterrogationRequest['businessContext'],
): { accuracy: 'Accurate' | 'Partial' | 'Inaccurate'; accuracyNote: string } {
  if (!responseText || responseText.length < 20) {
    return { accuracy: 'Inaccurate', accuracyNote: `${modelLabel} provided no meaningful response.` }
  }

  const text = responseText.toLowerCase()
  const domain = (ctx.domain || '').toLowerCase().replace(/^www\./, '')
  const brandName = (ctx.brandName || '').toLowerCase()
  const domainBase = domain.replace(/\.\w+$/, '') // e.g. 'casanaveallemura' from 'casanaveallemura.com'
  const category = (ctx.category || '').toLowerCase()

  // 1. Detect refusals — model says it doesn't know about the brand
  const refusalPatterns = [
    "i don't have", "i do not have", "i cannot find", "i'm not familiar",
    "no information", "i couldn't find", "not aware of", "unable to find",
    "i don't know", "not in my training", "no data available",
    "don't have any information", "don't have specific information",
    "not widely known", "lesser-known entity", "i'm unable",
    "cannot provide specific", "no reliable information",
    "not enough information", "haven't been trained",
  ]
  const isRefusal = refusalPatterns.some((p) => text.includes(p))

  // 2. Detect hallucination — model describes a completely different business
  //    (e.g. says it's a "Spanish modular home company" when it's an Italian cultural space)
  const mentionsDomain = domain && (text.includes(domain) || text.includes(domainBase))
  const mentionsBrand = brandName && brandName.length > 2 && text.includes(brandName)
  const mentionsAnyIdentifier = mentionsDomain || mentionsBrand

  // 3. Score signals
  let score = 50 // baseline = Partial
  const notes: string[] = []

  if (isRefusal) {
    score -= 40
    notes.push(`refused to answer despite the website clearly existing`)
  }

  if (mentionsAnyIdentifier) {
    score += 15
  }

  // Check if response is substantive (contains specific claims vs generic advice)
  const isGenericAdvice =
    (text.includes('check the website') || text.includes('visit the site') ||
     text.includes('i recommend visiting') || text.includes('search for')) &&
    !mentionsAnyIdentifier
  if (isGenericAdvice) {
    score -= 20
    notes.push(`gave generic advice instead of specific information about the brand`)
  }

  // Category match (if we know the category)
  if (category && category !== 'general') {
    const catWords = category.split(/[\s,_-]+/).filter((w) => w.length >= 4)
    const catMatch = catWords.some((w) => text.includes(w))
    if (catMatch) {
      score += 15
      // No note needed — this is expected
    }
  }

  // Substantive response bonus — long, specific answers are more likely accurate
  if (responseText.length > 200 && !isRefusal && mentionsAnyIdentifier) {
    score += 10
  }

  // Determine accuracy tier
  let accuracy: 'Accurate' | 'Partial' | 'Inaccurate'
  if (score >= 65) accuracy = 'Accurate'
  else if (score >= 40) accuracy = 'Partial'
  else accuracy = 'Inaccurate'

  // Build human-readable note
  let accuracyNote: string
  if (accuracy === 'Inaccurate' && isRefusal) {
    accuracyNote = `${modelLabel} refused to answer despite the website clearly describing ${ctx.brandName || domain}${ctx.category ? ` as a ${ctx.category} business` : ''}.`
  } else if (accuracy === 'Inaccurate') {
    accuracyNote = `${modelLabel} ${notes.length > 0 ? notes.join(' and ') : 'did not provide accurate information about this brand'}.`
  } else if (accuracy === 'Partial') {
    const partialNotes = []
    if (!mentionsAnyIdentifier) partialNotes.push('does not mention the brand by name')
    if (notes.length > 0) partialNotes.push(...notes)
    accuracyNote = partialNotes.length > 0
      ? `${modelLabel} ${partialNotes.join(', ')}.`
      : `${modelLabel} provided a partially relevant response but may be missing key details.`
  } else {
    accuracyNote = `${modelLabel} correctly identifies and describes the brand.`
  }

  return { accuracy, accuracyNote }
}

// ── Main interrogation runner ──────────────────────────────────

export async function runInterrogation(
  req: InterrogationRequest,
  db: SupabaseClient,
): Promise<InterrogationResult> {
  const selectedSlugs = req.selectedModelSlugs.slice(0, 3)

  // 1. Create the interrogation row
  // question_id is a UUID FK — only pass it if it looks like a valid UUID.
  // The static question library uses short IDs (e.g. "df-001") which are
  // NOT UUIDs and would fail the DB insert. Pass null in that case; the
  // question text is already captured in question_text_snapshot.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const safeQuestionId =
    req.questionId && UUID_RE.test(req.questionId) ? req.questionId : null

  const { data: interrogation, error: createError } = await db
    .from('workspace_ai_interrogations')
    .insert({
      workspace_id: req.workspaceId,
      user_id: req.userId,
      question_id: safeQuestionId,
      question_text_snapshot: req.questionText,
      question_family: req.questionFamily,
      selected_models: selectedSlugs,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (createError || !interrogation) {
    throw new Error(
      `Failed to create interrogation record: ${createError?.message ?? 'unknown error'}`,
    )
  }

  const interrogationId = (interrogation as any).id as string

  // 2. Create pending result rows for each model
  const resultInserts = selectedSlugs.map((slug) => {
    const modelDef = findModelBySlug(slug)
    return {
      interrogation_id: interrogationId,
      model_slug: slug,
      model_label: modelDef?.displayName ?? slug,
      provider: modelDef?.provider ?? 'unknown',
      status: 'pending',
    }
  })

  const { data: pendingRows, error: pendingError } = await db
    .from('workspace_ai_interrogation_results')
    .insert(resultInserts)
    .select('id, model_slug')

  if (pendingError) {
    console.error('[interrogation] Failed to create pending result rows:', pendingError.message)
  }

  // Map model slug to result row ID for later updates
  const resultRowMap = new Map<string, string>()
  if (pendingRows) {
    for (const row of pendingRows as any[]) {
      resultRowMap.set(row.model_slug, row.id)
    }
  }

  // 3. Build the controlled prompt
  const prompt = buildInterrogationPrompt(req.questionText, req.businessContext)

  // 4. Run all models in parallel
  const modelPromises = selectedSlugs.map(async (slug): Promise<ModelResult> => {
    const modelDef = findModelBySlug(slug)
    const modelLabel = modelDef?.displayName ?? slug
    const provider = modelDef?.provider ?? 'unknown'
    const startMs = Date.now()

    try {
      const response = await openRouterChat({
        model: slug,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 800,
        temperature: 0.7,
        timeoutMs: 30_000,
      })

      const latencyMs = Date.now() - startMs
      const tokenInput = response.usage?.promptTokens ?? 0
      const tokenOutput = response.usage?.completionTokens ?? 0
      const costCents = estimateCostCents(slug, tokenInput, tokenOutput)
      const themes = extractThemes(response.content)
      const responseSummary = summarizeResponse(response.content)
      const { accuracy, accuracyNote } = assessAccuracy(response.content, modelLabel, req.businessContext)

      // Update result row in DB
      const resultRowId = resultRowMap.get(slug)
      if (resultRowId) {
        await db
          .from('workspace_ai_interrogation_results')
          .update({
            response_text: response.content,
            response_summary: responseSummary,
            themes,
            latency_ms: latencyMs,
            token_input: tokenInput,
            token_output: tokenOutput,
            estimated_cost_cents: Math.round(costCents),
            status: 'completed',
            // Persist the grade (2026-06-10) — it was computed here and
            // returned in the live response but never stored, so every
            // refresh lost it ("No Data" badges on saved answers).
            accuracy,
            accuracy_note: accuracyNote,
          })
          .eq('id', resultRowId)
      }

      return {
        modelSlug: slug,
        modelLabel,
        provider,
        responseText: response.content,
        responseSummary,
        themes,
        accuracy,
        accuracyNote,
        latencyMs,
        tokenInput,
        tokenOutput,
        estimatedCostCents: costCents,
        status: 'completed',
        errorMessage: null,
      }
    } catch (err) {
      const latencyMs = Date.now() - startMs
      const isTimeout =
        err instanceof Error &&
        (err.message.includes('Timeout') || err.message.includes('abort'))
      const status: 'failed' | 'timeout' = isTimeout ? 'timeout' : 'failed'
      const errorMessage = err instanceof Error ? err.message : String(err)

      // Update result row in DB with failure
      const resultRowId = resultRowMap.get(slug)
      if (resultRowId) {
        await db
          .from('workspace_ai_interrogation_results')
          .update({
            status,
            error_message: errorMessage.slice(0, 500),
            latency_ms: latencyMs,
          })
          .eq('id', resultRowId)
      }

      return {
        modelSlug: slug,
        modelLabel,
        provider,
        responseText: '',
        responseSummary: null,
        themes: [],
        accuracy: null,
        accuracyNote: null,
        latencyMs,
        tokenInput: 0,
        tokenOutput: 0,
        estimatedCostCents: 0,
        status,
        errorMessage,
      }
    }
  })

  // 5. Wait for all models to settle
  const settled = await Promise.allSettled(modelPromises)

  const results: ModelResult[] = settled.map((outcome, i) => {
    if (outcome.status === 'fulfilled') {
      return outcome.value
    }
    // Promise.allSettled rejection (shouldn't happen since we catch inside, but defensive)
    const slug = selectedSlugs[i]
    const modelDef = findModelBySlug(slug)
    return {
      modelSlug: slug,
      modelLabel: modelDef?.displayName ?? slug,
      provider: modelDef?.provider ?? 'unknown',
      responseText: '',
      responseSummary: null,
      themes: [],
      accuracy: null,
      accuracyNote: null,
      latencyMs: 0,
      tokenInput: 0,
      tokenOutput: 0,
      estimatedCostCents: 0,
      status: 'failed' as const,
      errorMessage: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
    }
  })

  // 6. Compute totals and determine final status
  const completedCount = results.filter((r) => r.status === 'completed').length
  const failedCount = results.filter((r) => r.status !== 'completed').length

  let finalStatus: 'completed' | 'partial' | 'failed'
  if (completedCount === results.length) {
    finalStatus = 'completed'
  } else if (completedCount > 0) {
    finalStatus = 'partial'
  } else {
    finalStatus = 'failed'
  }

  const totalTokenInput = results.reduce((sum, r) => sum + r.tokenInput, 0)
  const totalTokenOutput = results.reduce((sum, r) => sum + r.tokenOutput, 0)
  const totalCostCents = results.reduce((sum, r) => sum + r.estimatedCostCents, 0)
  const completedAt = new Date().toISOString()

  // 7. Update the interrogation row with final status and totals
  await db
    .from('workspace_ai_interrogations')
    .update({
      status: finalStatus,
      token_input_total: totalTokenInput,
      token_output_total: totalTokenOutput,
      estimated_cost_cents: Math.round(totalCostCents),
      completed_at: completedAt,
    })
    .eq('id', interrogationId)

  return {
    interrogationId,
    status: finalStatus,
    results,
    totalTokenInput,
    totalTokenOutput,
    estimatedCostCents: totalCostCents,
    completedAt,
  }
}

// ── Follow-up question suggestions ─────────────────────────────

/**
 * Suggests 2-3 follow-up questions from the library based on
 * the question family and the responses received.
 */
export async function generateFollowups(
  questionFamily: string,
  responseTexts: string[],
  db: SupabaseClient,
): Promise<Array<{ questionId: string; questionText: string; family: string }>> {
  // 1. Find related questions in the same family or adjacent families
  const { data: familyQuestions } = await db
    .from('ai_question_library')
    .select('id, question_text, question_family')
    .eq('is_active', true)
    .eq('question_family', questionFamily)
    .order('priority_score', { ascending: false })
    .limit(10)

  // 2. Also fetch questions from related families
  //    Adjacency mapping: families that pair well for follow-ups
  const relatedFamilies = getRelatedFamilies(questionFamily)

  let relatedQuestions: any[] = []
  if (relatedFamilies.length > 0) {
    const { data } = await db
      .from('ai_question_library')
      .select('id, question_text, question_family')
      .eq('is_active', true)
      .in('question_family', relatedFamilies)
      .order('priority_score', { ascending: false })
      .limit(10)
    relatedQuestions = data ?? []
  }

  // 3. Combine and deduplicate candidates
  const allCandidates = [...(familyQuestions ?? []), ...relatedQuestions]

  // 4. Score candidates by relevance to the response content
  const combinedResponse = responseTexts.join(' ').toLowerCase()
  const scored = allCandidates.map((q: any) => {
    const qText = (q.question_text as string).toLowerCase()
    // Simple relevance: count how many words from the question appear in responses
    const words = qText
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter((w: string) => w.length >= 4)
    const matchCount = words.filter((w: string) => combinedResponse.includes(w)).length
    return { ...q, relevance: matchCount }
  })

  // 5. Sort by relevance (higher is better), then priority
  scored.sort((a: any, b: any) => b.relevance - a.relevance)

  // 6. Return top 2-3, avoiding the exact same question text
  const suggestions: Array<{ questionId: string; questionText: string; family: string }> = []
  const seenTexts = new Set<string>()

  for (const q of scored) {
    const normalized = (q.question_text as string).toLowerCase().trim()
    if (seenTexts.has(normalized)) continue
    seenTexts.add(normalized)

    suggestions.push({
      questionId: q.id as string,
      questionText: q.question_text as string,
      family: q.question_family as string,
    })

    if (suggestions.length >= 3) break
  }

  return suggestions
}

/**
 * Maps a question family to related families that make good
 * follow-up paths.
 */
function getRelatedFamilies(family: string): string[] {
  const adjacencyMap: Record<string, string[]> = {
    trust_credibility: ['reputation', 'reviews', 'social_proof'],
    differentiation: ['competitive_positioning', 'unique_value', 'brand_identity'],
    competitive_positioning: ['differentiation', 'market_share', 'pricing'],
    reputation: ['trust_credibility', 'reviews', 'customer_satisfaction'],
    reviews: ['reputation', 'customer_satisfaction', 'trust_credibility'],
    pricing: ['value_proposition', 'competitive_positioning', 'affordability'],
    product_quality: ['customer_satisfaction', 'reviews', 'trust_credibility'],
    customer_satisfaction: ['reviews', 'product_quality', 'reputation'],
    brand_identity: ['differentiation', 'brand_awareness', 'unique_value'],
    brand_awareness: ['brand_identity', 'market_share', 'reputation'],
    local_presence: ['accessibility', 'customer_satisfaction', 'reputation'],
    sustainability: ['brand_identity', 'trust_credibility', 'differentiation'],
  }

  return adjacencyMap[family] ?? []
}
