// ============================================================
// ClearUX API — Competitor Benchmarking
//
// POST /api/audits/detect-competitors
//   body: { url: string, mode: 'auto' | 'manual', competitors?: string[] }
//
// 'auto'   → AI detects industry + top 3 competitors, then scores them
// 'manual' → User provides up to 3 competitor domains, we score them
//
// Scoring: fetches each competitor's real HTML and uses Claude to
// produce differentiated, content-aware UX scores.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'

let _anthropic: Anthropic | null = null
function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
    _anthropic = new Anthropic({ apiKey, timeout: 45_000 })
  }
  return _anthropic
}

/* ── Fetch real page signals ──────────────────────────────── */

interface SiteSignals {
  title: string
  metaDescription: string
  h1Count: number
  h2Count: number
  imgCount: number
  imgsWithAlt: number
  linkCount: number
  hasViewport: boolean
  hasOpenGraph: boolean
  hasStructuredData: boolean
  hasHttps: boolean
  formCount: number
  navCount: number
  ariaCount: number
  inputCount: number
  bodyTextLength: number
  bodyTextSnippet: string
  loadedOk: boolean
}

async function fetchSiteSignals(url: string): Promise<SiteSignals> {
  const empty: SiteSignals = {
    title: '', metaDescription: '', h1Count: 0, h2Count: 0,
    imgCount: 0, imgsWithAlt: 0, linkCount: 0, hasViewport: false,
    hasOpenGraph: false, hasStructuredData: false, hasHttps: url.startsWith('https'),
    formCount: 0, navCount: 0, ariaCount: 0, inputCount: 0,
    bodyTextLength: 0, bodyTextSnippet: '', loadedOk: false,
  }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ClearUX Bot/1.0 (UX Audit)' },
      signal: AbortSignal.timeout(12_000),
      redirect: 'follow',
    })
    if (!res.ok) return empty
    const html = await res.text()

    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || ''
    const metaDescription = html.match(/<meta\s[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i)?.[1]?.trim()
      || html.match(/<meta\s[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i)?.[1]?.trim() || ''

    const h1Count = (html.match(/<h1[\s>]/gi) || []).length
    const h2Count = (html.match(/<h2[\s>]/gi) || []).length
    const imgCount = (html.match(/<img[\s>]/gi) || []).length
    const imgsWithAlt = (html.match(/<img\s[^>]*alt=["'][^"']+["']/gi) || []).length
    const linkCount = (html.match(/<a[\s>]/gi) || []).length
    const hasViewport = /<meta\s[^>]*name=["']viewport["']/i.test(html)
    const hasOpenGraph = /<meta\s[^>]*property=["']og:/i.test(html)
    const hasStructuredData = /application\/ld\+json/i.test(html) || /itemtype=["']https?:\/\/schema\.org/i.test(html)
    const formCount = (html.match(/<form[\s>]/gi) || []).length
    const navCount = (html.match(/<nav[\s>]/gi) || []).length
    const ariaCount = (html.match(/aria-/gi) || []).length
    const inputCount = (html.match(/<input[\s>]/gi) || []).length

    // Extract visible text
    const bodyHtml = html.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i)?.[1] || ''
    const visibleText = bodyHtml
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    return {
      title,
      metaDescription,
      h1Count, h2Count,
      imgCount, imgsWithAlt,
      linkCount, hasViewport, hasOpenGraph, hasStructuredData,
      hasHttps: url.startsWith('https'),
      formCount, navCount, ariaCount, inputCount,
      bodyTextLength: visibleText.length,
      bodyTextSnippet: visibleText.slice(0, 2000),
      loadedOk: true,
    }
  } catch {
    return empty
  }
}

/* ── Auto-detect competitors ──────────────────────────────── */

async function detectCompetitorDomains(signals: SiteSignals, domain: string): Promise<{
  industry: string
  competitors: Array<{ domain: string; name: string }>
}> {
  const anthropic = getAnthropicClient()

  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `Identify the industry and top 3 direct competitors for this website.

Domain: ${domain}
Title: ${signals.title}
Description: ${signals.metaDescription}
Content preview: ${signals.bodyTextSnippet.slice(0, 800)}

JSON only:
{"industry":"e.g. Online Trading","competitors":[{"domain":"example.com","name":"Example"}]}

Rules:
- 3 competitors, direct alternatives in the same market
- Use main domain only (no www)
- Must be real, well-known sites`,
    }],
  })

  const text = resp.content[0]?.type === 'text' ? resp.content[0].text : ''
  const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  try {
    return JSON.parse(jsonStr)
  } catch {
    return { industry: 'Unknown', competitors: [] }
  }
}

/* ── Score a competitor from real HTML signals ────────────── */

function formatSignalsForPrompt(domain: string, s: SiteSignals): string {
  return `SITE: ${domain}
Title: ${s.title || '(none)'}
Meta description: ${s.metaDescription || '(none)'}
Loaded: ${s.loadedOk ? 'yes' : 'FAILED'}
HTTPS: ${s.hasHttps ? 'yes' : 'no'}

STRUCTURE: ${s.h1Count} H1s, ${s.h2Count} H2s, ${s.navCount} nav elements, ${s.linkCount} links
IMAGES: ${s.imgCount} total, ${s.imgsWithAlt} with alt text (${s.imgCount > 0 ? Math.round(s.imgsWithAlt / s.imgCount * 100) : 0}% coverage)
FORMS: ${s.formCount} forms, ${s.inputCount} inputs
ACCESSIBILITY: ${s.ariaCount} ARIA attributes
SEO: viewport=${s.hasViewport}, OpenGraph=${s.hasOpenGraph}, structured-data=${s.hasStructuredData}
TEXT LENGTH: ${s.bodyTextLength} chars

CONTENT PREVIEW:
${s.bodyTextSnippet.slice(0, 1200)}`
}

async function scoreCompetitor(domain: string, signals: SiteSignals): Promise<{
  overallScore: number
  pillarScores: Array<{ name: string; score: number }>
}> {
  const anthropic = getAnthropicClient()

  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `You are a UX auditor scoring a website based on real HTML signals. Analyze the ACTUAL data below — do NOT use generic scores. Each site is different.

${formatSignalsForPrompt(domain, signals)}

Score 0-100 for each pillar based on the EVIDENCE above. Use these specific rules:

FOUNDATION (visual clarity, IA, navigation, typography):
- Good: multiple H2s for structure, nav elements present, clear title, ~1 H1
- Bad: missing H1, no nav, missing title, excessive H1s

HUMAN EXPERIENCE (interaction, trust, error handling, emotional):
- Good: forms present, many links (interactive), rich text content
- Bad: very short content, no forms/interactivity, no meta description

INCLUSIVE DESIGN (accessibility, cognitive load, mobile, personalization):
- Good: high ARIA count, viewport meta, good alt-text coverage
- Bad: no ARIA, missing viewport, images without alt text

FUTURE READINESS (performance, SEO, technical health):
- Good: HTTPS, OpenGraph, structured data, viewport
- Bad: no HTTPS, missing OG tags, no structured data

CRITICAL: Vary scores significantly between pillars based on the evidence. A site can have great Foundation (85) but poor Inclusive Design (35). DO NOT give similar scores to all pillars.

JSON only, no explanation:
{"overallScore":62,"pillarScores":[{"name":"Foundation","score":71},{"name":"Human Experience","score":58},{"name":"Inclusive Design","score":44},{"name":"Future Readiness","score":68}]}`,
    }],
  })

  const text = resp.content[0]?.type === 'text' ? resp.content[0].text : ''
  const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  try {
    const parsed = JSON.parse(jsonStr)
    const pillarScores = (parsed.pillarScores || []).map((p: any) => ({
      name: p.name,
      score: Math.min(100, Math.max(0, Math.round(p.score))),
    }))
    // Compute overall from pillar average (don't trust AI's overall)
    const avg = pillarScores.length > 0
      ? Math.round(pillarScores.reduce((s: number, p: any) => s + p.score, 0) / pillarScores.length)
      : Math.round(parsed.overallScore || 50)
    return { overallScore: avg, pillarScores }
  } catch {
    return {
      overallScore: 50,
      pillarScores: [
        { name: 'Foundation', score: 55 },
        { name: 'Human Experience', score: 48 },
        { name: 'Inclusive Design', score: 40 },
        { name: 'Future Readiness', score: 52 },
      ],
    }
  }
}

/* ── API handler ──────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { url, mode, competitors: manualDomains } = body as {
      url: string
      mode: 'auto' | 'manual'
      competitors?: string[]
    }

    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

    const fullUrl = url.startsWith('http') ? url : `https://${url}`
    let domain: string
    try { domain = new URL(fullUrl).hostname.replace(/^www\./, '') } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    let competitorDomains: Array<{ domain: string; name: string }>
    let industry = ''

    if (mode === 'manual' && manualDomains && manualDomains.length > 0) {
      // Manual mode: user provided domains
      competitorDomains = manualDomains.slice(0, 3).map(d => {
        const clean = d.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
        return { domain: clean, name: clean }
      })
    } else {
      // Auto mode: detect from site content
      const siteSignals = await fetchSiteSignals(fullUrl)
      const detection = await detectCompetitorDomains(siteSignals, domain)
      competitorDomains = detection.competitors
      industry = detection.industry
    }

    if (competitorDomains.length === 0) {
      return NextResponse.json({
        domain,
        industry,
        competitors: [],
        message: 'Could not identify competitors',
      })
    }

    // Fetch real HTML signals + score each competitor in parallel
    const results = await Promise.all(
      competitorDomains.map(async (c) => {
        const signals = await fetchSiteSignals(`https://${c.domain}`)
        const scores = await scoreCompetitor(c.domain, signals)
        return {
          domain: c.domain,
          name: c.name,
          score: scores.overallScore,
          pillarScores: scores.pillarScores,
        }
      })
    )

    return NextResponse.json({
      domain,
      industry,
      competitors: results,
    })
  } catch (err) {
    console.error('POST /api/audits/detect-competitors error:', err)
    return NextResponse.json({ error: 'Failed to benchmark competitors' }, { status: 500 })
  }
}
