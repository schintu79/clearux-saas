/**
 * Reddit Brand Mentions — Tier 2
 *
 * Fetches brand mentions from Reddit using the Reddit API (OAuth2).
 * Classifies sentiment on each mention using Claude Haiku.
 *
 * ENV VARS:
 *  - REDDIT_CLIENT_ID
 *  - REDDIT_CLIENT_SECRET
 *  - REDDIT_USER_AGENT (optional, defaults to 'Fixpath/1.0')
 */

import Anthropic from '@anthropic-ai/sdk'

/* ── Types ───────────────────────────────────────────── */

export interface RedditMention {
  subreddit: string
  postTitle: string
  postUrl: string
  postBody: string
  score: number
  numComments: number
  sentiment: 'positive' | 'negative' | 'neutral'
  sentimentScore: number // 0-100
  themes: Array<{ theme: string; polarity: 'positive' | 'negative' | 'neutral' }>
  author: string
  postedAt: string
}

export interface RedditAnalysis {
  mentions: RedditMention[]
  totalMentions: number
  avgSentiment: number // 0-100
  sentimentBreakdown: { positive: number; neutral: number; negative: number }
  topThemes: Array<{ theme: string; polarity: string; count: number }>
  trendingThreads: RedditMention[] // sorted by score desc
  fetchedAt: string
}

/* ── Reddit OAuth ────────────────────────────────────── */

let cachedToken: { token: string; expiresAt: number } | null = null

async function getRedditAccessToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID
  const clientSecret = process.env.REDDIT_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  // Return cached token if still valid
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token
  }

  try {
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': process.env.REDDIT_USER_AGENT || 'Fixpath/1.0',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return null
    const data = await res.json()
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000, // refresh 60s early
    }
    return cachedToken.token
  } catch {
    return null
  }
}

/* ── Search Reddit ───────────────────────────────────── */

async function searchReddit(
  query: string,
  token: string,
  limit = 25,
): Promise<Array<{ subreddit: string; title: string; selftext: string; url: string; score: number; num_comments: number; author: string; created_utc: number; permalink: string }>> {
  try {
    const userAgent = process.env.REDDIT_USER_AGENT || 'Fixpath/1.0'
    const res = await fetch(
      `https://oauth.reddit.com/search?q=${encodeURIComponent(query)}&sort=relevance&t=month&limit=${limit}&type=link`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': userAgent,
        },
        signal: AbortSignal.timeout(15000),
      }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data?.data?.children || []).map((c: any) => c.data)
  } catch {
    return []
  }
}

/* ── Sentiment classification ────────────────────────── */

async function classifyRedditSentiment(
  posts: Array<{ title: string; body: string }>
): Promise<Array<{ sentiment: 'positive' | 'negative' | 'neutral'; sentimentScore: number; themes: Array<{ theme: string; polarity: 'positive' | 'negative' | 'neutral' }> }>> {
  if (posts.length === 0) return []

  try {
    const client = new Anthropic()
    const postsText = posts
      .map((p, i) => `Post ${i + 1}: "${p.title}" — ${(p.body || '').slice(0, 300)}`)
      .join('\n\n')

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Classify the sentiment of each Reddit post about a brand. Return JSON array only:
[{"sentiment": "positive"|"negative"|"neutral", "sentimentScore": 0-100, "themes": [{"theme": "short phrase", "polarity": "positive"|"negative"|"neutral"}]}]

Posts:
${postsText}`,
      }],
    })

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    return JSON.parse(text)
  } catch {
    return posts.map(() => ({ sentiment: 'neutral' as const, sentimentScore: 50, themes: [] }))
  }
}

/* ── Public API ──────────────────────────────────────── */

/**
 * Fetch and analyze Reddit mentions for a brand.
 * Returns null if Reddit API credentials are not configured.
 */
export async function fetchRedditMentions(
  brandDomain: string,
  brandName?: string,
): Promise<RedditAnalysis | null> {
  const token = await getRedditAccessToken()
  if (!token) {
    console.warn('[reddit] No Reddit API credentials configured. Skipping.')
    return null
  }

  // Search with both domain and brand name
  const searchTerms = [brandDomain.replace(/\.(com|io|co|org|net)$/, '')]
  if (brandName && brandName !== brandDomain) {
    searchTerms.push(brandName)
  }

  const allPosts: Array<any> = []
  const seenUrls = new Set<string>()

  for (const term of searchTerms) {
    const posts = await searchReddit(term, token, 15)
    for (const p of posts) {
      if (!seenUrls.has(p.permalink)) {
        seenUrls.add(p.permalink)
        allPosts.push(p)
      }
    }
  }

  if (allPosts.length === 0) {
    return {
      mentions: [],
      totalMentions: 0,
      avgSentiment: 50,
      sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
      topThemes: [],
      trendingThreads: [],
      fetchedAt: new Date().toISOString(),
    }
  }

  // Classify sentiment in batches
  const batchSize = 10
  const sentiments: Array<any> = []
  for (let i = 0; i < allPosts.length; i += batchSize) {
    const batch = allPosts.slice(i, i + batchSize)
    const results = await classifyRedditSentiment(
      batch.map(p => ({ title: p.title, body: p.selftext }))
    )
    sentiments.push(...results)
  }

  // Build mentions
  const mentions: RedditMention[] = allPosts.map((p, i) => ({
    subreddit: p.subreddit || '',
    postTitle: p.title || '',
    postUrl: `https://reddit.com${p.permalink}`,
    postBody: (p.selftext || '').slice(0, 500),
    score: p.score || 0,
    numComments: p.num_comments || 0,
    sentiment: sentiments[i]?.sentiment || 'neutral',
    sentimentScore: sentiments[i]?.sentimentScore || 50,
    themes: sentiments[i]?.themes || [],
    author: p.author || '[deleted]',
    postedAt: new Date((p.created_utc || 0) * 1000).toISOString(),
  }))

  // Aggregate
  const sentimentScores = mentions.map(m => m.sentimentScore)
  const avgSentiment = sentimentScores.length > 0
    ? Math.round(sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length)
    : 50

  const sentimentBreakdown = {
    positive: mentions.filter(m => m.sentiment === 'positive').length,
    neutral: mentions.filter(m => m.sentiment === 'neutral').length,
    negative: mentions.filter(m => m.sentiment === 'negative').length,
  }

  // Aggregate themes
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

  // Trending = highest score
  const trendingThreads = [...mentions].sort((a, b) => b.score - a.score).slice(0, 5)

  return {
    mentions,
    totalMentions: mentions.length,
    avgSentiment,
    sentimentBreakdown,
    topThemes,
    trendingThreads,
    fetchedAt: new Date().toISOString(),
  }
}
