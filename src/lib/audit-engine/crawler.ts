// ============================================================
// ClearUX Audit Engine — Robust Page Crawler
// Multi-strategy: direct fetch → Jina Reader fallback
// ============================================================
// PROPRIETARY — do not distribute outside the ClearUX codebase.
// ============================================================

import type { AuditPage } from '@/types/database'
import { isFirecrawlConfigured, firecrawlScrape, firecrawlMap } from '@/lib/crawl/firecrawl-client'
import { getFeatureFlags } from '@/lib/feature-flags'
import { extractMarkdownH1, shouldPreferRendered, rawHeadingAbsentFromRendered, looksClientHydrated } from '@/lib/audit-engine/render-divergence'
import { browserRenderPage } from '@/lib/audit-engine/browser-renderer'
import { isUpstreamErrorBody } from '@/lib/audit-engine/error-body'

/* ── Hostname normalization ───────────────────────────────── */

/** Strip www. prefix for hostname comparison so keycense.com ≡ www.keycense.com */
function normalizeHostname(hostname: string): string {
  return hostname.replace(/^www\./i, '').toLowerCase()
}

/** Check if two hostnames are equivalent (handles www/non-www) */
function isSameHost(a: string, b: string): boolean {
  return normalizeHostname(a) === normalizeHostname(b)
}

/** Tracking / analytics query params that never change page content */
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'twclid',
  'mc_cid', 'mc_eid', 'ref', '_ga', '_gl', 'hsCtaTracking',
  'hsa_cam', 'hsa_grp', 'hsa_mt', 'hsa_src', 'hsa_ad', 'hsa_acc',
  'hsa_net', 'hsa_ver', 'hsa_kw', 'hsa_tgt', 'hsa_la', 'hsa_ol',
])

/** Normalize a URL string for deduplication (strip www, trailing slash, fragment, tracking params, lowercase) */
function normalizeUrlForDedup(urlStr: string): string {
  try {
    const u = new URL(urlStr)
    u.hostname = normalizeHostname(u.hostname)
    u.hash = ''
    // Remove trailing slash except for bare domain
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1)
    }
    // Strip tracking / analytics query params
    for (const param of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(param.toLowerCase())) {
        u.searchParams.delete(param)
      }
    }
    // If no params left, remove the trailing ?
    u.search = u.searchParams.toString() ? `?${u.searchParams.toString()}` : ''
    return u.toString().toLowerCase()
  } catch {
    return urlStr.toLowerCase()
  }
}

/** Structured head tag data extracted from raw HTML */
export interface HeadTagData {
  lang: string | null
  canonical: string | null
  ogTags: Record<string, string>        // og:title, og:description, og:image, etc.
  twitterTags: Record<string, string>   // twitter:card, twitter:title, etc.
  hreflang: Array<{ lang: string; href: string }>
  robotsMeta: string | null             // content of <meta name="robots">
  jsonLd: Array<Record<string, unknown>>  // parsed JSON-LD blocks
  viewport: string | null
  charset: string | null
}

export interface CrawledPage {
  url: string
  title: string | null
  h1: string | null
  metaDescription: string | null
  contentText: string | null
  rawHtml?: string | null
  headTags?: HeadTagData | null
  /** Links discovered from the page (populated before content cleanup) */
  discoveredUrls?: string[]
  linksFound: number
  statusCode: number | null
  /** Wall-clock time spent fetching the page in milliseconds. Null when not measured. */
  loadTimeMs: number | null
  crawledAt: string
  /**
   * True when the site actively blocked our crawl (Cloudflare challenge,
   * anti-bot wall, CAPTCHA, etc.). When set, the audit should be marked
   * as blocked rather than failed, and the user's credit refunded.
   */
  blockedByBot?: boolean
  /** Human-readable description of the blocking mechanism detected */
  blockReason?: string
  /** Which fetch strategy succeeded: 'firecrawl' | 'direct' | 'jina' | 'google_cache' | null */
  fetchStrategy?: string
}

/** Statistics collected during the crawl for transparency reporting */
export interface CrawlStats {
  urlsDiscovered: number
  pagesAnalyzed: number
  pagesSkipped: number
  pagesBlocked: number
  pagesDuplicate: number
  pagesExcluded: number
  jsPagesDetected: number
  discoverySources: {
    sitemap: number
    htmlLinks: number
    commonPaths: number
    firecrawlMap: number
  }
  excludedUrls: Array<{ url: string; reason: string }>
  crawlStartedAt: string
  crawlCompletedAt: string
}

/* ── HTML parsing helpers ──────────────────────────────────── */

function extractTextContent(html: string): string {
  let text = html
    // Remove non-content elements
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    // Remove demo/example/illustrative content — these are display examples,
    // not actual features or patterns on the site being audited
    .replace(/<(?:aside|div|section|article)\b[^>]*data-demo=["']true["'][^>]*>[\s\S]*?<\/(?:aside|div|section|article)>/gi, '')
    .replace(/<(?:aside|div|section|article)\b[^>]*role=["']presentation["'][^>]*aria-label=["'][^"']*(?:example|demo|illustrative)[^"']*["'][^>]*>[\s\S]*?<\/(?:aside|div|section|article)>/gi, '')

  text = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")

  text = text.replace(/\s+/g, ' ').trim()
  return text.substring(0, 12000)
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match ? match[1].replace(/\s+/g, ' ').trim() : null
}

function extractH1(html: string): string | null {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (!match) return null
  return match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function extractMetaDescription(html: string): string | null {
  const match = html.match(
    /<meta\s+(?:name=["']description["']\s+content=["']([^"']*)["']|content=["']([^"']*)["']\s+name=["']description["'])/i,
  )
  return match ? (match[1] || match[2] || '').trim() : null
}

/** Extract structured head tag data from raw HTML */
function extractHeadTags(html: string): HeadTagData {
  // Isolate <head> section for efficiency
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
  const headHtml = headMatch ? headMatch[1] : html.substring(0, 10000) // fallback to first 10k chars

  // Lang attribute (on <html> tag, not in <head>)
  const langMatch = html.match(/<html[^>]*\slang=["']([^"']+)["']/i)
  const lang = langMatch ? langMatch[1].trim() : null

  // Canonical URL
  const canonicalMatch = headHtml.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
    || headHtml.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i)
  const canonical = canonicalMatch ? canonicalMatch[1].trim() : null

  // Open Graph tags
  const ogTags: Record<string, string> = {}
  const ogRegex = /<meta[^>]*(?:property|name)=["'](og:[^"']+)["'][^>]*content=["']([^"']*)["']/gi
  const ogRegex2 = /<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["'](og:[^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = ogRegex.exec(headHtml)) !== null) ogTags[m[1]] = m[2]
  while ((m = ogRegex2.exec(headHtml)) !== null) ogTags[m[2]] = m[1]

  // Twitter Card tags
  const twitterTags: Record<string, string> = {}
  const twRegex = /<meta[^>]*(?:property|name)=["'](twitter:[^"']+)["'][^>]*content=["']([^"']*)["']/gi
  const twRegex2 = /<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["'](twitter:[^"']+)["']/gi
  while ((m = twRegex.exec(headHtml)) !== null) twitterTags[m[1]] = m[2]
  while ((m = twRegex2.exec(headHtml)) !== null) twitterTags[m[2]] = m[1]

  // Hreflang links
  const hreflang: Array<{ lang: string; href: string }> = []
  const hlRegex = /<link[^>]*rel=["']alternate["'][^>]*hreflang=["']([^"']+)["'][^>]*href=["']([^"']+)["']/gi
  const hlRegex2 = /<link[^>]*hreflang=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["']/gi
  while ((m = hlRegex.exec(headHtml)) !== null) hreflang.push({ lang: m[1], href: m[2] })
  while ((m = hlRegex2.exec(headHtml)) !== null) hreflang.push({ lang: m[1], href: m[2] })

  // Robots meta
  const robotsMatch = headHtml.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i)
    || headHtml.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']robots["']/i)
  const robotsMeta = robotsMatch ? robotsMatch[1].trim() : null

  // JSON-LD structured data
  const jsonLd: Array<Record<string, unknown>> = []
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

  const addItem = (item: Record<string, unknown>) => {
    jsonLd.push(item)
    // Flatten @graph arrays so individual types (Organization, WebSite, etc.) are discoverable
    if (Array.isArray(item['@graph'])) {
      for (const graphItem of item['@graph']) {
        if (graphItem && typeof graphItem === 'object') jsonLd.push(graphItem as Record<string, unknown>)
      }
    }
  }

  while ((m = jsonLdRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1])
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') addItem(item as Record<string, unknown>)
        }
      } else if (parsed && typeof parsed === 'object') {
        addItem(parsed as Record<string, unknown>)
      }
    } catch {
      // Invalid JSON-LD — skip
    }
  }

  // Viewport
  const viewportMatch = headHtml.match(/<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']*)["']/i)
    || headHtml.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']viewport["']/i)
  const viewport = viewportMatch ? viewportMatch[1].trim() : null

  // Charset
  const charsetMatch = headHtml.match(/<meta[^>]*charset=["']([^"']+)["']/i)
    || headHtml.match(/<meta[^>]*http-equiv=["']Content-Type["'][^>]*content=["'][^"']*charset=([^"';\s]+)/i)
  const charset = charsetMatch ? charsetMatch[1].trim() : null

  return { lang, canonical, ogTags, twitterTags, hreflang, robotsMeta, jsonLd, viewport, charset }
}

/** Format head tag data as a compact text block for analyzer context */
export function formatHeadTagsForAnalysis(ht: HeadTagData): string {
  const lines: string[] = []
  if (ht.lang) lines.push(`lang="${ht.lang}"`)
  if (ht.canonical) lines.push(`canonical: ${ht.canonical}`)
  if (ht.viewport) lines.push(`viewport: ${ht.viewport}`)
  if (ht.robotsMeta) lines.push(`robots: ${ht.robotsMeta}`)
  if (ht.charset) lines.push(`charset: ${ht.charset}`)

  const ogKeys = Object.keys(ht.ogTags)
  if (ogKeys.length > 0) {
    lines.push(`OG tags: ${ogKeys.map(k => `${k}="${ht.ogTags[k]}"`).join(', ')}`)
  }

  const twKeys = Object.keys(ht.twitterTags)
  if (twKeys.length > 0) {
    lines.push(`Twitter tags: ${twKeys.map(k => `${k}="${ht.twitterTags[k]}"`).join(', ')}`)
  }

  if (ht.hreflang.length > 0) {
    lines.push(`hreflang: ${ht.hreflang.map(h => `${h.lang}=${h.href}`).join(', ')}`)
  }

  if (ht.jsonLd.length > 0) {
    const types = ht.jsonLd.map(j => (j['@type'] as string) || 'unknown').join(', ')
    lines.push(`JSON-LD: ${ht.jsonLd.length} block(s) [${types}]`)
    // Include compact JSON-LD for validator
    for (const block of ht.jsonLd) {
      try {
        const compact = JSON.stringify(block).substring(0, 500)
        lines.push(`  ${compact}`)
      } catch { /* skip */ }
    }
  }

  return lines.length > 0 ? lines.join('\n') : ''
}

function extractLinks(html: string, pageUrl: string): { links: URL[]; count: number } {
  const baseUrl = new URL(pageUrl)
  const links: URL[] = []

  function addLink(href: string) {
    try {
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:') || href.startsWith('data:')) return
      const url = href.startsWith('http') ? new URL(href) : new URL(href, pageUrl)
      if (isSameHost(url.hostname, baseUrl.hostname)) links.push(url)
    } catch { /* skip invalid */ }
  }

  // 1. Standard <a href> extraction
  const linkRegex = /<a\s+[^>]*href=["']([^"']*)["']/gi
  let match
  while ((match = linkRegex.exec(html)) !== null) addLink(match[1])

  // 2. Also extract from <link rel="alternate/canonical"> and other <link> elements
  const metaLinkRegex = /<link\s+[^>]*href=["']([^"']*)["'][^>]*>/gi
  while ((match = metaLinkRegex.exec(html)) !== null) {
    // Only include if it's a page-like link (not stylesheet, icon, etc.)
    const tag = match[0].toLowerCase()
    if (tag.includes('rel="alternate"') || tag.includes('rel="canonical"') || tag.includes('hreflang')) {
      addLink(match[1])
    }
  }

  // 3. Extract from Next.js __NEXT_DATA__ JSON (catches client-side route links)
  const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
  if (nextDataMatch) {
    // Extract all path-like strings from the JSON (e.g. "/pricing", "/about")
    const pathRegex = /"(\/[a-zA-Z0-9][\w\-\/]*?)"/g
    let pathMatch
    while ((pathMatch = pathRegex.exec(nextDataMatch[1])) !== null) {
      const path = pathMatch[1]
      // Filter out API routes, asset paths, and query params
      if (!path.startsWith('/api/') && !path.startsWith('/_next/') && !path.startsWith('/static/') &&
          !path.includes('.') && path.length > 1 && path.length < 80) {
        addLink(path)
      }
    }
  }

  // 4. Extract from inline <script> route definitions (common in SPAs)
  // Catches patterns like: {path:"/pricing"} or routes:["/about","/pricing"]
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi
  let scriptMatch
  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    const script = scriptMatch[1]
    // Only process scripts that look like they contain route data
    if (script.includes('path') || script.includes('route') || script.includes('href')) {
      const routeRegex = /["'](\/[a-zA-Z][\w\-\/]{1,60})["']/g
      let routeMatch
      while ((routeMatch = routeRegex.exec(script)) !== null) {
        const path = routeMatch[1]
        if (!path.startsWith('/api/') && !path.startsWith('/_next/') && !path.startsWith('/static/') &&
            !path.startsWith('/node_modules') && !path.includes('.') && path.length > 1) {
          addLink(path)
        }
      }
    }
  }

  // 5. Also extract links from <nav> elements specifically (catches JS framework nav menus)
  const navRegex = /<nav\b[^>]*>([\s\S]*?)<\/nav>/gi
  let navMatch
  while ((navMatch = navRegex.exec(html)) !== null) {
    const navHtml = navMatch[1]
    const navLinkRegex = /<a\s+[^>]*href=["']([^"']*)["']/gi
    let navLink
    while ((navLink = navLinkRegex.exec(navHtml)) !== null) addLink(navLink[1])
  }

  const dedupedLinks = [...new Map(links.map((l) => [normalizeUrlForDedup(l.toString()), l])).values()]
  console.log(`[crawler] extractLinks: found ${dedupedLinks.length} unique internal links from HTML (${links.length} raw)`)
  return { links: dedupedLinks, count: links.length }
}

/* ── Bot-detection checks ──────────────────────────────────── */

/** Map of anti-bot patterns to human-readable descriptions */
const BLOCKED_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /challenge-platform/i, label: 'Cloudflare challenge' },
  { pattern: /cf-browser-verification/i, label: 'Cloudflare browser verification' },
  { pattern: /cloudflare/i, label: 'Cloudflare protection' },
  { pattern: /just a moment/i, label: 'Cloudflare waiting page' },
  { pattern: /checking your browser/i, label: 'Browser verification wall' },
  { pattern: /enable javascript/i, label: 'JavaScript-required gate' },
  { pattern: /please enable cookies/i, label: 'Cookie-required gate' },
  { pattern: /access denied/i, label: 'Access denied page' },
  { pattern: /attention required/i, label: 'Cloudflare attention page' },
  { pattern: /ddos-guard/i, label: 'DDoS-Guard protection' },
  { pattern: /sucuri/i, label: 'Sucuri WAF protection' },
  { pattern: /incapsula/i, label: 'Imperva/Incapsula protection' },
  { pattern: /bot detection/i, label: 'Bot detection system' },
  { pattern: /are you a robot/i, label: 'Robot verification' },
  { pattern: /captcha/i, label: 'CAPTCHA challenge' },
  { pattern: /akamai/i, label: 'Akamai Bot Manager' },
  { pattern: /perimeterx/i, label: 'PerimeterX protection' },
  { pattern: /datadome/i, label: 'DataDome protection' },
]

/** Status code descriptions for blocked responses */
const BLOCKED_STATUS_REASONS: Record<number, string> = {
  403: 'HTTP 403 Forbidden — the server rejected our request',
  429: 'HTTP 429 Too Many Requests — rate limiting in effect',
  503: 'HTTP 503 Service Unavailable — possible bot challenge page',
}

/**
 * Detect if the response is a Cloudflare/bot-challenge page.
 * Returns `null` if not blocked, or a human-readable reason string.
 */
function detectBlockReason(html: string, statusCode: number | null): string | null {
  // Check status codes first
  if (statusCode && BLOCKED_STATUS_REASONS[statusCode]) {
    return BLOCKED_STATUS_REASONS[statusCode]
  }

  // Only flag if content is suspiciously short AND matches a pattern
  const textContent = extractTextContent(html)
  if (textContent.length < 500) {
    for (const { pattern, label } of BLOCKED_PATTERNS) {
      if (pattern.test(html) || pattern.test(textContent)) return label
    }
  }

  return null
}

/** Backwards-compatible boolean wrapper */
function isBlockedResponse(html: string, statusCode: number | null): boolean {
  return detectBlockReason(html, statusCode) !== null
}

/* ── Strategy 1: Direct fetch with realistic headers ───────── */

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
]

// ── Polite crawl configuration ────────────────────────────────
// When FEATURE_POLITE_CRAWLER is on, the crawler uses a consistent UA
// per session, lower concurrency, and longer delays with jitter.

/** Session-scoped UA — set once per crawlPages() call when polite mode is on */
let _sessionUA: string | null = null

/** Get the user-agent for this request. Polite mode = consistent per session. */
function getRequestUA(): string {
  if (_sessionUA) return _sessionUA
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

/** Polite delay with jitter — returns a promise that resolves after 500-2000ms */
function politeDelay(): Promise<void> {
  const baseMs = 500
  const jitterMs = Math.floor(Math.random() * 1500)
  return new Promise(resolve => setTimeout(resolve, baseMs + jitterMs))
}

/** Standard (legacy) brief delay between batches — 150ms */
function legacyDelay(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 150))
}

/** Crawl batch size — polite mode uses 3, legacy uses 5 */
function getCrawlBatchSize(polite: boolean): number {
  return polite ? 3 : 5
}

async function directFetch(url: string, timeoutMs: number = 8000): Promise<CrawledPage | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const ua = getRequestUA()
    const fetchStart = Date.now()

    const response = await fetch(url, {
      headers: {
        'User-Agent': ua,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        DNT: '1',
        Connection: 'keep-alive',
      },
      signal: controller.signal,
      redirect: 'follow',
      cache: 'no-store',
    })

    const html = await response.text()
    const loadTimeMs = Date.now() - fetchStart

    // Check if we got blocked
    const blockReason = detectBlockReason(html, response.status)
    if (!response.ok || blockReason) {
      console.warn(`[crawler] Direct fetch blocked for ${url} (status ${response.status}, reason: ${blockReason || 'non-ok status'})`)
      // Return a page stub with the block flag so the caller knows WHY it failed
      return {
        url,
        title: null,
        h1: null,
        metaDescription: null,
        contentText: null,
        linksFound: 0,
        statusCode: response.status,
        loadTimeMs: Date.now() - fetchStart,
        crawledAt: new Date().toISOString(),
        blockedByBot: !!blockReason,
        blockReason: blockReason || `HTTP ${response.status}`,
      }
    }

    const title = extractTitle(html)
    const h1 = extractH1(html)
    const metaDescription = extractMetaDescription(html)
    const contentText = extractTextContent(html)
    const { count: linksFound } = extractLinks(html, url)

    // An HTTP 200 can still carry a proxy/upstream ERROR body (envoy "upstream
    // connect error", 502/503/504 stubs). That is not page content — never feed
    // it to analysis. Treat as a failed fetch so a fallback strategy can try.
    if (isUpstreamErrorBody(contentText)) {
      console.warn(`[crawler] Direct fetch got an upstream/proxy error body for ${url} — treating as failed`)
      return null
    }

    // If we got a response but content is suspiciously empty, flag it
    if (!contentText || contentText.length < 100) {
      console.warn(`[crawler] Direct fetch returned very little content for ${url} (${contentText?.length || 0} chars)`)
      return null // Try fallback
    }

    const headTags = extractHeadTags(html)

    return {
      url: response.url || url, // Use resolved URL after redirects (e.g. keycense.com → www.keycense.com)
      title,
      h1,
      metaDescription,
      contentText,
      rawHtml: html,
      headTags,
      linksFound,
      statusCode: response.status,
      loadTimeMs,
      crawledAt: new Date().toISOString(),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.warn(`[crawler] Direct fetch failed for ${url}: ${message}`)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/* ── Strategy 2: Jina Reader API (handles JS rendering + bot bypass) ── */

async function jinaFetch(url: string, timeoutMs: number = 10000): Promise<CrawledPage | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const fetchStart = Date.now()

  try {
    const jinaUrl = `https://r.jina.ai/${url}`
    console.log(`[crawler] Using Jina Reader for ${url}`)

    const headers: Record<string, string> = {
      Accept: 'application/json',
      // Markdown (not plain text) so the rendered H1 ("# Heading") is parseable —
      // we use it to detect when the raw-HTTP page is stale vs the rendered page.
      // The cleaning step below strips markdown, so analyzer-facing text is unchanged.
      'X-Return-Format': 'markdown',
      'X-No-Cache': 'true',
      'Cache-Control': 'no-cache',
      'X-With-Links': 'true', // Get rendered navigation links (critical for SPAs)
    }

    // Use Jina API key if available (higher rate limits)
    const jinaKey = process.env.JINA_API_KEY
    if (jinaKey) {
      headers['Authorization'] = `Bearer ${jinaKey}`
    }

    const response = await fetch(jinaUrl, {
      headers,
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!response.ok) {
      console.warn(`[crawler] Jina Reader failed for ${url}: ${response.status}`)
      return null
    }

    const contentType = response.headers.get('content-type') || ''
    let contentText: string
    let title: string | null = null
    let description: string | null = null

    let jinaLinksMap: Record<string, string> | null = null
    if (contentType.includes('application/json')) {
      const json = await response.json() as any
      contentText = json.data?.content || json.data?.text || json.text || ''
      title = json.data?.title || json.title || null
      description = json.data?.description || null
      // X-With-Links: Jina returns rendered page links as { url: anchorText }
      jinaLinksMap = json.data?.links || json.links || null
    } else {
      contentText = await response.text()
      // Try to extract title from markdown (Jina often returns "Title: ...\n")
      const titleMatch = contentText.match(/^Title:\s*(.+)$/m)
      if (titleMatch) title = titleMatch[1].trim()
    }

    if (!contentText || contentText.length < 50) {
      console.warn(`[crawler] Jina returned too little content for ${url}`)
      return null
    }

    // Jina renders, but a rendered proxy/upstream error body is still not page
    // content (e.g. raseed /ar/options → "upstream connect error..."). Reject it
    // so it is never stored as a page or fed to analysis.
    if (isUpstreamErrorBody(contentText)) {
      console.warn(`[crawler] Jina got an upstream/proxy error body for ${url} — treating as failed`)
      return null
    }

    // Extract the rendered H1 from the RAW markdown BEFORE cleaning strips it.
    // This is the JS-executed heading — the ground truth for divergence detection.
    const renderedH1 = extractMarkdownH1(contentText)

    // Extract links from the RAW markdown BEFORE cleaning (critical for discovery)
    const rawLinks = extractLinksFromText(contentText, url)
    const discoveredUrls = rawLinks.map((l) => l.toString())

    // Also include links from X-With-Links response (rendered navigation links from SPAs)
    if (jinaLinksMap && typeof jinaLinksMap === 'object') {
      const baseHost = new URL(url).hostname
      for (const href of Object.keys(jinaLinksMap)) {
        try {
          const resolved = new URL(href, url)
          if (isSameHost(resolved.hostname, baseHost)) {
            const urlStr = resolved.toString()
            if (!discoveredUrls.includes(urlStr)) {
              discoveredUrls.push(urlStr)
            }
          }
        } catch { /* skip invalid */ }
      }
    }

    console.log(`[crawler] Jina extracted ${discoveredUrls.length} links for ${url} (markdown: ${rawLinks.length}, X-With-Links: ${jinaLinksMap ? Object.keys(jinaLinksMap).length : 0})`)

    // Clean up Jina markdown formatting for our purposes
    contentText = contentText
      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove image markdown
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1') // Links to text
      .replace(/#{1,6}\s/g, '') // Remove markdown headers
      .replace(/\*\*/g, '') // Remove bold
      .replace(/\*/g, '') // Remove italic
      .replace(/`{1,3}/g, '') // Remove code markers
      .replace(/\n{3,}/g, '\n\n') // Normalize newlines
      .trim()
      .substring(0, 12000)

    return {
      url,
      title,
      h1: renderedH1, // rendered (JS-executed) H1, parsed from Jina markdown
      metaDescription: description,
      contentText,
      rawHtml: null, // Jina returns text, not HTML
      headTags: null, // No raw HTML available from Jina
      discoveredUrls,
      linksFound: discoveredUrls.length,
      statusCode: 200,
      loadTimeMs: Date.now() - fetchStart,
      crawledAt: new Date().toISOString(),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.warn(`[crawler] Jina fetch failed for ${url}: ${message}`)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/* ── Strategy 0: Firecrawl (primary when configured) ──────── */

async function firecrawlFetch(url: string): Promise<CrawledPage | null> {
  if (!isFirecrawlConfigured()) return null

  const fetchStart = Date.now()
  try {
    const result = await firecrawlScrape(url, {
      formats: ['markdown', 'html', 'links'],
      onlyMainContent: false,
      timeout: 25000,
    })

    if (!result) return null

    const loadTimeMs = Date.now() - fetchStart
    const html = result.html || result.rawHtml || null
    const markdown = result.markdown || null
    const statusCode = result.metadata?.statusCode ?? 200

    // Use markdown for content text (cleaner than HTML extraction)
    let contentText = markdown
    if (contentText) {
      contentText = contentText
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
        .replace(/#{1,6}\s/g, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/`{1,3}/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .substring(0, 12000)
    }

    // If content is too thin, let other strategies try
    if (!contentText || contentText.length < 100) {
      console.warn(`[crawler] Firecrawl returned thin content for ${url} (${contentText?.length || 0} chars)`)
      return null
    }

    // Extract head tags from HTML if available
    const headTags = html ? extractHeadTags(html) : null

    // Parse title + meta from Firecrawl metadata (more reliable than re-parsing)
    const title = result.metadata?.title || (html ? extractTitle(html) : null)
    const metaDescription = result.metadata?.description || (html ? extractMetaDescription(html) : null)
    const h1 = html ? extractH1(html) : null

    // Internal links from Firecrawl's links array
    const discoveredUrls: string[] = []
    if (result.links && result.links.length > 0) {
      const baseHost = new URL(url).hostname
      for (const href of result.links) {
        try {
          const resolved = new URL(href, url)
          if (isSameHost(resolved.hostname, baseHost)) {
            discoveredUrls.push(resolved.toString())
          }
        } catch { /* skip invalid */ }
      }
    }

    // Also extract links from HTML for better coverage
    let linksFound = discoveredUrls.length
    if (html) {
      const htmlLinks = extractLinks(html, url)
      linksFound = Math.max(linksFound, htmlLinks.count)
      // Merge HTML-extracted links into discoveredUrls
      for (const link of htmlLinks.links) {
        const str = link.toString()
        if (!discoveredUrls.includes(str)) discoveredUrls.push(str)
      }
    }

    // Check for bot blocking via the HTML
    if (html) {
      const blockReason = detectBlockReason(html, statusCode)
      if (blockReason) {
        console.warn(`[crawler] Firecrawl detected blocking for ${url}: ${blockReason}`)
        return {
          url,
          title: null,
          h1: null,
          metaDescription: null,
          contentText: null,
          linksFound: 0,
          statusCode,
          loadTimeMs,
          crawledAt: new Date().toISOString(),
          blockedByBot: true,
          blockReason,
          fetchStrategy: 'firecrawl',
        }
      }
    }

    console.log(`[crawler] Firecrawl succeeded for ${url} (${contentText.length} chars, ${discoveredUrls.length} links, ${loadTimeMs}ms)`)

    return {
      url,
      title,
      h1,
      metaDescription,
      contentText,
      rawHtml: html,
      headTags,
      discoveredUrls,
      linksFound,
      statusCode,
      loadTimeMs,
      crawledAt: new Date().toISOString(),
      fetchStrategy: 'firecrawl',
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[crawler] Firecrawl fetch failed for ${url}: ${msg}`)
    return null
  }
}

/* ── Multi-strategy fetch (Firecrawl → direct + Jina) ────── */

const PAGE_FETCH_TIMEOUT_MS = 30_000 // 30s hard budget per page fetch

// Bounded browser-render escalations per crawl. Browser render is the last-resort
// way to get rendered content when Jina is unavailable for a hydration-suspect
// page; cap it so a global Jina outage can't trigger a Chromium launch per page.
const MAX_BROWSER_ESCALATIONS_PER_CRAWL = 4
let browserEscalationsUsed = 0
/** Reset the per-crawl browser-escalation budget. Called at crawl start. */
export function resetBrowserEscalationBudget(): void {
  browserEscalationsUsed = 0
}

async function fetchPageRobust(url: string): Promise<CrawledPage | null> {
  // Strategy priority: Firecrawl (when configured) → direct + Jina (parallel fallback).
  // Wrapped in a hard timeout to prevent any single page from blocking the crawl.
  const fetchBody = async (): Promise<CrawledPage | null> => {

  // Try Firecrawl first (best quality: handles JS rendering, returns markdown + HTML + links)
  if (isFirecrawlConfigured()) {
    const fcResult = await firecrawlFetch(url)
    if (fcResult && fcResult.contentText && fcResult.contentText.length >= 100) {
      return fcResult
    }
    // If Firecrawl returned a blocked stub, still propagate it
    if (fcResult?.blockedByBot) return fcResult
    // Otherwise fall through to direct + Jina
    console.log(`[crawler] Firecrawl insufficient for ${url} — falling back to direct + Jina`)
  }

  // Fallback: Run direct fetch and Jina in PARALLEL
  const directPromise = directFetch(url).catch(() => null)
  // Jina (free tier) intermittently fails / rate-limits — on raseed deep runs it
  // failed for the homepage specifically, silently reverting that page to stale
  // raw HTML. Retry once so a transient failure doesn't lose the rendered view.
  const jinaPromise = jinaFetch(url).catch(() => null).then(async (r) => {
    if (r && r.contentText && r.contentText.length >= 50) return r
    return await jinaFetch(url).catch(() => null)
  })

  // Wait for both in parallel
  const [directResult, jinaResult] = await Promise.all([directPromise, jinaPromise])

  // Prefer direct fetch (gives us rawHtml for link extraction) — UNLESS the
  // rendered (Jina) acquisition proves the raw HTML is STALE. For client-hydrated
  // / stale-SSR sites (e.g. raseedinvest.com) the raw HTTP HTML is a complete but
  // outdated build, so the analyzer would judge a page the world never sees.
  // When the raw <h1> diverges from the rendered <h1> (or is absent from rendered
  // content), trust the rendered CONTENT for analysis while keeping direct's
  // rawHtml/headTags for link extraction + structured-data. Static sites — where
  // raw and rendered agree — are unaffected (no regression).
  if (directResult && directResult.contentText && directResult.contentText.length >= 100) {
    const renderedUsable = !!(jinaResult && jinaResult.contentText && jinaResult.contentText.length >= 50)
    if (
      renderedUsable &&
      shouldPreferRendered({
        rawH1: directResult.h1,
        renderedH1: jinaResult!.h1,
        renderedContent: jinaResult!.contentText,
      })
    ) {
      const mergedDiscovered = Array.from(new Set([
        ...(directResult.discoveredUrls || []),
        ...(jinaResult!.discoveredUrls || []),
      ]))
      // Never propagate a confirmed-stale raw H1; prefer the rendered one.
      const rawH1Stale = rawHeadingAbsentFromRendered(directResult.h1, jinaResult!.contentText)
      const merged: CrawledPage = {
        ...directResult,
        contentText: jinaResult!.contentText,
        title: jinaResult!.title || directResult.title,
        metaDescription: jinaResult!.metaDescription ?? directResult.metaDescription,
        h1: jinaResult!.h1 || (rawH1Stale ? null : directResult.h1),
        discoveredUrls: mergedDiscovered,
        fetchStrategy: 'direct+rendered',
      }
      console.warn(
        `[crawler] STALE raw HTML for ${url}: raw H1 "${directResult.h1}" diverges from rendered H1 "${jinaResult!.h1}" — using rendered content for analysis`,
      )
      return merged
    }

    // Rendered (Jina) acquisition unusable, but the raw HTML looks client-hydrated
    // — its static build may be stale. Escalate to a real browser render (bounded)
    // rather than silently trusting raw HTML. This is what catches the homepage
    // when Jina is down for that page. Wrapped so it can never break the crawl.
    if (
      !renderedUsable &&
      browserEscalationsUsed < MAX_BROWSER_ESCALATIONS_PER_CRAWL &&
      looksClientHydrated(directResult.rawHtml)
    ) {
      browserEscalationsUsed++
      try {
        const br = await browserRenderPage(url)
        if (br && br.contentText && br.contentText.length >= 50 && !br.blockedByBot) {
          if (shouldPreferRendered({ rawH1: directResult.h1, renderedH1: br.h1, renderedContent: br.contentText })) {
            const rawH1Stale = rawHeadingAbsentFromRendered(directResult.h1, br.contentText)
            console.warn(`[crawler] STALE raw HTML for ${url} (Jina unavailable) — used browser render; raw H1 "${directResult.h1}" vs rendered "${br.h1}"`)
            return {
              ...directResult,
              contentText: br.contentText,
              title: br.title || directResult.title,
              metaDescription: br.metaDescription ?? directResult.metaDescription,
              h1: br.h1 || (rawH1Stale ? null : directResult.h1),
              rawHtml: br.rawHtml || directResult.rawHtml,
              headTags: br.headTags || directResult.headTags,
              discoveredUrls: Array.from(new Set([
                ...(directResult.discoveredUrls || []),
                ...(br.discoveredUrls || []),
              ])),
              fetchStrategy: 'direct+browser',
            }
          }
        }
      } catch (e) {
        console.warn(`[crawler] browser-render escalation failed for ${url}:`, (e as Error)?.message)
      }
    }

    console.log(`[crawler] Direct fetch succeeded for ${url} (${directResult.contentText.length} chars)`)
    directResult.fetchStrategy = 'direct'
    return directResult
  }

  // Fall back to Jina
  if (jinaResult && jinaResult.contentText && jinaResult.contentText.length >= 50) {
    console.log(`[crawler] Jina Reader succeeded for ${url} (${jinaResult.contentText.length} chars)`)
    jinaResult.fetchStrategy = 'jina'
    return jinaResult
  }

  console.error(`[crawler] All strategies failed for ${url}`)

  // If we detected bot blocking during direct fetch, propagate that info
  if (directResult?.blockedByBot) {
    console.warn(`[crawler] Site appears blocked by anti-bot protection: ${directResult.blockReason}`)
    return directResult
  }

  return {
    url,
    title: null,
    h1: null,
    metaDescription: null,
    contentText: null,
    linksFound: 0,
    statusCode: null,
    loadTimeMs: null,
    crawledAt: new Date().toISOString(),
  }
  } // end fetchBody

  // Hard timeout wrapper — prevents any single page from blocking the crawl
  let timer: ReturnType<typeof setTimeout>
  try {
    return await Promise.race([
      fetchBody(),
      new Promise<null>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Page fetch timed out after ${PAGE_FETCH_TIMEOUT_MS}ms`)), PAGE_FETCH_TIMEOUT_MS)
      }),
    ])
  } catch (err) {
    console.warn(`[crawler] ${url} timed out after ${PAGE_FETCH_TIMEOUT_MS}ms — skipping`)
    return null
  } finally {
    clearTimeout(timer!)
  }
}

/* ── Strategy A: Sitemap discovery ────────────────────────── */

async function discoverSitemapUrls(baseUrl: string, hostname: string): Promise<URL[]> {
  const urls: URL[] = []
  const MAX_SITEMAP_URLS = 200 // We only need enough to pick pages — not the whole index
  const MAX_BODY_BYTES = 512_000 // 512 KB cap per sitemap file
  const SITEMAP_TIMEOUT = 6000 // 6s per sitemap fetch (down from 10s)

  /** Stream-read a response body with a byte cap to avoid downloading multi-MB sitemaps */
  async function readCapped(res: Response): Promise<string> {
    if (!res.body) return await res.text()
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let totalBytes = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      totalBytes += value.byteLength
      if (totalBytes >= MAX_BODY_BYTES) {
        reader.cancel()
        break
      }
    }
    return new TextDecoder().decode(Buffer.concat(chunks))
  }

  /** Extract URLs from an XML string, capped at MAX_SITEMAP_URLS */
  function extractUrlsFromXml(xml: string): URL[] {
    const found: URL[] = []
    // Try <url><loc>...</loc></url> first, then bare <loc>
    const locMatches = xml.match(/<loc>([^<]+)<\/loc>/gi)
    if (!locMatches) return found
    for (const locTag of locMatches) {
      if (found.length >= MAX_SITEMAP_URLS) break
      const m = locTag.match(/<loc>([^<]+)<\/loc>/i)
      if (m) {
        try {
          const u = new URL(m[1].trim())
          // Skip sitemap index entries (they point to other .xml files)
          if (u.pathname.endsWith('.xml') || u.pathname.endsWith('.xml.gz')) continue
          if (isSameHost(u.hostname, hostname)) found.push(u)
        } catch { /* skip */ }
      }
    }
    return found
  }

  // Try common sitemap locations
  const sitemapCandidates = [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/sitemap/sitemap.xml`,
  ]

  // Also check robots.txt for sitemap directives
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const robotsRes = await fetch(`${baseUrl}/robots.txt`, {
      headers: { 'User-Agent': USER_AGENTS[0] },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (robotsRes.ok) {
      const robotsTxt = await robotsRes.text()
      const sitemapMatches = robotsTxt.match(/^Sitemap:\s*(.+)$/gim)
      if (sitemapMatches) {
        for (const line of sitemapMatches.slice(0, 5)) { // Max 5 sitemaps from robots.txt
          const sitemapUrl = line.replace(/^Sitemap:\s*/i, '').trim()
          if (sitemapUrl && !sitemapCandidates.includes(sitemapUrl)) {
            sitemapCandidates.unshift(sitemapUrl)
          }
        }
      }
    }
  } catch {
    // robots.txt not available — continue with default candidates
  }

  const MAX_CHILD_SITEMAPS = 5 // Fetch up to 5 child sitemaps from an index

  for (const sitemapUrl of sitemapCandidates) {
    if (urls.length >= MAX_SITEMAP_URLS) break // enough URLs collected

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), SITEMAP_TIMEOUT)
      const res = await fetch(sitemapUrl, {
        headers: { 'User-Agent': USER_AGENTS[0], Accept: 'application/xml, text/xml, */*' },
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!res.ok) continue

      const xml = await readCapped(res)

      // Check if this is a sitemap index (contains other sitemaps)
      const indexEntries = xml.match(/<sitemap>\s*<loc>([^<]+)<\/loc>/gi)
      if (indexEntries && indexEntries.length > 0) {
        // It's a sitemap index — fetch up to MAX_CHILD_SITEMAPS children
        const childUrls: string[] = []
        for (const entry of indexEntries.slice(0, MAX_CHILD_SITEMAPS)) {
          const locMatch = entry.match(/<loc>([^<]+)<\/loc>/i)
          if (locMatch) childUrls.push(locMatch[1].trim())
        }
        console.log(`[crawler] Sitemap index at ${sitemapUrl}: ${indexEntries.length} children, fetching ${childUrls.length}`)

        // Fetch child sitemaps in parallel (all at once, they're small XML files)
        const childResults = await Promise.allSettled(
          childUrls.map(async (childUrl) => {
            const childController = new AbortController()
            const childTimeout = setTimeout(() => childController.abort(), SITEMAP_TIMEOUT)
            try {
              const childRes = await fetch(childUrl, {
                headers: { 'User-Agent': USER_AGENTS[0] },
                signal: childController.signal,
              })
              clearTimeout(childTimeout)
              if (!childRes.ok) return []
              const childXml = await readCapped(childRes)
              return extractUrlsFromXml(childXml)
            } catch {
              clearTimeout(childTimeout)
              return []
            }
          })
        )

        for (const result of childResults) {
          if (result.status === 'fulfilled' && result.value.length > 0) {
            urls.push(...result.value)
            if (urls.length >= MAX_SITEMAP_URLS) break
          }
        }
      }

      // Also extract URLs from this sitemap directly (covers flat sitemaps and
      // hybrid sitemaps that contain both <sitemap> and <url> entries)
      const directUrls = extractUrlsFromXml(xml)
      if (directUrls.length > 0) {
        for (const u of directUrls) {
          if (urls.length >= MAX_SITEMAP_URLS) break
          // Dedup against already-collected URLs
          const key = u.toString()
          if (!urls.some(existing => existing.toString() === key)) urls.push(u)
        }
      }
    } catch {
      // This sitemap URL failed — try next candidate
    }
  }

  console.log(`[crawler] Sitemap discovery: found ${urls.length} URLs`)
  return [...new Map(urls.map((u) => [u.toString(), u])).values()]
}

/* ── Strategy B: Common page path probing ────────────────── */

// Trimmed to ~20 high-value paths (down from 80+). Sitemap + HTML links already
// cover most pages. These are fallback probes for JS-heavy sites with no sitemap.
const COMMON_PATHS = [
  '/about', '/contact', '/pricing', '/services', '/features',
  '/blog', '/faq', '/help', '/products', '/solutions',
  '/terms', '/privacy', '/careers', '/docs', '/resources',
  '/how-it-works', '/demo', '/support', '/shop', '/store',
]

async function probeCommonPaths(baseUrl: string, hostname: string): Promise<URL[]> {
  const found: URL[] = []
  const PROBE_TIMEOUT = 4000 // 4s per probe (down from 8s)

  // All 20 probes run in a single parallel batch (was 8 sequential batches of 10)
  const results = await Promise.all(
    COMMON_PATHS.map(async (path) => {
      try {
        const probeUrl = `${baseUrl}${path}`
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT)

        const res = await fetch(probeUrl, {
          method: 'HEAD',
          headers: { 'User-Agent': getRequestUA() },
          signal: controller.signal,
          redirect: 'follow',
        })

        clearTimeout(timeout)

        if (res.ok) {
          const finalUrl = new URL(res.url)
          const isHomepageRedirect = finalUrl.pathname === '/' || normalizeUrlForDedup(finalUrl.toString()) === normalizeUrlForDedup(baseUrl + '/')
          if (!isHomepageRedirect && isSameHost(finalUrl.hostname, hostname)) {
            return new URL(probeUrl)
          }
        }
        return null
      } catch {
        return null
      }
    }),
  )

  for (const url of results) {
    if (url) found.push(url)
  }

  console.log(`[crawler] Common path probing: found ${found.length} pages`)
  return found
}

/* ── Link extraction from Jina markdown text ─────────────── */

function extractLinksFromText(text: string, pageUrl: string): URL[] {
  const baseUrl = new URL(pageUrl)
  const links: URL[] = []

  // Extract markdown-style links: [text](url)
  const mdLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g
  let match
  while ((match = mdLinkRegex.exec(text)) !== null) {
    try {
      const href = match[2]
      if (href.startsWith('http://') || href.startsWith('https://')) {
        const url = new URL(href)
        if (isSameHost(url.hostname, baseUrl.hostname)) links.push(url)
      } else if (!href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        const url = new URL(href, pageUrl)
        if (isSameHost(url.hostname, baseUrl.hostname)) links.push(url)
      }
    } catch {
      // Skip invalid URLs
    }
  }

  // Also extract bare URLs
  const urlRegex = /https?:\/\/[^\s"'<>)\]]+/g
  while ((match = urlRegex.exec(text)) !== null) {
    try {
      const url = new URL(match[0])
      if (isSameHost(url.hostname, baseUrl.hostname)) links.push(url)
    } catch {
      // Skip invalid URLs
    }
  }

  return [...new Map(links.map((l) => [l.toString(), l])).values()]
}

/* ── Lightweight link discovery (HTML first, Jina fallback) ─ */

async function fetchLinksOnly(url: string): Promise<URL[]> {
  // Try direct HTML fetch first (works for static sites)
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]

    const response = await fetch(url, {
      headers: {
        'User-Agent': ua,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    })

    clearTimeout(timeout)

    if (response.ok) {
      const html = await response.text()
      const { links } = extractLinks(html, url)
      // Require at least 5 same-host links before trusting static HTML
      // SPAs often have 1-2 static links (logo, canonical) but need Jina for nav links
      if (links.length >= 5) {
        console.log(`[crawler] fetchLinksOnly: found ${links.length} links via direct HTML`)
        return links
      }
      console.log(`[crawler] fetchLinksOnly: only ${links.length} links from HTML (likely SPA) — trying Jina`)
    }
  } catch {
    // Direct fetch failed — try Jina
  }

  // Jina fallback for JS-rendered sites — extract links from markdown
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const jinaUrl = `https://r.jina.ai/${url}`

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Return-Format': 'text',
      'X-With-Links': 'true', // Ask Jina to include rendered navigation links
    }
    const jinaKey = process.env.JINA_API_KEY
    if (jinaKey) headers['Authorization'] = `Bearer ${jinaKey}`

    const response = await fetch(jinaUrl, { headers, signal: controller.signal })
    clearTimeout(timeout)

    if (!response.ok) return []

    const contentType = response.headers.get('content-type') || ''
    let text: string
    const extraLinks: URL[] = []
    if (contentType.includes('application/json')) {
      const json = await response.json() as any
      text = json.data?.content || json.data?.text || json.text || ''
      // X-With-Links: Jina returns a links object { url: text } in the response
      const jinaLinks = json.data?.links || json.links
      if (jinaLinks && typeof jinaLinks === 'object') {
        for (const href of Object.keys(jinaLinks)) {
          try {
            const resolved = new URL(href, url)
            if (isSameHost(resolved.hostname, new URL(url).hostname)) {
              extraLinks.push(resolved)
            }
          } catch { /* skip invalid */ }
        }
        if (extraLinks.length > 0) {
          console.log(`[crawler] fetchLinksOnly: Jina X-With-Links returned ${extraLinks.length} same-host links`)
        }
      }
    } else {
      text = await response.text()
    }

    const textLinks = extractLinksFromText(text, url)
    const allLinks = [...textLinks, ...extraLinks]
    // Deduplicate
    const deduped = [...new Map(allLinks.map((l) => [normalizeUrlForDedup(l.toString()), l])).values()]
    console.log(`[crawler] fetchLinksOnly: found ${deduped.length} links via Jina fallback (${textLinks.length} from text, ${extraLinks.length} from X-With-Links)`)
    return deduped
  } catch {
    return []
  }
}

/* ── Main crawl entrypoint ─────────────────────────────────── */

export async function crawlPages(
  url: string,
  maxPages: number = 5,
  onProgress?: (pct: number, stage: string) => Promise<void>,
): Promise<{ pages: CrawledPage[]; stats: CrawlStats }> {
  resetBrowserEscalationBudget() // fresh browser-render budget for this crawl
  const pages: CrawledPage[] = []
  const visited = new Set<string>()
  const crawlStartedAt = new Date().toISOString()
  const excludedUrls: Array<{ url: string; reason: string }> = []
  let discoverySources = { sitemap: 0, htmlLinks: 0, commonPaths: 0, firecrawlMap: 0 }
  let totalDiscovered = 0
  let jsPagesDetected = 0
  let pagesBlocked = 0
  let pagesDuplicate = 0

  // ── Polite crawl mode: consistent UA per session, lower concurrency, jittered delays ──
  const politeMode = getFeatureFlags().politeCrawler
  const batchSize = getCrawlBatchSize(politeMode)
  const interBatchDelay = politeMode ? politeDelay : legacyDelay

  // Set session-scoped UA (same UA for every request in this crawl run)
  if (politeMode) {
    _sessionUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
    console.log(`[crawler] Polite mode: batch=${batchSize}, UA=${_sessionUA.substring(0, 40)}...`)
  } else {
    _sessionUA = null
  }

  /** Mark a URL as visited using normalized key */
  function markVisited(urlStr: string) {
    visited.add(normalizeUrlForDedup(urlStr))
  }
  function isVisited(urlStr: string): boolean {
    return visited.has(normalizeUrlForDedup(urlStr))
  }

  try {
    // Normalize URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }

    const baseUrl = new URL(url)
    let baseHostname = baseUrl.hostname

    // Fetch initial page with all strategies
    let firstPage = await fetchPageRobust(url)

    // If failed, try with/without www
    if (!firstPage || !firstPage.contentText) {
      const altUrl = baseHostname.startsWith('www.')
        ? url.replace('://www.', '://')
        : url.replace('://', '://www.')
      console.log(`[crawler] Retrying with ${altUrl}`)
      firstPage = await fetchPageRobust(altUrl)
    }

    if (!firstPage) {
      const crawlCompletedAt = new Date().toISOString()
      return {
        pages,
        stats: {
          urlsDiscovered: totalDiscovered,
          pagesAnalyzed: 0,
          pagesSkipped: 0,
          pagesBlocked,
          pagesDuplicate,
          pagesExcluded: excludedUrls.length,
          jsPagesDetected,
          discoverySources,
          excludedUrls,
          crawlStartedAt,
          crawlCompletedAt,
        }
      }
    }

    // Resolve actual hostname from fetched page URL (handles redirects like keycense.com → www.keycense.com)
    try {
      const resolvedUrl = new URL(firstPage.url)
      if (isSameHost(resolvedUrl.hostname, baseHostname) && resolvedUrl.hostname !== baseHostname) {
        console.log(`[crawler] Resolved hostname: ${baseHostname} → ${resolvedUrl.hostname}`)
        baseHostname = resolvedUrl.hostname
      }
    } catch { /* keep original */ }

    pages.push(firstPage)
    markVisited(baseUrl.toString())
    await onProgress?.(6, 'crawling') // Homepage fetched
    markVisited(firstPage.url) // also mark the actual resolved URL

    // If maxPages > 1, discover pages using ALL strategies in parallel
    if (maxPages > 1) {
      // Use resolved hostname for discovery (so probed URLs match the actual site)
      const resolvedOrigin = `${baseUrl.protocol}//${baseHostname}`

      // ── Run all discovery strategies in parallel with a global 20s cap ──
      // Strategy 0 (Firecrawl map) runs alongside the existing 3 strategies.
      // When Firecrawl is configured, its map results are highest priority.
      const discoveryTimeout = new Promise<[URL[], URL[], URL[], URL[]]>((resolve) =>
        setTimeout(() => resolve([[], [], [], []]), 15000)
      )
      const [sitemapUrls, commonPathUrls, htmlLinks, firecrawlMapUrls] = await Promise.race([discoveryTimeout, Promise.all([
        // Strategy A: Sitemap discovery (try both original and resolved origins)
        (async () => {
          const urls = await discoverSitemapUrls(resolvedOrigin, baseHostname).catch(() => [] as URL[])
          // Also try the original origin if different
          if (urls.length === 0 && resolvedOrigin !== baseUrl.origin) {
            return discoverSitemapUrls(baseUrl.origin, baseHostname).catch(() => [] as URL[])
          }
          return urls
        })(),
        // Strategy B: Common page path probing
        probeCommonPaths(resolvedOrigin, baseHostname).catch(() => [] as URL[]),
        // Strategy C: HTML/text link extraction (multi-source)
        (async () => {
          const allLinks: URL[] = []

          // C1: If we have raw HTML, extract links from it (static sites)
          if (firstPage.rawHtml) {
            const htmlExtracted = extractLinks(firstPage.rawHtml, firstPage.url || url).links
            allLinks.push(...htmlExtracted)
          }

          // C2: If Firecrawl or Jina already extracted links (stored before cleanup), add those
          if (firstPage.discoveredUrls && firstPage.discoveredUrls.length > 0) {
            console.log(`[crawler] Using ${firstPage.discoveredUrls.length} pre-extracted links`)
            for (const u of firstPage.discoveredUrls) {
              try { allLinks.push(new URL(u)) } catch { /* skip */ }
            }
          }

          // C3: If HTML extraction found few links, or the page was JS-rendered (no rawHtml),
          // try Jina for JS-rendered link discovery
          const isSPA = !firstPage.rawHtml // Page was fetched via Jina = likely SPA/JS-rendered
          if (allLinks.length < 8 || isSPA) {
            console.log(`[crawler] ${isSPA ? 'SPA detected (no rawHtml)' : `Only ${allLinks.length} links from HTML`} — trying Jina for JS-rendered link discovery`)
            const fetchedLinks = await fetchLinksOnly(firstPage.url || url)
            allLinks.push(...fetchedLinks)
          }

          // Deduplicate
          return [...new Map(allLinks.map((l) => [normalizeUrlForDedup(l.toString()), l])).values()]
        })(),
        // Strategy D: Firecrawl map (when configured — fastest + most comprehensive URL discovery)
        (async (): Promise<URL[]> => {
          if (!isFirecrawlConfigured()) return []
          try {
            const mapLinks = await firecrawlMap(resolvedOrigin, { limit: 200 })
            const urls: URL[] = []
            for (const href of mapLinks) {
              try {
                const u = new URL(href)
                if (isSameHost(u.hostname, baseHostname)) urls.push(u)
              } catch { /* skip invalid */ }
            }
            console.log(`[crawler] Firecrawl map: ${urls.length} same-host URLs`)
            return urls
          } catch {
            return []
          }
        })(),
      ])])

      // Track discovery source counts for transparency
      discoverySources = {
        sitemap: sitemapUrls.length,
        htmlLinks: htmlLinks.length,
        commonPaths: commonPathUrls.length,
        firecrawlMap: firecrawlMapUrls.length,
      }

      console.log(`[crawler] Discovery results — firecrawl: ${firecrawlMapUrls.length}, sitemap: ${sitemapUrls.length}, common paths: ${commonPathUrls.length}, HTML links: ${htmlLinks.length}`)
      await onProgress?.(8, 'crawling') // Discovery complete
      if (firecrawlMapUrls.length > 0) console.log(`[crawler] Firecrawl map URLs: ${firecrawlMapUrls.slice(0, 5).map(u => u.pathname).join(', ')}${firecrawlMapUrls.length > 5 ? '...' : ''}`)
      if (sitemapUrls.length > 0) console.log(`[crawler] Sitemap URLs: ${sitemapUrls.slice(0, 5).map(u => u.pathname).join(', ')}${sitemapUrls.length > 5 ? '...' : ''}`)
      if (commonPathUrls.length > 0) console.log(`[crawler] Common paths found: ${commonPathUrls.slice(0, 5).map(u => u.pathname).join(', ')}${commonPathUrls.length > 5 ? '...' : ''}`)
      if (htmlLinks.length > 0) console.log(`[crawler] HTML links found: ${htmlLinks.slice(0, 5).map(u => u.pathname).join(', ')}${htmlLinks.length > 5 ? '...' : ''}`)

      // ── Merge and deduplicate all discovered URLs ──
      const allDiscoveredMap = new Map<string, URL>()

      // Firecrawl map URLs first (most comprehensive — crawl + sitemap + link graph)
      for (const u of firecrawlMapUrls) allDiscoveredMap.set(normalizeUrlForDedup(u.toString()), u)
      // Sitemap URLs next (high quality — pages the site wants indexed)
      for (const u of sitemapUrls) {
        const key = normalizeUrlForDedup(u.toString())
        if (!allDiscoveredMap.has(key)) allDiscoveredMap.set(key, u)
      }
      // Then HTML-extracted links (direct evidence of navigation)
      for (const u of htmlLinks) {
        const key = normalizeUrlForDedup(u.toString())
        if (!allDiscoveredMap.has(key)) allDiscoveredMap.set(key, u)
      }
      // Then probed common paths (fallback for JS-heavy sites)
      for (const u of commonPathUrls) {
        const key = normalizeUrlForDedup(u.toString())
        if (!allDiscoveredMap.has(key)) allDiscoveredMap.set(key, u)
      }

      const allDiscovered = [...allDiscoveredMap.values()]
      totalDiscovered = allDiscovered.length + 1 // +1 for homepage already crawled

      // Filter out infrastructure/non-content URLs before queuing
      const EXCLUDED_PATH_PREFIXES = [
        '/cdn-cgi/',          // Cloudflare email protection, challenges, etc.
        '/_next/',            // Next.js internal assets
        '/api/',              // API endpoints (not user-facing pages)
        '/.well-known/',      // ACME, security.txt etc.
        '/static/',           // Static assets (often not pages)
        '/assets/',           // Asset bundles
        '/wp-admin/',         // WordPress admin
        '/wp-json/',          // WordPress REST API
        '/wp-includes/',      // WordPress internals
        '/feed',              // RSS feeds
        '/xmlrpc.php',        // WordPress XML-RPC
      ]

      const EXCLUDED_EXTENSIONS = [
        '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico',
        '.css', '.js', '.json', '.xml', '.txt', '.zip', '.gz', '.tar',
        '.mp4', '.mp3', '.wav', '.avi', '.mov', '.woff', '.woff2', '.ttf', '.eot',
      ]

      function isExcludedPath(url: URL): boolean {
        const path = url.pathname.toLowerCase()
        if (EXCLUDED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) return true
        if (EXCLUDED_EXTENSIONS.some((ext) => path.endsWith(ext))) return true
        // Exclude query-heavy URLs (tracking, search, etc.)
        if (url.search.length > 150) return true
        return false
      }

      // ── URL priority scoring ─────────────────────────────────
      // Rank discovered URLs by business value so the page budget is spent
      // on the most important pages, not whichever source happened to be first.
      const HIGH_VALUE_PATHS = new Set([
        '/pricing', '/product', '/products', '/features', '/about',
        '/contact', '/how-it-works', '/services', '/solutions', '/demo',
        '/why-fixpath', '/why-us', '/tour', '/platform', '/overview',
      ])
      const MEDIUM_VALUE_PATHS = new Set([
        '/blog', '/resources', '/docs', '/faq', '/help', '/support',
        '/careers', '/case-studies', '/customers', '/testimonials',
        '/integrations', '/partners', '/changelog', '/wordpress',
      ])
      const LOW_VALUE_PATHS = new Set([
        '/privacy', '/terms', '/cookies', '/legal', '/disclaimer',
        '/login', '/register', '/signup', '/signin', '/reset-password',
      ])

      function scoreUrl(url: URL): number {
        const path = url.pathname.toLowerCase().replace(/\/$/, '') || '/'
        const segments = path.split('/').filter(Boolean)

        // Homepage gets highest score (already crawled, but for completeness)
        if (path === '/') return 100

        // High-value business pages
        if (HIGH_VALUE_PATHS.has(path)) return 90

        // Medium-value content pages
        if (MEDIUM_VALUE_PATHS.has(path)) return 70

        // Low-value utility pages (still included, just ranked lower)
        if (LOW_VALUE_PATHS.has(path)) return 20

        // Depth penalty: shallow pages are more important
        // /about = 1 segment = 80, /blog/post = 2 segments = 60, /a/b/c = 3 = 40
        const depthScore = Math.max(10, 80 - (segments.length - 1) * 20)

        // Boost for paths that look like important templates
        if (segments.length === 1) return Math.max(depthScore, 75) // Top-level pages are likely important
        return depthScore
      }

      // Collect ALL eligible candidates (no artificial cap during collection)
      const CANDIDATE_POOL_CAP = Math.max(maxPages * 3, 60) // At least 3× page budget for fetch failures
      const allCandidates: Array<{ url: URL; score: number }> = []
      let skippedDifferentHost = 0
      let skippedAlreadyVisited = 0

      for (const link of allDiscovered) {
        if (!isSameHost(link.hostname, baseHostname)) { skippedDifferentHost++; continue }
        if (isVisited(link.toString())) { skippedAlreadyVisited++; continue }
        if (isExcludedPath(link)) {
          excludedUrls.push({ url: link.toString(), reason: 'Non-content path (infrastructure, assets, or API)' })
          continue
        }
        allCandidates.push({ url: link, score: scoreUrl(link) })
      }

      // Sort by score descending — highest-value pages first
      allCandidates.sort((a, b) => b.score - a.score)

      // Take top candidates up to pool cap
      const level1ToVisit = allCandidates.slice(0, CANDIDATE_POOL_CAP).map(c => c.url)

      console.log(`[crawler] Discovery stats — total: ${allDiscovered.length}, eligible: ${allCandidates.length}, different host: ${skippedDifferentHost}, already visited: ${skippedAlreadyVisited}, excluded: ${excludedUrls.length}`)
      console.log(`[crawler] Level 1: ${level1ToVisit.length} pages queued (top ${CANDIDATE_POOL_CAP} of ${allCandidates.length} by score, maxPages=${maxPages})`)
      if (allCandidates.length > 0) {
        const top5 = allCandidates.slice(0, 5).map(c => `${c.url.pathname}(${c.score})`).join(', ')
        const bottom3 = allCandidates.slice(-3).map(c => `${c.url.pathname}(${c.score})`).join(', ')
        console.log(`[crawler] Top 5 by score: ${top5}`)
        console.log(`[crawler] Bottom 3 by score: ${bottom3}`)
      }

      // Crawl level 1 in parallel (batchSize at a time — polite mode uses 3, legacy uses 5)
      const level1Pages: CrawledPage[] = []
      for (let i = 0; i < level1ToVisit.length; i += batchSize) {
        if (pages.length >= maxPages) break

        const batch = level1ToVisit.slice(i, Math.min(i + batchSize, level1ToVisit.length))
        const results = await Promise.all(
          batch.map((link) => fetchPageRobust(link.toString())),
        )

        for (const page of results) {
          if (page && pages.length < maxPages) {
            // Canonical dedup: if this page's canonical URL resolves to a
            // different page we've already crawled, mark it as duplicate.
            //
            // MISCONFIGURED-CANONICAL GUARD (2026-06-10): many sites set a
            // site-wide canonical in a shared layout/template, making EVERY
            // page claim the homepage as canonical. Obeying that signal made
            // us drop /product, /pricing, /about etc. as "duplicates" and
            // audit only 7 of 18 discovered pages (fixpath.ai itself had
            // this bug — root layout canonical). Rule: a NON-ROOT page whose
            // canonical points at the SITE ROOT is treated as misconfigured,
            // crawled anyway, and recorded so the analyzer can flag the SEO
            // defect. Genuine canonical dedup (trailing slash, utm variants,
            // alternate URLs of the same content) still applies.
            const pageCanonical = page.headTags?.canonical
            if (pageCanonical) {
              try {
                const canonicalUrlObj = new URL(pageCanonical, page.url)
                const canonicalNorm = normalizeUrlForDedup(canonicalUrlObj.toString())
                const pageNorm = normalizeUrlForDedup(page.url)
                const pageIsRoot = (new URL(page.url).pathname.replace(/\/$/, '') || '/') === '/'
                const canonicalIsRoot = (canonicalUrlObj.pathname.replace(/\/$/, '') || '/') === '/'

                if (canonicalNorm !== pageNorm && canonicalIsRoot && !pageIsRoot) {
                  // Misconfigured site-wide canonical — keep the page, flag the defect
                  console.warn(`[crawler] Misconfigured canonical on ${page.url} → points at site root. Crawling anyway.`)
                  excludedUrls.push({ url: page.url, reason: `MISCONFIGURED_CANONICAL: page declares site root as canonical — crawled anyway; this is an SEO defect on the site` })
                } else if (canonicalNorm !== pageNorm && isVisited(canonicalNorm)) {
                  // Page is a genuine duplicate of an already-crawled canonical — skip
                  pagesDuplicate++
                  excludedUrls.push({ url: page.url, reason: `Canonical duplicate of ${pageCanonical}` })
                  continue
                }
              } catch { /* invalid canonical URL — proceed normally */ }
            }

            // Track JS-rendered pages
            if (page.fetchStrategy && page.fetchStrategy !== 'direct') {
              jsPagesDetected++
            }

            pages.push(page)
            markVisited(page.url)
            level1Pages.push(page)
          }
        }

        // Report progress: scale from 8% → 13% over the crawl batches
        const crawlPct = Math.round(8 + (5 * Math.min(pages.length, maxPages) / maxPages))
        await onProgress?.(crawlPct, 'crawling')

        // Rate limit between batches (polite mode: 500-2000ms jitter, legacy: 150ms)
        if (i + batchSize < level1ToVisit.length && pages.length < maxPages) {
          await interBatchDelay()
        }
      }

      // Level 2: follow links discovered on level 1 pages (deeper coverage)
      if (pages.length < maxPages) {
        const level2Candidates: URL[] = []

        for (const l1Page of level1Pages) {
          let l2Links: URL[] = []

          if (l1Page.rawHtml) {
            l2Links = extractLinks(l1Page.rawHtml, l1Page.url).links
          } else if (l1Page.discoveredUrls && l1Page.discoveredUrls.length > 0) {
            // Use pre-extracted links from Jina (before markdown cleanup)
            l2Links = l1Page.discoveredUrls
              .map((u) => { try { return new URL(u) } catch { return null } })
              .filter((u): u is URL => u !== null)
          } else if (l1Page.contentText) {
            // Fallback: extract from cleaned text (may find bare URLs)
            l2Links = extractLinksFromText(l1Page.contentText, l1Page.url)
          }

          for (const link of l2Links) {
            if (isSameHost(link.hostname, baseHostname) && !isVisited(link.toString()) && !isExcludedPath(link)) {
              level2Candidates.push(link)
              markVisited(link.toString())
            }
          }
        }

        // Limit level 2 to remaining slots
        const remaining = maxPages - pages.length
        const level2ToVisit = level2Candidates.slice(0, Math.min(remaining, 20))

        console.log(`[crawler] Level 2: ${level2ToVisit.length} pages to crawl`)

        for (let i = 0; i < level2ToVisit.length; i += batchSize) {
          if (pages.length >= maxPages) break

          const batch = level2ToVisit.slice(i, Math.min(i + batchSize, level2ToVisit.length))
          const results = await Promise.all(
            batch.map((link) => fetchPageRobust(link.toString())),
          )

          for (const page of results) {
            if (page && pages.length < maxPages) {
              // Canonical dedup for level 2 — same misconfigured-canonical
              // guard as level 1: non-root pages claiming the site root as
              // canonical are crawled anyway (site-wide canonical defect).
              const pageCanonical = page.headTags?.canonical
              if (pageCanonical) {
                try {
                  const canonicalUrlObj = new URL(pageCanonical, page.url)
                  const canonicalNorm = normalizeUrlForDedup(canonicalUrlObj.toString())
                  const pageNorm = normalizeUrlForDedup(page.url)
                  const pageIsRoot = (new URL(page.url).pathname.replace(/\/$/, '') || '/') === '/'
                  const canonicalIsRoot = (canonicalUrlObj.pathname.replace(/\/$/, '') || '/') === '/'

                  if (canonicalNorm !== pageNorm && canonicalIsRoot && !pageIsRoot) {
                    console.warn(`[crawler] Misconfigured canonical on ${page.url} → points at site root. Crawling anyway.`)
                    excludedUrls.push({ url: page.url, reason: `MISCONFIGURED_CANONICAL: page declares site root as canonical — crawled anyway; this is an SEO defect on the site` })
                  } else if (canonicalNorm !== pageNorm && isVisited(canonicalNorm)) {
                    pagesDuplicate++
                    excludedUrls.push({ url: page.url, reason: `Canonical duplicate of ${pageCanonical}` })
                    continue
                  }
                } catch { /* invalid canonical URL — proceed normally */ }
              }
              pages.push(page)
              markVisited(page.url)
            }
          }

          if (i + batchSize < level2ToVisit.length && pages.length < maxPages) {
            await interBatchDelay()
          }
        }
      }
    }

    console.log(`[crawler] Finished: ${pages.length} pages crawled for ${url}`)

    // Final counts — authoritative from all pages
    jsPagesDetected = pages.filter(p => p.fetchStrategy === 'jina' || p.fetchStrategy === 'google_cache' || p.fetchStrategy === 'direct+rendered' || p.fetchStrategy === 'direct+browser').length
    pagesBlocked = pages.filter(p => p.blockedByBot).length

    const crawlCompletedAt = new Date().toISOString()
    const cleanPages = pages.map(({ discoveredUrls, ...rest }) => rest)

    const stats: CrawlStats = {
      urlsDiscovered: totalDiscovered || cleanPages.length,
      pagesAnalyzed: cleanPages.filter(p => p.contentText && p.contentText.length > 50).length,
      pagesSkipped: (totalDiscovered || cleanPages.length) - cleanPages.length,
      pagesBlocked,
      pagesDuplicate,
      pagesExcluded: excludedUrls.length,
      jsPagesDetected,
      discoverySources,
      excludedUrls: excludedUrls.slice(0, 20), // Cap at 20 for storage
      crawlStartedAt,
      crawlCompletedAt,
    }

    return { pages: cleanPages, stats }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[crawler] Error in crawlPages:', message)
    const crawlCompletedAt = new Date().toISOString()
    const cleanPages = pages.map(({ discoveredUrls, ...rest }) => rest)

    const stats: CrawlStats = {
      urlsDiscovered: totalDiscovered || cleanPages.length,
      pagesAnalyzed: cleanPages.filter(p => p.contentText && p.contentText.length > 50).length,
      pagesSkipped: 0,
      pagesBlocked,
      pagesDuplicate,
      pagesExcluded: excludedUrls.length,
      jsPagesDetected,
      discoverySources,
      excludedUrls: excludedUrls.slice(0, 20),
      crawlStartedAt,
      crawlCompletedAt,
    }

    return { pages: cleanPages, stats }
  }
}
