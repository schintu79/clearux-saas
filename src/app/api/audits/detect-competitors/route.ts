// ============================================================
// ClearUX API — GET /api/audits/detect-competitors?url=xxx
// Auto-detects industry from the site and returns top 3
// competitors with estimated UX scores based on lightweight
// analysis via Claude Haiku.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'

let _anthropic: Anthropic | null = null
function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
    _anthropic = new Anthropic({ apiKey, timeout: 30_000 })
  }
  return _anthropic
}

/** Lightweight page content fetcher — grabs title, meta, and some body text */
async function fetchSiteSnippet(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ClearUX Bot/1.0 (UX Audit)' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return ''
    const html = await res.text()

    // Extract useful bits
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = titleMatch?.[1]?.trim() || ''

    const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i)?.[1]?.trim() || ''
    const metaKeywords = html.match(/<meta\s+name=["']keywords["']\s+content=["']([\s\S]*?)["']/i)?.[1]?.trim() || ''

    // Strip tags from body, take first ~1500 chars of visible text
    const bodyMatch = html.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i)?.[1] || ''
    const visibleText = bodyMatch
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1500)

    return `Title: ${title}\nDescription: ${metaDesc}\nKeywords: ${metaKeywords}\nContent: ${visibleText}`
  } catch {
    return ''
  }
}

/** Use Claude Haiku to identify industry + top 3 competitors */
async function detectCompetitors(siteSnippet: string, domain: string): Promise<{
  industry: string
  competitors: Array<{
    domain: string
    name: string
    description: string
  }>
}> {
  const anthropic = getAnthropicClient()

  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: `Analyze this website and identify its industry and top 3 direct competitors.

Website domain: ${domain}
Website content:
${siteSnippet || `(Could not fetch content for ${domain} — use your knowledge of this domain)`}

Respond in JSON only, no explanation:
{
  "industry": "brief industry label (e.g. 'E-commerce', 'SaaS', 'Finance', 'Healthcare')",
  "competitors": [
    { "domain": "competitor1.com", "name": "Competitor 1 Name", "description": "Brief one-line description" },
    { "domain": "competitor2.com", "name": "Competitor 2 Name", "description": "Brief one-line description" },
    { "domain": "competitor3.com", "name": "Competitor 3 Name", "description": "Brief one-line description" }
  ]
}

Rules:
- Return exactly 3 competitors that are direct, well-known alternatives
- Use the actual main domain (e.g. "shopify.com" not "www.shopify.com")
- Competitors must be real, active websites
- If the domain is not recognizable, make your best guess from the content`,
      },
    ],
  })

  const text = resp.content[0]?.type === 'text' ? resp.content[0].text : ''

  // Parse JSON — handle markdown code fences
  const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  try {
    return JSON.parse(jsonStr)
  } catch {
    return { industry: 'Unknown', competitors: [] }
  }
}

/** Lightweight UX score estimation for a competitor using Claude Haiku */
async function estimateCompetitorScores(domain: string, siteSnippet: string): Promise<{
  overallScore: number
  pillarScores: Array<{ name: string; score: number }>
}> {
  const anthropic = getAnthropicClient()

  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `Based on your knowledge of ${domain} and this content snippet, estimate UX scores (0-100) for this website.

Content: ${siteSnippet.slice(0, 800) || '(no content available — use your general knowledge)'}

Score these 4 UX pillars and an overall score. Be realistic — most sites score 40-75.

Respond in JSON only:
{
  "overallScore": 65,
  "pillarScores": [
    { "name": "Foundation", "score": 70 },
    { "name": "Human Experience", "score": 60 },
    { "name": "Inclusive Design", "score": 55 },
    { "name": "Future Readiness", "score": 65 }
  ]
}

Pillars:
- Foundation: visual clarity, information architecture, navigation, typography
- Human Experience: interaction design, trust signals, error handling, emotional design
- Inclusive Design: accessibility, cognitive load, personalization, mobile experience
- Future Readiness: performance, discoverability, technical health, global readiness`,
      },
    ],
  })

  const text = resp.content[0]?.type === 'text' ? resp.content[0].text : ''
  const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  try {
    const parsed = JSON.parse(jsonStr)
    return {
      overallScore: Math.min(100, Math.max(0, parsed.overallScore || 50)),
      pillarScores: (parsed.pillarScores || []).map((p: any) => ({
        name: p.name,
        score: Math.min(100, Math.max(0, p.score || 50)),
      })),
    }
  } catch {
    return {
      overallScore: 55,
      pillarScores: [
        { name: 'Foundation', score: 58 },
        { name: 'Human Experience', score: 52 },
        { name: 'Inclusive Design', score: 48 },
        { name: 'Future Readiness', score: 50 },
      ],
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = request.nextUrl.searchParams.get('url')
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

    // Normalize
    const fullUrl = url.startsWith('http') ? url : `https://${url}`
    let domain: string
    try { domain = new URL(fullUrl).hostname.replace(/^www\./, '') } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    // Step 1: Fetch the user's site content for industry detection
    const siteSnippet = await fetchSiteSnippet(fullUrl)

    // Step 2: Detect industry + competitors via Claude Haiku
    const detection = await detectCompetitors(siteSnippet, domain)

    if (detection.competitors.length === 0) {
      return NextResponse.json({
        domain,
        industry: detection.industry,
        competitors: [],
        message: 'Could not detect competitors for this site',
      })
    }

    // Step 3: Fetch content snippets for each competitor in parallel
    const competitorSnippets = await Promise.all(
      detection.competitors.map(async (c) => {
        const snippet = await fetchSiteSnippet(`https://${c.domain}`)
        return { ...c, snippet }
      })
    )

    // Step 4: Estimate scores for each competitor in parallel
    const competitorScores = await Promise.all(
      competitorSnippets.map(async (c) => {
        const scores = await estimateCompetitorScores(c.domain, c.snippet)
        return {
          domain: c.domain,
          name: c.name,
          description: c.description,
          score: scores.overallScore,
          pillarScores: scores.pillarScores,
        }
      })
    )

    return NextResponse.json({
      domain,
      industry: detection.industry,
      competitors: competitorScores,
    })
  } catch (err) {
    console.error('GET /api/audits/detect-competitors error:', err)
    return NextResponse.json({ error: 'Failed to detect competitors' }, { status: 500 })
  }
}
