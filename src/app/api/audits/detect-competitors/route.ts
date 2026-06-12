// ============================================================
// ClearUX API — Competitor Benchmarking
//
// GET  /api/audits/detect-competitors?url=xxx
//   → Load stored benchmarks for this domain
//
// POST /api/audits/detect-competitors
//   body: { url, mode: 'auto' | 'manual' | 'save', competitors?: ... }
//   - 'auto'   → LLM detects competitors, scores them, stores results
//   - 'manual' → caller supplies domains; we score them and store
//   - 'save'   → caller supplies the full edited list (name/domain/
//                category/note); we replace stored rows WITHOUT
//                re-scoring. Existing rows keep their scores when
//                domain matches; brand-new manual rows start at 0.
//
// DELETE /api/audits/detect-competitors?url=xxx&competitor=yyy
//   → Remove a single competitor row for this user+domain.
//
// Scoring fetches each competitor's real HTML and uses Claude to
// produce differentiated, content-aware UX scores.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
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

function normalizeDomain(url: string): string {
  const full = url.startsWith('http') ? url : `https://${url}`
  return new URL(full).hostname.replace(/^www\./, '')
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
      headers: { 'User-Agent': 'Fixpath Bot/1.0 (Brand Health Audit)' },
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

    const bodyHtml = html.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i)?.[1] || ''
    const visibleText = bodyHtml
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    return {
      title, metaDescription,
      h1Count, h2Count, imgCount, imgsWithAlt, linkCount,
      hasViewport, hasOpenGraph, hasStructuredData,
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
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `Identify the industry and top 5 direct competitors for this website.

Domain: ${domain}
Title: ${signals.title}
Description: ${signals.metaDescription}
Content preview: ${signals.bodyTextSnippet.slice(0, 800)}

JSON only:
{"industry":"e.g. Online Trading","competitors":[{"domain":"example.com","name":"Example"}]}

Rules:
- 5 competitors, direct alternatives in the same market
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

/* ── GET: Load stored benchmarks ─────────────────────────── */

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = request.nextUrl.searchParams.get('url')
    const workspaceId = request.nextUrl.searchParams.get('workspace_id')
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

    let domain: string
    try { domain = normalizeDomain(url) } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    const db = createServiceSupabase()
    let q = db
      .from('competitor_benchmarks')
      .select('*')
      .eq('user_id', user.id)
      .eq('domain', domain)
    if (workspaceId) q = q.eq('workspace_id', workspaceId)
    const { data: rows } = await q.order('created_at', { ascending: true })

    if (!rows || rows.length === 0) {
      return NextResponse.json({ domain, competitors: [] })
    }

    const competitors = rows.map((r: any) => ({
      domain: r.competitor_domain,
      name: r.competitor_name || r.competitor_domain,
      score: r.overall_score,
      pillarScores: r.pillar_scores || [],
      category: r.category || '',
      note: r.note || '',
      source: r.source || 'auto',
    }))

    return NextResponse.json({
      domain,
      industry: rows[0]?.industry || '',
      competitors,
      updatedAt: rows[0]?.updated_at,
    })
  } catch (err) {
    console.error('GET /api/audits/detect-competitors error:', err)
    return NextResponse.json({ error: 'Failed to load benchmarks' }, { status: 500 })
  }
}

/* ── POST: Run benchmark + store results ─────────────────── */

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { url, mode } = body as {
      url: string
      mode: 'auto' | 'manual' | 'save'
    }

    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

    let domain: string
    try { domain = normalizeDomain(url) } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    const fullUrl = url.startsWith('http') ? url : `https://${url}`
    const db = createServiceSupabase()

    /* ── 'save' — replace stored list with the user's edits ── */
    if (mode === 'save') {
      const rawList = Array.isArray((body as any).competitors) ? (body as any).competitors : []
      const cleaned = rawList
        .map((c: any) => {
          if (!c) return null
          const rawDomain = typeof c.domain === 'string' ? c.domain : ''
          const clean = rawDomain
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/.*$/, '')
            .trim()
            .toLowerCase()
          if (!clean) return null
          return {
            domain: clean,
            name: (typeof c.name === 'string' && c.name.trim()) ? c.name.trim() : clean,
            category: typeof c.category === 'string' ? c.category.trim().slice(0, 80) : '',
            note: typeof c.note === 'string' ? c.note.trim().slice(0, 280) : '',
          }
        })
        .filter(Boolean) as Array<{ domain: string; name: string; category: string; note: string }>

      // De-dupe by domain
      const seen = new Set<string>()
      const unique = cleaned.filter(c => {
        if (seen.has(c.domain)) return false
        seen.add(c.domain)
        return true
      }).slice(0, 5)

      // Pull existing rows so we keep their scores for unchanged domains
      const workspaceId = (body as any).workspace_id || null
      let existingQ = db
        .from('competitor_benchmarks')
        .select('*')
        .eq('user_id', user.id)
        .eq('domain', domain)
      if (workspaceId) existingQ = existingQ.eq('workspace_id', workspaceId)
      const { data: existing } = await existingQ
      const prior = new Map<string, any>()
      ;(existing || []).forEach((r: any) => prior.set(r.competitor_domain, r))
      const industryFromExisting = existing?.[0]?.industry || ''

      let delQ = db
        .from('competitor_benchmarks')
        .delete()
        .eq('user_id', user.id)
        .eq('domain', domain)
      if (workspaceId) delQ = delQ.eq('workspace_id', workspaceId)
      await delQ

      const inserts = unique.map(c => {
        const before = prior.get(c.domain)
        return {
          user_id: user.id,
          domain,
          competitor_domain: c.domain,
          competitor_name: c.name,
          overall_score: before?.overall_score ?? 0,
          pillar_scores: before?.pillar_scores ?? [],
          industry: before?.industry || industryFromExisting,
          category: c.category || null,
          note: c.note || null,
          source: before?.source || 'manual',
        }
      })

      if (inserts.length > 0) {
        const { error: uncheckedInsertErr1 } = await db.from('competitor_benchmarks').insert(inserts)
        if (uncheckedInsertErr1) console.error(`[db] insert failed (competitor_benchmarks): ${uncheckedInsertErr1.message}`)
      }

      return NextResponse.json({
        domain,
        industry: industryFromExisting,
        competitors: inserts.map(r => ({
          domain: r.competitor_domain,
          name: r.competitor_name,
          score: r.overall_score,
          pillarScores: r.pillar_scores,
          category: r.category || '',
          note: r.note || '',
          source: r.source,
        })),
      })
    }

    /* ── 'auto' or 'manual' — fetch and score competitors ── */
    let competitorDomains: Array<{ domain: string; name: string }>
    let industry = ''

    if (mode === 'manual') {
      const manualList = (body as any).competitors
      if (!Array.isArray(manualList) || manualList.length === 0) {
        return NextResponse.json({ error: 'competitors required for manual mode' }, { status: 400 })
      }
      competitorDomains = manualList
        .slice(0, 5)
        .map((d: any) => {
          const raw = typeof d === 'string' ? d : (d?.domain || '')
          const name = typeof d === 'string' ? '' : (d?.name || '')
          const clean = raw.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim().toLowerCase()
          return clean ? { domain: clean, name: name || clean } : null
        })
        .filter(Boolean) as Array<{ domain: string; name: string }>
    } else {
      const siteSignals = await fetchSiteSignals(fullUrl)
      const detection = await detectCompetitorDomains(siteSignals, domain)
      competitorDomains = detection.competitors
      industry = detection.industry
    }

    if (competitorDomains.length === 0) {
      return NextResponse.json({
        domain, industry,
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

    // Preserve manual category/note when re-scoring known domains
    const { data: prior } = await db
      .from('competitor_benchmarks')
      .select('competitor_domain, category, note')
      .eq('user_id', user.id)
      .eq('domain', domain)
    const meta = new Map<string, { category: string | null; note: string | null }>()
    ;(prior || []).forEach((r: any) => meta.set(r.competitor_domain, { category: r.category, note: r.note }))

    await db
      .from('competitor_benchmarks')
      .delete()
      .eq('user_id', user.id)
      .eq('domain', domain)

    const inserts = results.map(r => {
      const m = meta.get(r.domain) || { category: null, note: null }
      return {
        user_id: user.id,
        domain,
        competitor_domain: r.domain,
        competitor_name: r.name,
        overall_score: r.score,
        pillar_scores: r.pillarScores,
        industry,
        category: m.category,
        note: m.note,
        source: mode === 'manual' ? 'manual' : 'auto',
      }
    })

    const { error: uncheckedInsertErr2 } = await db.from('competitor_benchmarks').insert(inserts)
    if (uncheckedInsertErr2) console.error(`[db] insert failed (competitor_benchmarks): ${uncheckedInsertErr2.message}`)

    return NextResponse.json({
      domain,
      industry,
      competitors: results.map(r => {
        const m = meta.get(r.domain) || { category: null, note: null }
        return {
          ...r,
          category: m.category || '',
          note: m.note || '',
          source: mode === 'manual' ? 'manual' : 'auto',
        }
      }),
    })
  } catch (err) {
    console.error('POST /api/audits/detect-competitors error:', err)
    return NextResponse.json({ error: 'Failed to benchmark competitors' }, { status: 500 })
  }
}

/* ── DELETE: Remove a single competitor row ───────────────── */

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = request.nextUrl.searchParams.get('url')
    const competitor = request.nextUrl.searchParams.get('competitor')
    if (!url || !competitor) {
      return NextResponse.json({ error: 'url and competitor required' }, { status: 400 })
    }

    let domain: string
    let competitorDomain: string
    try {
      domain = normalizeDomain(url)
      competitorDomain = competitor.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim().toLowerCase()
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    const db = createServiceSupabase()
    await db
      .from('competitor_benchmarks')
      .delete()
      .eq('user_id', user.id)
      .eq('domain', domain)
      .eq('competitor_domain', competitorDomain)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/audits/detect-competitors error:', err)
    return NextResponse.json({ error: 'Failed to delete competitor' }, { status: 500 })
  }
}
