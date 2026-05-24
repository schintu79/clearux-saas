/**
 * Review Aggregation Service — Tier 2
 *
 * Fetches and normalizes review data from multiple platforms:
 * - G2 (API)
 * - Capterra (via SerpAPI fallback)
 * - Trustpilot (API)
 * - Google Places (API)
 * - Product Hunt (API)
 *
 * All platforms are optional — gracefully skips if API key is missing.
 * Returns a normalized ReviewAggregation with composite score.
 *
 * ENV VARS:
 *  - G2_API_KEY
 *  - TRUSTPILOT_API_KEY
 *  - GOOGLE_PLACES_API_KEY
 *  - SERP_API_KEY (used for Capterra/fallback scraping)
 */

import Anthropic from '@anthropic-ai/sdk'

/* ── Types ───────────────────────────────────────────── */

export interface ReviewEntry {
  title: string
  body: string
  rating: number // normalized 1-5
  date: string // ISO
  author: string
  platformUrl: string
  platform: string
}

export interface PlatformReviewData {
  platform: string
  aggregateScore: number // 0-5
  reviewCount: number
  sentimentPositive: number
  sentimentNeutral: number
  sentimentNegative: number
  topPositiveThemes: Array<{ theme: string; count: number }>
  topNegativeThemes: Array<{ theme: string; count: number }>
  recentReviews: ReviewEntry[]
}

export interface ReviewAggregation {
  compositeScore: number // 0-5 weighted average across platforms
  totalReviewCount: number
  platforms: PlatformReviewData[]
  topPositiveThemes: Array<{ theme: string; count: number }>
  topNegativeThemes: Array<{ theme: string; count: number }>
  fetchedAt: string
}

/* ── Platform fetchers ───────────────────────────────── */

async function fetchG2Reviews(brandDomain: string): Promise<PlatformReviewData | null> {
  const apiKey = process.env.G2_API_KEY
  if (!apiKey) return null

  try {
    // G2 API v2 — search for product by domain
    const searchRes = await fetch(
      `https://data.g2.com/api/v1/products?filter[domain]=${encodeURIComponent(brandDomain)}`,
      {
        headers: { Authorization: `Token token=${apiKey}`, Accept: 'application/vnd.api+json' },
        signal: AbortSignal.timeout(15000),
      }
    )
    if (!searchRes.ok) return null
    const searchData = await searchRes.json()
    const product = searchData?.data?.[0]
    if (!product) return null

    const productId = product.id
    const attrs = product.attributes || {}

    // Fetch recent reviews
    const reviewsRes = await fetch(
      `https://data.g2.com/api/v1/products/${productId}/reviews?page[size]=10&sort=-submitted_at`,
      {
        headers: { Authorization: `Token token=${apiKey}`, Accept: 'application/vnd.api+json' },
        signal: AbortSignal.timeout(15000),
      }
    )
    const reviewsData = reviewsRes.ok ? await reviewsRes.json() : { data: [] }
    const reviews: ReviewEntry[] = (reviewsData.data || []).map((r: any) => ({
      title: r.attributes?.title || '',
      body: r.attributes?.comment_answers?.love || r.attributes?.comment || '',
      rating: r.attributes?.star_rating || 0,
      date: r.attributes?.submitted_at || '',
      author: r.attributes?.user_name || 'Anonymous',
      platformUrl: `https://www.g2.com/products/${attrs.slug}/reviews`,
      platform: 'g2',
    }))

    return {
      platform: 'g2',
      aggregateScore: attrs.average_rating || 0,
      reviewCount: attrs.review_count || 0,
      sentimentPositive: reviews.filter(r => r.rating >= 4).length,
      sentimentNeutral: reviews.filter(r => r.rating === 3).length,
      sentimentNegative: reviews.filter(r => r.rating <= 2).length,
      topPositiveThemes: [],
      topNegativeThemes: [],
      recentReviews: reviews.slice(0, 10),
    }
  } catch (err) {
    console.warn('[reviews] G2 fetch failed:', err)
    return null
  }
}

async function fetchTrustpilotReviews(brandDomain: string): Promise<PlatformReviewData | null> {
  const apiKey = process.env.TRUSTPILOT_API_KEY
  if (!apiKey) return null

  try {
    // Find business unit by domain
    const findRes = await fetch(
      `https://api.trustpilot.com/v1/business-units/find?name=${encodeURIComponent(brandDomain)}`,
      {
        headers: { apikey: apiKey },
        signal: AbortSignal.timeout(15000),
      }
    )
    if (!findRes.ok) return null
    const businessUnit = await findRes.json()
    const buId = businessUnit?.id
    if (!buId) return null

    // Get reviews
    const reviewsRes = await fetch(
      `https://api.trustpilot.com/v1/business-units/${buId}/reviews?perPage=10&orderBy=recency`,
      {
        headers: { apikey: apiKey },
        signal: AbortSignal.timeout(15000),
      }
    )
    const reviewsData = reviewsRes.ok ? await reviewsRes.json() : { reviews: [] }
    const reviews: ReviewEntry[] = (reviewsData.reviews || []).map((r: any) => ({
      title: r.title || '',
      body: r.text || '',
      rating: r.stars || 0,
      date: r.createdAt || '',
      author: r.consumer?.displayName || 'Anonymous',
      platformUrl: `https://www.trustpilot.com/review/${brandDomain}`,
      platform: 'trustpilot',
    }))

    return {
      platform: 'trustpilot',
      aggregateScore: businessUnit.score?.trustScore || 0,
      reviewCount: businessUnit.numberOfReviews?.total || 0,
      sentimentPositive: reviews.filter(r => r.rating >= 4).length,
      sentimentNeutral: reviews.filter(r => r.rating === 3).length,
      sentimentNegative: reviews.filter(r => r.rating <= 2).length,
      topPositiveThemes: [],
      topNegativeThemes: [],
      recentReviews: reviews.slice(0, 10),
    }
  } catch (err) {
    console.warn('[reviews] Trustpilot fetch failed:', err)
    return null
  }
}

async function fetchGooglePlacesReviews(brandName: string): Promise<PlatformReviewData | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) return null

  try {
    // Find place by text search
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(brandName)}&inputtype=textquery&fields=place_id,rating,user_ratings_total&key=${apiKey}`,
      { signal: AbortSignal.timeout(15000) }
    )
    if (!searchRes.ok) return null
    const searchData = await searchRes.json()
    const candidate = searchData?.candidates?.[0]
    if (!candidate?.place_id) return null

    // Get place details with reviews
    const detailRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${candidate.place_id}&fields=reviews,rating,user_ratings_total&key=${apiKey}`,
      { signal: AbortSignal.timeout(15000) }
    )
    if (!detailRes.ok) return null
    const detailData = await detailRes.json()
    const result = detailData?.result

    const reviews: ReviewEntry[] = (result?.reviews || []).map((r: any) => ({
      title: '',
      body: r.text || '',
      rating: r.rating || 0,
      date: new Date((r.time || 0) * 1000).toISOString(),
      author: r.author_name || 'Anonymous',
      platformUrl: r.author_url || '',
      platform: 'google_places',
    }))

    return {
      platform: 'google_places',
      aggregateScore: result?.rating || 0,
      reviewCount: result?.user_ratings_total || 0,
      sentimentPositive: reviews.filter(r => r.rating >= 4).length,
      sentimentNeutral: reviews.filter(r => r.rating === 3).length,
      sentimentNegative: reviews.filter(r => r.rating <= 2).length,
      topPositiveThemes: [],
      topNegativeThemes: [],
      recentReviews: reviews.slice(0, 10),
    }
  } catch (err) {
    console.warn('[reviews] Google Places fetch failed:', err)
    return null
  }
}

/**
 * Fallback: use SerpAPI to find review data when direct APIs aren't available
 */
async function fetchSerpReviews(brandDomain: string, platform: string): Promise<PlatformReviewData | null> {
  const apiKey = process.env.SERP_API_KEY
  if (!apiKey) return null

  try {
    const query = `${brandDomain} reviews site:${platform}.com`
    const res = await fetch(
      `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${apiKey}&num=5`,
      { signal: AbortSignal.timeout(15000) }
    )
    if (!res.ok) return null
    const data = await res.json()

    // Extract what we can from search results
    const organic = data.organic_results || []
    if (organic.length === 0) return null

    // Try to extract rating from rich snippets
    const firstResult = organic[0]
    const rating = firstResult?.rich_snippet?.top?.detected_extensions?.rating || null
    const reviewCount = firstResult?.rich_snippet?.top?.detected_extensions?.reviews || null

    if (!rating) return null

    return {
      platform,
      aggregateScore: rating,
      reviewCount: reviewCount || 0,
      sentimentPositive: 0,
      sentimentNeutral: 0,
      sentimentNegative: 0,
      topPositiveThemes: [],
      topNegativeThemes: [],
      recentReviews: [],
    }
  } catch (err) {
    console.warn(`[reviews] SerpAPI ${platform} fetch failed:`, err)
    return null
  }
}

/* ── Theme extraction via LLM ────────────────────────── */

async function extractReviewThemes(
  reviews: ReviewEntry[]
): Promise<{ positive: Array<{ theme: string; count: number }>; negative: Array<{ theme: string; count: number }> }> {
  if (reviews.length === 0) return { positive: [], negative: [] }

  try {
    const client = new Anthropic()
    const reviewsText = reviews
      .map((r, i) => `Review ${i + 1} (${r.rating}/5): ${r.body.slice(0, 200)}`)
      .join('\n')

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Analyze these product reviews and extract the top themes. Return JSON only:
{"positive": [{"theme": "short phrase", "count": number}], "negative": [{"theme": "short phrase", "count": number}]}

Reviews:
${reviewsText}`,
      }],
    })

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    const parsed = JSON.parse(text)
    return {
      positive: (parsed.positive || []).slice(0, 5),
      negative: (parsed.negative || []).slice(0, 5),
    }
  } catch {
    return { positive: [], negative: [] }
  }
}

/* ── Public API ──────────────────────────────────────── */

/**
 * Fetch reviews from all available platforms and return aggregated data.
 * Gracefully handles missing API keys — only fetches from configured platforms.
 */
export async function fetchAllReviews(
  brandDomain: string,
  brandName: string,
): Promise<ReviewAggregation> {
  const results = await Promise.all([
    fetchG2Reviews(brandDomain),
    fetchTrustpilotReviews(brandDomain),
    fetchGooglePlacesReviews(brandName),
    fetchSerpReviews(brandDomain, 'capterra'),
    fetchSerpReviews(brandDomain, 'producthunt'),
  ])

  const platforms = results.filter((r): r is PlatformReviewData => r !== null)

  // Compute composite score (weighted by review count)
  let totalWeightedScore = 0
  let totalWeight = 0
  let totalReviewCount = 0
  for (const p of platforms) {
    const weight = Math.max(1, p.reviewCount)
    totalWeightedScore += p.aggregateScore * weight
    totalWeight += weight
    totalReviewCount += p.reviewCount
  }
  const compositeScore = totalWeight > 0 ? Math.round((totalWeightedScore / totalWeight) * 10) / 10 : 0

  // Extract themes from all recent reviews combined
  const allReviews = platforms.flatMap(p => p.recentReviews)
  const themes = await extractReviewThemes(allReviews)

  // Distribute themes back to platforms
  for (const p of platforms) {
    p.topPositiveThemes = themes.positive
    p.topNegativeThemes = themes.negative
  }

  return {
    compositeScore,
    totalReviewCount,
    platforms,
    topPositiveThemes: themes.positive,
    topNegativeThemes: themes.negative,
    fetchedAt: new Date().toISOString(),
  }
}
