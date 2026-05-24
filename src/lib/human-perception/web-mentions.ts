/**
 * Web Mentions Service — Tier 2
 *
 * Fetches brand mentions from news articles, blog posts, and press coverage
 * using search APIs (SerpAPI primary, Brave Search fallback).
 *
 * Classifies sentiment and extracts themes from each mention.
 *
 * ENV VARS:
 *  - SERP_API_KEY (primary)
 *  - BRAVE_SEARCH_API_KEY (fallback)
 */

import Anthropic from '@anthropic-ai/sdk'

/* ── Types ───────────────────────────────────────────── */

export interface WebMention {
  sourceUrl: string
  sourceDomain: string
  title: string
  snippet: string
  sentiment: 'positive' | 'negative' | 'neutral'
  sentimentScore: number // 0-100
  themes: Array<{ theme: string; polarity: 'positive' | 'negative' | 'neutral' }>
  domainAuthority: number | null // estimated 0-100
  publishedAt: string | null
}

export interface WebMentionsAnalysis {
  mentions: WebMention[]
  totalMentions: number
  avgSentiment: number
  sentimentBreakdown: { positive: number; neutral: number; negative: number }
  topSources: Array<{ domain: string; count: number; avgSentiment: number }>
  topThemes: Array<{ theme: string; polarity: string; count: number }>
  notableMentions: WebMention[] // highest authority
  fetchedAt: string
}

/* ── Search providers ────────────────────────────────── */

interface RawSearchResult {
  url: string
  title: string
  snippet: string
  domain: string
  publishedAt: string | null
}

async function searchViaSerpApi(query: string, limit = 20): Promise<RawSearchResult[]> {
  const apiKey = process.env.SERP_API_KEY
  if (!apiKey) return []

  try {
    const params = new URLSearchParams({
      q: query,
      api_key: apiKey,
      num: String(limit),
      tbm: '', // web search
      tbs: 'qdr:m', // last month
    })
    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const data = await res.json()

    return (data.organic_results || []).map((r: any) => ({
      url: r.link || '',
      title: r.title || '',
      snippet: r.snippet || '',
      domain: new URL(r.link || 'https://unknown.com').hostname,
      publishedAt: r.date || null,
    }))
  } catch {
    return []
  }
}

async function searchViaBrave(query: string, limit = 20): Promise<RawSearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY
  if (!apiKey) return []

  try {
    const params = new URLSearchParams({
      q: query,
      count: String(limit),
      freshness: 'pm', // past month
    })
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const data = await res.json()

    return (data.web?.results || []).map((r: any) => ({
      url: r.url || '',
      title: r.title || '',
      snippet: r.description || '',
      domain: new URL(r.url || 'https://unknown.com').hostname,
      publishedAt: r.page_age || null,
    }))
  } catch {
    return []
  }
}

/* ── Domain authority estimation ─────────────────────── */

const HIGH_AUTHORITY_DOMAINS = new Set([
  'techcrunch.com', 'forbes.com', 'bloomberg.com', 'reuters.com',
  'theverge.com', 'wired.com', 'arstechnica.com', 'nytimes.com',
  'wsj.com', 'bbc.com', 'cnn.com', 'theguardian.com', 'medium.com',
  'producthunt.com', 'hackernoon.com', 'dev.to', 'venturebeat.com',
  'zdnet.com', 'engadget.com', 'mashable.com', 'businessinsider.com',
  'inc.com', 'entrepreneur.com', 'fastcompany.com',
])

const MID_AUTHORITY_DOMAINS = new Set([
  'reddit.com', 'news.ycombinator.com', 'linkedin.com', 'twitter.com',
  'github.com', 'stackoverflow.com', 'quora.com',
])

function estimateDomainAuthority(domain: string): number {
  const cleanDomain = domain.replace(/^www\./, '')
  if (HIGH_AUTHORITY_DOMAINS.has(cleanDomain)) return 85
  if (MID_AUTHORITY_DOMAINS.has(cleanDomain)) return 60
  // Estimate based on TLD
  if (cleanDomain.endsWith('.edu') || cleanDomain.endsWith('.gov')) return 80
  return 40
}

/* ── Sentiment classification ────────────────────────── */

async function classifyMentionSentiment(
  mentions: Array<{ title: string; snippet: string }>,
  brandName: string,
): Promise<Array<{ sentiment: 'positive' | 'negative' | 'neutral'; sentimentScore: number; themes: Array<{ theme: string; polarity: 'positive' | 'negative' | 'neutral' }> }>> {
  if (mentions.length === 0) return []

  try {
    const client = new Anthropic()
    const mentionsText = mentions
      .map((m, i) => `${i + 1}. "${m.title}" — ${m.snippet.slice(0, 200)}`)
      .join('\n')

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `Analyze the sentiment of each web article mention about "${brandName}". Return JSON array:
[{"sentiment": "positive"|"negative"|"neutral", "sentimentScore": 0-100, "themes": [{"theme": "short phrase", "polarity": "positive"|"negative"|"neutral"}]}]

Mentions:
${mentionsText}`,
      }],
    })

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    return JSON.parse(text)
  } catch {
    return mentions.map(() => ({ sentiment: 'neutral' as const, sentimentScore: 50, themes: [] }))
  }
}

/* ── Public API ──────────────────────────────────────── */

/**
 * Fetch web mentions for a brand from news, blogs, and press.
 * Uses SerpAPI primarily, falls back to Brave Search.
 */
export async function fetchWebMentions(
  brandDomain: string,
  brandName?: string,
): Promise<WebMentionsAnalysis> {
  const searchName = brandName || brandDomain.replace(/\.(com|io|co|org|net)$/, '')

  // Search for brand mentions (exclude the brand's own site)
  const query = `"${searchName}" -site:${brandDomain}`

  let rawResults = await searchViaSerpApi(query)
  if (rawResults.length === 0) {
    rawResults = await searchViaBrave(query)
  }

  // Filter out the brand's own domain
  rawResults = rawResults.filter(r => !r.domain.includes(brandDomain.replace(/^www\./, '')))

  if (rawResults.length === 0) {
    return {
      mentions: [],
      totalMentions: 0,
      avgSentiment: 50,
      sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
      topSources: [],
      topThemes: [],
      notableMentions: [],
      fetchedAt: new Date().toISOString(),
    }
  }

  // Classify sentiment in batches
  const batchSize = 10
  const sentiments: Array<any> = []
  for (let i = 0; i < rawResults.length; i += batchSize) {
    const batch = rawResults.slice(i, i + batchSize)
    const results = await classifyMentionSentiment(
      batch.map(r => ({ title: r.title, snippet: r.snippet })),
      searchName,
    )
    sentiments.push(...results)
  }

  // Build mentions
  const mentions: WebMention[] = rawResults.map((r, i) => ({
    sourceUrl: r.url,
    sourceDomain: r.domain,
    title: r.title,
    snippet: r.snippet,
    sentiment: sentiments[i]?.sentiment || 'neutral',
    sentimentScore: sentiments[i]?.sentimentScore || 50,
    themes: sentiments[i]?.themes || [],
    domainAuthority: estimateDomainAuthority(r.domain),
    publishedAt: r.publishedAt,
  }))

  // Aggregations
  const avgSentiment = mentions.length > 0
    ? Math.round(mentions.reduce((a, m) => a + m.sentimentScore, 0) / mentions.length)
    : 50

  const sentimentBreakdown = {
    positive: mentions.filter(m => m.sentiment === 'positive').length,
    neutral: mentions.filter(m => m.sentiment === 'neutral').length,
    negative: mentions.filter(m => m.sentiment === 'negative').length,
  }

  // Top sources by frequency
  const sourceCounts = new Map<string, { count: number; totalSentiment: number }>()
  for (const m of mentions) {
    const existing = sourceCounts.get(m.sourceDomain)
    if (existing) {
      existing.count++
      existing.totalSentiment += m.sentimentScore
    } else {
      sourceCounts.set(m.sourceDomain, { count: 1, totalSentiment: m.sentimentScore })
    }
  }
  const topSources = [...sourceCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([domain, { count, totalSentiment }]) => ({
      domain,
      count,
      avgSentiment: Math.round(totalSentiment / count),
    }))

  // Top themes
  const themeMap = new Map<string, { polarity: string; count: number }>()
  for (const m of mentions) {
    for (const t of m.themes) {
      const key = t.theme.toLowerCase()
      const existing = themeMap.get(key)
      if (existing) existing.count++
      else themeMap.set(key, { polarity: t.polarity, count: 1 })
    }
  }
  const topThemes = [...themeMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([theme, { polarity, count }]) => ({ theme, polarity, count }))

  // Notable = highest authority
  const notableMentions = [...mentions]
    .sort((a, b) => (b.domainAuthority || 0) - (a.domainAuthority || 0))
    .slice(0, 5)

  return {
    mentions,
    totalMentions: mentions.length,
    avgSentiment,
    sentimentBreakdown,
    topSources,
    topThemes,
    notableMentions,
    fetchedAt: new Date().toISOString(),
  }
}
