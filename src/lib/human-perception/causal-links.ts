/**
 * Causal Link Engine — Tier 2
 *
 * Connects human sentiment themes (from reviews, Reddit, web mentions)
 * with AI response themes (from model probes). Generates causal explanations
 * that show users WHY AI models say what they say about their brand.
 *
 * This is the unique insight that differentiates Fixpath:
 * "Reddit says X → AI learned X → Here's how to fix it"
 */

import Anthropic from '@anthropic-ai/sdk'

/* ── Types ───────────────────────────────────────────── */

export interface CausalLink {
  /** The human signal that drives the AI perception */
  humanTheme: string
  /** Where the human signal comes from */
  humanSource: 'reddit' | 'reviews' | 'web_mentions' | 'social'
  /** How prevalent this theme is in human sources (mentions/count) */
  humanPrevalence: number
  /** The corresponding AI response theme */
  aiTheme: string
  /** Which AI models reflect this */
  aiModels: string[]
  /** How strongly the AI reflects this theme (0-100) */
  aiReflection: number
  /** Causal explanation in plain English */
  explanation: string
  /** Recommended action to change this perception */
  recommendation: string
  /** Impact if addressed */
  estimatedImpact: 'high' | 'medium' | 'low'
  /** Whether this is a positive or negative perception */
  sentiment: 'positive' | 'negative' | 'neutral'
}

export interface CausalAnalysis {
  links: CausalLink[]
  summary: string
  topActionableInsights: string[]
  computedAt: string
}

/* ── LLM-powered causal analysis ─────────────────────── */

const CAUSAL_PROMPT = `You are a brand perception analyst. Given human signals (what real people say) and AI signals (what AI models say), identify causal connections.

For each connection found, explain:
1. What humans are saying (the source signal)
2. What AI models are reflecting (the learned behavior)
3. Why this connection exists
4. What the brand should do about it

Return JSON only (no markdown):
{
  "links": [
    {
      "humanTheme": "short theme from human sources",
      "humanSource": "reddit"|"reviews"|"web_mentions",
      "humanPrevalence": number (how many mentions),
      "aiTheme": "corresponding AI theme",
      "aiModels": ["model names that reflect this"],
      "aiReflection": 0-100 (how strongly AI reflects this),
      "explanation": "One sentence explaining the causal connection",
      "recommendation": "Specific actionable recommendation",
      "estimatedImpact": "high"|"medium"|"low",
      "sentiment": "positive"|"negative"|"neutral"
    }
  ],
  "summary": "2-3 sentence overall summary of the human→AI perception chain",
  "topActionableInsights": ["insight 1", "insight 2", "insight 3"]
}`

export async function computeCausalLinks(params: {
  brandName: string
  /** Themes from human sources (Reddit, reviews, web mentions) */
  humanThemes: Array<{
    theme: string
    source: 'reddit' | 'reviews' | 'web_mentions' | 'social'
    polarity: 'positive' | 'negative' | 'neutral'
    count: number
  }>
  /** Themes from AI model responses */
  aiThemes: Array<{
    theme: string
    models: string[]
    polarity: 'positive' | 'negative' | 'neutral'
  }>
  /** AI sentiment scores per model */
  aiSentimentByModel: Array<{ model: string; sentiment: number }>
}): Promise<CausalAnalysis> {
  const { brandName, humanThemes, aiThemes, aiSentimentByModel } = params

  if (humanThemes.length === 0 && aiThemes.length === 0) {
    return {
      links: [],
      summary: 'Insufficient data to establish causal connections between human and AI perceptions.',
      topActionableInsights: [],
      computedAt: new Date().toISOString(),
    }
  }

  try {
    const client = new Anthropic()

    const humanData = humanThemes
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .map(t => `- "${t.theme}" (${t.source}, ${t.polarity}, ${t.count} mentions)`)
      .join('\n')

    const aiData = aiThemes
      .slice(0, 15)
      .map(t => `- "${t.theme}" (${t.polarity}, models: ${t.models.join(', ')})`)
      .join('\n')

    const sentimentData = aiSentimentByModel
      .map(s => `- ${s.model}: ${s.sentiment}/100`)
      .join('\n')

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `${CAUSAL_PROMPT}

Brand: "${brandName}"

HUMAN SIGNALS (what real people say online):
${humanData || 'No human data available'}

AI SIGNALS (what AI models say about the brand):
${aiData || 'No AI theme data available'}

AI SENTIMENT BY MODEL:
${sentimentData || 'No sentiment data'}

Find the causal connections between human signals and AI perceptions.`,
      }],
    })

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    const parsed = JSON.parse(text)

    return {
      links: (parsed.links || []).map((l: any) => ({
        humanTheme: l.humanTheme || '',
        humanSource: l.humanSource || 'web_mentions',
        humanPrevalence: l.humanPrevalence || 0,
        aiTheme: l.aiTheme || '',
        aiModels: l.aiModels || [],
        aiReflection: l.aiReflection || 0,
        explanation: l.explanation || '',
        recommendation: l.recommendation || '',
        estimatedImpact: l.estimatedImpact || 'medium',
        sentiment: l.sentiment || 'neutral',
      })),
      summary: parsed.summary || '',
      topActionableInsights: parsed.topActionableInsights || [],
      computedAt: new Date().toISOString(),
    }
  } catch {
    return {
      links: [],
      summary: 'Could not compute causal links at this time.',
      topActionableInsights: [],
      computedAt: new Date().toISOString(),
    }
  }
}

/**
 * Build causal links from available human perception + AI data.
 * This is the orchestrator that pulls from all sources.
 */
export async function buildCausalAnalysis(params: {
  brandName: string
  // From reviews service
  reviewThemes?: Array<{ theme: string; count: number; isPositive: boolean }>
  // From Reddit service
  redditThemes?: Array<{ theme: string; polarity: string; count: number }>
  // From web mentions service
  webMentionThemes?: Array<{ theme: string; polarity: string; count: number }>
  // From brand intelligence (AI side)
  aiPositiveThemes?: string[]
  aiNegativeThemes?: string[]
  perModelSentiment?: Array<{ modelLabel: string; sentimentScore: number; themes: Array<{ theme: string; polarity: string }> }>
}): Promise<CausalAnalysis> {
  const { brandName, reviewThemes, redditThemes, webMentionThemes, aiPositiveThemes, aiNegativeThemes, perModelSentiment } = params

  // Combine human themes from all sources
  const humanThemes: Array<{ theme: string; source: 'reddit' | 'reviews' | 'web_mentions' | 'social'; polarity: 'positive' | 'negative' | 'neutral'; count: number }> = []

  for (const t of (reviewThemes || [])) {
    humanThemes.push({
      theme: t.theme,
      source: 'reviews',
      polarity: t.isPositive ? 'positive' : 'negative',
      count: t.count,
    })
  }

  for (const t of (redditThemes || [])) {
    humanThemes.push({
      theme: t.theme,
      source: 'reddit',
      polarity: t.polarity as any || 'neutral',
      count: t.count,
    })
  }

  for (const t of (webMentionThemes || [])) {
    humanThemes.push({
      theme: t.theme,
      source: 'web_mentions',
      polarity: t.polarity as any || 'neutral',
      count: t.count,
    })
  }

  // Build AI themes from per-model data
  const aiThemes: Array<{ theme: string; models: string[]; polarity: 'positive' | 'negative' | 'neutral' }> = []
  const aiThemeMap = new Map<string, { models: Set<string>; polarity: string }>()

  for (const model of (perModelSentiment || [])) {
    for (const t of model.themes) {
      const key = t.theme.toLowerCase()
      const existing = aiThemeMap.get(key)
      if (existing) {
        existing.models.add(model.modelLabel)
      } else {
        aiThemeMap.set(key, { models: new Set([model.modelLabel]), polarity: t.polarity })
      }
    }
  }

  // Also add aggregated themes
  for (const t of (aiPositiveThemes || [])) {
    const key = t.toLowerCase()
    if (!aiThemeMap.has(key)) {
      aiThemeMap.set(key, { models: new Set(['multiple']), polarity: 'positive' })
    }
  }
  for (const t of (aiNegativeThemes || [])) {
    const key = t.toLowerCase()
    if (!aiThemeMap.has(key)) {
      aiThemeMap.set(key, { models: new Set(['multiple']), polarity: 'negative' })
    }
  }

  for (const [theme, { models, polarity }] of aiThemeMap) {
    aiThemes.push({ theme, models: [...models], polarity: polarity as any })
  }

  // AI sentiment by model
  const aiSentimentByModel = (perModelSentiment || []).map(m => ({
    model: m.modelLabel,
    sentiment: m.sentimentScore,
  }))

  return computeCausalLinks({ brandName, humanThemes, aiThemes, aiSentimentByModel })
}
