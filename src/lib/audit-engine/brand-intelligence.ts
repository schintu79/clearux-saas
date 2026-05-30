/**
 * Brand Intelligence — Tier 2
 *
 * Post-probe sentiment extraction, placement parsing, and composite scoring.
 * Runs after LLM probes complete. Classifies each model's responses
 * by sentiment polarity, extracts brand perception themes, and computes
 * placement position (where in the response the brand is mentioned).
 *
 * Tier 2 additions:
 *  - Placement parsing: detects where in AI responses the brand appears
 *    (1 = first mention / top recommendation, 5 = buried at end)
 *  - Share of Voice: measures brand's share of response content vs competitors
 *  - Enhanced composite score using real placement data
 */

import Anthropic from '@anthropic-ai/sdk'

/* ── Types ───────────────────────────────────────────── */

export interface SentimentTheme {
  theme: string
  polarity: 'positive' | 'negative' | 'neutral'
  count: number
}

export interface ModelSentiment {
  modelId: string
  modelLabel: string
  sentimentScore: number // 0-100 (50 = neutral)
  themes: SentimentTheme[]
  visibility: boolean // did the model mention the brand?
  placement: number | null // average position in response (null if not mentioned)
  shareOfVoice: number // % of response content about this brand (0-100)
}

export interface BrandIntelligenceSummary {
  score: number // composite 0-100
  aiVisibility: number // % of models that mention the brand
  placementScore: number | null // average placement across models
  overallSentiment: number // 0-100
  shareOfVoice: number | null // vs competitors (null if no competitors)
  perModel: ModelSentiment[]
  positiveThemes: string[]
  negativeThemes: string[]
  issueCount: number
  computedAt: string
}

export interface ProbeResponseForSentiment {
  modelId: string
  modelLabel: string
  question: string
  answer: string
  accuracy: string | null
}

/* ── Sentiment + Placement extraction ───────────────── */

const SENTIMENT_PLACEMENT_PROMPT = `You are a brand perception analyst. Given a set of AI model responses about a brand, extract:

1. An overall sentiment score (0-100, where 0 = very negative, 50 = neutral, 100 = very positive)
2. 2-5 perception themes — recurring topics or attributes mentioned about the brand
3. For each theme, classify polarity as "positive", "negative", or "neutral"
4. Whether the brand was actually mentioned/discussed (visibility: true/false)
5. Placement position — WHERE in the response does the brand first appear?
   - 1 = first item mentioned / top recommendation / opening sentence
   - 2 = mentioned second or in the first paragraph but not first
   - 3 = mentioned in the middle of the response
   - 4 = mentioned towards the end
   - 5 = barely mentioned, footnote, or only in passing
   - null = brand not mentioned at all
6. Share of voice — what percentage of the total response content is about THIS brand vs others mentioned? (0-100)

Respond ONLY with valid JSON, no markdown:
{
  "sentimentScore": <number 0-100>,
  "visibility": <boolean>,
  "placement": <number 1-5 or null>,
  "shareOfVoice": <number 0-100>,
  "themes": [{"theme": "<short phrase>", "polarity": "<positive|negative|neutral>", "count": <number>}]
}

If the AI clearly has no knowledge of the brand (says "I don't have information" or similar), return sentimentScore: 50, visibility: false, placement: null, shareOfVoice: 0 with empty themes.`

export interface ModelSentimentResult {
  sentimentScore: number
  visibility: boolean
  themes: SentimentTheme[]
  placement: number | null
  shareOfVoice: number
}

export async function extractModelSentiment(
  brandName: string,
  responses: Array<{ question: string; answer: string }>,
): Promise<ModelSentimentResult> {
  if (responses.length === 0) {
    return { sentimentScore: 50, visibility: false, themes: [], placement: null, shareOfVoice: 0 }
  }

  const responsesText = responses
    .map((r, i) => `Q${i + 1}: ${r.question}\nA${i + 1}: ${r.answer}`)
    .join('\n\n')

  try {
    const client = new Anthropic()
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: `Brand: "${brandName}"\n\nAI responses about this brand:\n\n${responsesText}\n\n${SENTIMENT_PLACEMENT_PROMPT}`,
        },
      ],
      signal: AbortSignal.timeout(20_000), // 20s hard timeout — prevents hanging on slow API
    } as any)

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    const parsed = JSON.parse(text)

    const placement = parsed.placement != null
      ? Math.max(1, Math.min(5, Math.round(Number(parsed.placement))))
      : null

    return {
      sentimentScore: Math.max(0, Math.min(100, Math.round(parsed.sentimentScore ?? 50))),
      visibility: parsed.visibility ?? false,
      placement: parsed.visibility === false ? null : placement,
      shareOfVoice: Math.max(0, Math.min(100, Math.round(Number(parsed.shareOfVoice) || 0))),
      themes: (parsed.themes ?? []).map((t: any) => ({
        theme: String(t.theme || ''),
        polarity: ['positive', 'negative', 'neutral'].includes(t.polarity) ? t.polarity : 'neutral',
        count: Math.max(1, Number(t.count) || 1),
      })),
    }
  } catch {
    // Fallback if LLM call fails
    return { sentimentScore: 50, visibility: true, themes: [], placement: null, shareOfVoice: 0 }
  }
}

/* ── Composite scoring ───────────────────────────────── */

export function computeBrandIntelligenceScore(params: {
  aiVisibilityPercent: number // 0-100
  avgSentiment: number // 0-100
  avgAccuracy: number // 0-100 (from probe accuracy)
  placementScore: number | null // lower is better
}): number {
  const { aiVisibilityPercent, avgSentiment, avgAccuracy, placementScore } = params

  // Weights: visibility 30%, sentiment 25%, accuracy 25%, placement 20%
  const visibilityComponent = aiVisibilityPercent * 0.30
  const sentimentComponent = avgSentiment * 0.25
  const accuracyComponent = avgAccuracy * 0.25

  // Placement: normalize (1-5 scale → 0-100, where 1 = 100)
  let placementComponent = 50 * 0.20 // default if no placement
  if (placementScore != null && placementScore > 0) {
    const normalized = Math.max(0, Math.min(100, (5 - placementScore) / 4 * 100))
    placementComponent = normalized * 0.20
  }

  return Math.round(visibilityComponent + sentimentComponent + accuracyComponent + placementComponent)
}

/* ── Full pipeline step ──────────────────────────────── */

export async function runBrandIntelligenceAnalysis(
  brandName: string,
  probesByModel: Array<{
    modelId: string
    modelLabel: string
    accuracyScore: number
    responses: Array<{ question: string; answer: string }>
  }>,
  competitorVisibility?: number | null,
): Promise<BrandIntelligenceSummary> {
  // Run sentiment + placement extraction per model in parallel
  const modelResults = await Promise.all(
    probesByModel.map(async (model) => {
      const result = await extractModelSentiment(brandName, model.responses)
      return {
        modelId: model.modelId,
        modelLabel: model.modelLabel,
        sentimentScore: result.sentimentScore,
        themes: result.themes,
        visibility: result.visibility,
        placement: result.placement,
        shareOfVoice: result.shareOfVoice,
        accuracyScore: model.accuracyScore,
      }
    })
  )

  // Compute aggregate metrics
  const totalModels = modelResults.length
  const visibleModels = modelResults.filter(m => m.visibility).length
  const aiVisibility = totalModels > 0 ? Math.round((visibleModels / totalModels) * 100) : 0

  const sentimentScores = modelResults.map(m => m.sentimentScore)
  const avgSentiment = sentimentScores.length > 0
    ? Math.round(sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length)
    : 50

  const accuracyScores = probesByModel.map(m => m.accuracyScore)
  const avgAccuracy = accuracyScores.length > 0
    ? Math.round(accuracyScores.reduce((a, b) => a + b, 0) / accuracyScores.length)
    : 0

  // Placement: average position across models (1 = top, 5 = buried)
  const placements = modelResults
    .filter(m => m.placement != null)
    .map(m => m.placement as number)
  const placementScore: number | null = placements.length > 0
    ? Math.round((placements.reduce((a, b) => a + b, 0) / placements.length) * 10) / 10
    : null

  // Aggregate themes across all models
  const themeMap = new Map<string, { polarity: 'positive' | 'negative' | 'neutral'; count: number }>()
  for (const model of modelResults) {
    for (const t of model.themes) {
      const key = t.theme.toLowerCase()
      const existing = themeMap.get(key)
      if (existing) {
        existing.count += t.count
      } else {
        themeMap.set(key, { polarity: t.polarity, count: t.count })
      }
    }
  }

  const positiveThemes = [...themeMap.entries()]
    .filter(([, v]) => v.polarity === 'positive')
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([k]) => k)

  const negativeThemes = [...themeMap.entries()]
    .filter(([, v]) => v.polarity === 'negative')
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([k]) => k)

  // Share of voice — use per-model content share analysis (Tier 2)
  // Each model's shareOfVoice represents what % of its response content
  // was dedicated to this brand vs competitors mentioned.
  const modelShareScores = modelResults
    .filter(m => m.visibility && m.shareOfVoice > 0)
    .map(m => m.shareOfVoice)
  const shareOfVoice = modelShareScores.length > 0
    ? Math.round(modelShareScores.reduce((a, b) => a + b, 0) / modelShareScores.length)
    : (competitorVisibility != null
      ? Math.round((aiVisibility / Math.max(1, aiVisibility + competitorVisibility)) * 100)
      : null)

  // Composite score
  const score = computeBrandIntelligenceScore({
    aiVisibilityPercent: aiVisibility,
    avgSentiment,
    avgAccuracy,
    placementScore,
  })

  // Count issues
  const issueCount = negativeThemes.length + (aiVisibility < 60 ? 1 : 0) + (avgSentiment < 50 ? 1 : 0)

  const perModel: ModelSentiment[] = modelResults.map(m => ({
    modelId: m.modelId,
    modelLabel: m.modelLabel,
    sentimentScore: m.sentimentScore,
    themes: m.themes,
    visibility: m.visibility,
    placement: m.placement,
    shareOfVoice: m.shareOfVoice,
  }))

  return {
    score,
    aiVisibility,
    placementScore,
    overallSentiment: avgSentiment,
    shareOfVoice,
    perModel,
    positiveThemes,
    negativeThemes,
    issueCount,
    computedAt: new Date().toISOString(),
  }
}
