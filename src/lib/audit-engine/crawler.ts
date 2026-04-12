// ============================================================
// ClearUX Audit Engine — Robust Page Crawler
// Multi-strategy: direct fetch → Jina Reader fallback
// ============================================================

import type { AuditPage } from '@/types/database'

export interface CrawledPage {
  url: string
  title: string | null
  h1: string | null
  metaDescription: string | null
  contentText: string | null
  rawHtml?: string | null
  /** Links discovered from the page (populated before content cleanup) */
  discoveredUrls?: string[]
  linksFound: number
  statusCode: number | null
  crawledAt: string
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

function extractLinks(html: string, pageUrl: string): { links: URL[]; count: number } {
  const baseUrl = new URL(pageUrl)
  const links: URL[] = []
  const linkRegex = /<a\s+[^>]*href=["']([^"']*)["']/gi
  let match

  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const href = match[1]
      if (href.startsWith('http://') || href.startsWith('https://')) {
        const url = new URL(href)
        if (url.hostname === baseUrl.hostname) links.push(url)
      } else if (!href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('javascript:')) {
        const url = new URL(href, pageUrl)
        if (url.hostname === baseUrl.hostname) links.push(url)
      }
    } catch {
      // Skip invalid URLs
    }
  }

  return { links: [...new Map(links.map((l) => [l.toString(), l])).values()], count: links.length }
}

/* ── Bot-detection checks ──────────────────────────────────── */

/** Detect if the response is a Cloudflare/bot-challenge page */
function isBlockedResponse(html: string, statusCode: number | null): boolean {
  if (statusCode === 403 || statusCode === 503 || statusCode === 429) return true

  const blockedPatterns = [
    /challenge-platform/i,
    /cf-browser-verification/i,
    /cloudflare/i,
    /just a moment/i,
    /checking your browser/i,
    /enable javascript/i,
    /please enable cookies/i,
    /access denied/i,
    /attention required/i,
    /ddos-guard/i,
    /sucuri/i,
    /incapsula/i,
    /bot detection/i,
    /are you a robot/i,
    /captcha/i,
  ]

  // Only flag if content is suspiciously short AND matches a pattern
  const textContent = extractTextContent(html)
  if (textContent.length < 500) {
    for (const pattern of blockedPatterns) {
      if (pattern.test(html) || pattern.test(textContent)) return true
    }
  }

  return false
}

/* ── Strategy 1: Direct fetch with realistic headers ───────── */

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
]

async function directFetch(url: string, timeoutMs: number = 20000): Promise<CrawledPage | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]

    const response = await fetch(url, {
      headers: {
        'User-Agent': ua,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
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
    })

    const html = await response.text()

    // Check if we got blocked
    if (!response.ok || isBlockedResponse(html, response.status)) {
      console.warn(`[crawler] Direct fetch blocked for ${url} (status ${response.status})`)
      return null // Signal to try fallback
    }

    const title = extractTitle(html)
    const h1 = extractH1(html)
    const metaDescription = extractMetaDescription(html)
    const contentText = extractTextContent(html)
    const { count: linksFound } = extractLinks(html, url)

    // If we got a response but content is suspiciously empty, flag it
    if (!contentText || contentText.length < 100) {
      console.warn(`[crawler] Direct fetch returned very little content for ${url} (${contentText?.length || 0} chars)`)
      return null // Try fallback
    }

    return {
      url,
      title,
      h1,
      metaDescription,
      contentText,
      rawHtml: html,
      linksFound,
      statusCode: response.status,
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

async function jinaFetch(url: string, timeoutMs: number = 30000): Promise<CrawledPage | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const jinaUrl = `https://r.jina.ai/${url}`
    console.log(`[crawler] Using Jina Reader for ${url}`)

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Return-Format': 'text',
    }

    // Use Jina API key if available (higher rate limits)
    const jinaKey = process.env.JINA_API_KEY
    if (jinaKey) {
      headers['Authorization'] = `Bearer ${jinaKey}`
    }

    const response = await fetch(jinaUrl, {
      headers,
      signal: controller.signal,
    })

    if (!response.ok) {
      console.warn(`[crawler] Jina Reader failed for ${url}: ${response.status}`)
      return null
    }

    const contentType = response.headers.get('content-type') || ''
    let contentText: string
    let title: string | null = null
    let description: string | null = null

    if (contentType.includes('application/json')) {
      const json = await response.json() as any
      contentText = json.data?.content || json.data?.text || json.text || ''
      title = json.data?.title || json.title || null
      description = json.data?.description || null
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

    // Extract links from the RAW markdown BEFORE cleaning (critical for discovery)
    const rawLinks = extractLinksFromText(contentText, url)
    const discoveredUrls = rawLinks.map((l) => l.toString())
    console.log(`[crawler] Jina extracted ${discoveredUrls.length} links from raw markdown for ${url}`)

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
      h1: null, // Jina doesn't reliably return H1 separately
      metaDescription: description,
      contentText,
      rawHtml: null, // Jina returns text, not HTML
      discoveredUrls,
      linksFound: discoveredUrls.length,
      statusCode: 200,
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

/* ── Strategy 3: Google Cache as last resort ───────────────── */

async function googleCacheFetch(url: string): Promise<CrawledPage | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`
    console.log(`[crawler] Trying Google Cache for ${url}`)

    const response = await fetch(cacheUrl, {
      headers: {
        'User-Agent': USER_AGENTS[0],
        Accept: 'text/html',
      },
      signal: controller.signal,
      redirect: 'follow',
    })

    if (!response.ok) return null

    const html = await response.text()
    const contentText = extractTextContent(html)

    if (!contentText || contentText.length < 100) return null

    return {
      url,
      title: extractTitle(html),
      h1: extractH1(html),
      metaDescription: extractMetaDescription(html),
      contentText,
      rawHtml: html,
      linksFound: 0,
      statusCode: 200,
      crawledAt: new Date().toISOString(),
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/* ── Multi-strategy fetch ──────────────────────────────────── */

async function fetchPageRobust(url: string): Promise<CrawledPage | null> {
  // Strategy 1: Direct fetch
  let page = await directFetch(url)
  if (page && page.contentText && page.contentText.length >= 100) {
    console.log(`[crawler] Direct fetch succeeded for ${url} (${page.contentText.length} chars)`)
    return page
  }

  // Strategy 2: Jina Reader (handles JS rendering + bot protection)
  page = await jinaFetch(url)
  if (page && page.contentText && page.contentText.length >= 50) {
    console.log(`[crawler] Jina Reader succeeded for ${url} (${page.contentText.length} chars)`)
    return page
  }

  // Strategy 3: Google Cache (last resort)
  page = await googleCacheFetch(url)
  if (page && page.contentText && page.contentText.length >= 100) {
    console.log(`[crawler] Google Cache succeeded for ${url} (${page.contentText.length} chars)`)
    return page
  }

  console.error(`[crawler] All strategies failed for ${url}`)

  return {
    url,
    title: null,
    h1: null,
    metaDescription: null,
    contentText: null,
    linksFound: 0,
    statusCode: null,
    crawledAt: new Date().toISOString(),
  }
}

/* ── Strategy A: Sitemap discovery ────────────────────────── */

async function discoverSitemapUrls(baseUrl: string, hostname: string): Promise<URL[]> {
  const urls: URL[] = []

  // Try common sitemap locations
  const sitemapCandidates = [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/sitemap/sitemap.xml`,
  ]

  // Also check robots.txt for sitemap directives
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const robotsRes = await fetch(`${baseUrl}/robots.txt`, {
      headers: { 'User-Agent': USER_AGENTS[0] },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (robotsRes.ok) {
      const robotsTxt = await robotsRes.text()
      const sitemapMatches = robotsTxt.match(/^Sitemap:\s*(.+)$/gim)
      if (sitemapMatches) {
        for (const line of sitemapMatches) {
          const sitemapUrl = line.replace(/^Sitemap:\s*/i, '').trim()
          if (sitemapUrl && !sitemapCandidates.includes(sitemapUrl)) {
            sitemapCandidates.unshift(sitemapUrl) // prioritise robots.txt sitemaps
          }
        }
      }
    }
  } catch {
    // robots.txt not available — continue with default candidates
  }

  for (const sitemapUrl of sitemapCandidates) {
    if (urls.length > 0) break // already found URLs from a sitemap

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const res = await fetch(sitemapUrl, {
        headers: { 'User-Agent': USER_AGENTS[0], Accept: 'application/xml, text/xml, */*' },
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!res.ok) continue

      const xml = await res.text()

      // Check if this is a sitemap index (contains other sitemaps)
      const sitemapIndexMatches = xml.match(/<sitemap>\s*<loc>([^<]+)<\/loc>/gi)
      if (sitemapIndexMatches && sitemapIndexMatches.length > 0) {
        // It's a sitemap index — fetch the first child sitemap
        const firstChildMatch = sitemapIndexMatches[0].match(/<loc>([^<]+)<\/loc>/i)
        if (firstChildMatch) {
          try {
            const childController = new AbortController()
            const childTimeout = setTimeout(() => childController.abort(), 10000)
            const childRes = await fetch(firstChildMatch[1].trim(), {
              headers: { 'User-Agent': USER_AGENTS[0] },
              signal: childController.signal,
            })
            clearTimeout(childTimeout)

            if (childRes.ok) {
              const childXml = await childRes.text()
              const childLocMatches = childXml.match(/<loc>([^<]+)<\/loc>/gi)
              if (childLocMatches) {
                for (const locTag of childLocMatches) {
                  const locMatch = locTag.match(/<loc>([^<]+)<\/loc>/i)
                  if (locMatch) {
                    try {
                      const u = new URL(locMatch[1].trim())
                      if (u.hostname === hostname) urls.push(u)
                    } catch { /* skip */ }
                  }
                }
              }
            }
          } catch { /* child sitemap fetch failed */ }
        }
      }

      // Extract <loc> URLs from regular sitemap
      const locMatches = xml.match(/<url>\s*<loc>([^<]+)<\/loc>/gi)
      if (locMatches) {
        for (const urlBlock of locMatches) {
          const locMatch = urlBlock.match(/<loc>([^<]+)<\/loc>/i)
          if (locMatch) {
            try {
              const u = new URL(locMatch[1].trim())
              if (u.hostname === hostname) urls.push(u)
            } catch { /* skip */ }
          }
        }
      }

      // Some sitemaps just have <loc> without <url> wrapper
      if (urls.length === 0) {
        const plainLocMatches = xml.match(/<loc>([^<]+)<\/loc>/gi)
        if (plainLocMatches) {
          for (const locTag of plainLocMatches) {
            const locMatch = locTag.match(/<loc>([^<]+)<\/loc>/i)
            if (locMatch) {
              try {
                const u = new URL(locMatch[1].trim())
                if (u.hostname === hostname) urls.push(u)
              } catch { /* skip */ }
            }
          }
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

const COMMON_PATHS = [
  '/about', '/about-us', '/contact', '/contact-us',
  '/pricing', '/plans', '/services', '/features',
  '/blog', '/news', '/faq', '/faqs', '/help',
  '/terms', '/terms-of-service', '/privacy', '/privacy-policy',
  '/products', '/solutions', '/team', '/careers',
  '/case-studies', '/testimonials', '/reviews',
  '/how-it-works', '/why-us', '/demo', '/get-started',
  '/login', '/signup', '/register',
]

async function probeCommonPaths(baseUrl: string, hostname: string): Promise<URL[]> {
  const found: URL[] = []

  // Probe in batches of 6 for speed
  for (let i = 0; i < COMMON_PATHS.length; i += 6) {
    const batch = COMMON_PATHS.slice(i, i + 6)
    const results = await Promise.all(
      batch.map(async (path) => {
        try {
          const probeUrl = `${baseUrl}${path}`
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 8000)

          const res = await fetch(probeUrl, {
            method: 'HEAD', // lightweight — just check if page exists
            headers: { 'User-Agent': USER_AGENTS[0] },
            signal: controller.signal,
            redirect: 'follow',
          })

          clearTimeout(timeout)

          // Accept 200 responses, reject redirects to homepage (common SPA pattern)
          if (res.ok) {
            const finalUrl = new URL(res.url)
            // Make sure it didn't redirect back to homepage
            if (finalUrl.pathname !== '/' && finalUrl.hostname === hostname) {
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
        if (url.hostname === baseUrl.hostname) links.push(url)
      } else if (!href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        const url = new URL(href, pageUrl)
        if (url.hostname === baseUrl.hostname) links.push(url)
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
      if (url.hostname === baseUrl.hostname) links.push(url)
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
    const timeout = setTimeout(() => controller.abort(), 15000)
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
      if (links.length >= 3) {
        console.log(`[crawler] fetchLinksOnly: found ${links.length} links via direct HTML`)
        return links
      }
    }
  } catch {
    // Direct fetch failed — try Jina
  }

  // Jina fallback for JS-rendered sites — extract links from markdown
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    const jinaUrl = `https://r.jina.ai/${url}`

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Return-Format': 'text',
    }
    const jinaKey = process.env.JINA_API_KEY
    if (jinaKey) headers['Authorization'] = `Bearer ${jinaKey}`

    const response = await fetch(jinaUrl, { headers, signal: controller.signal })
    clearTimeout(timeout)

    if (!response.ok) return []

    const contentType = response.headers.get('content-type') || ''
    let text: string
    if (contentType.includes('application/json')) {
      const json = await response.json() as any
      text = json.data?.content || json.data?.text || json.text || ''
    } else {
      text = await response.text()
    }

    const links = extractLinksFromText(text, url)
    console.log(`[crawler] fetchLinksOnly: found ${links.length} links via Jina fallback`)
    return links
  } catch {
    return []
  }
}

/* ── Main crawl entrypoint ─────────────────────────────────── */

export async function crawlPages(
  url: string,
  maxPages: number = 1,
): Promise<CrawledPage[]> {
  const pages: CrawledPage[] = []
  const visited = new Set<string>()

  try {
    // Normalize URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }

    const baseUrl = new URL(url)
    const baseHostname = baseUrl.hostname

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

    if (!firstPage) return pages

    pages.push(firstPage)
    visited.add(baseUrl.toString())
    visited.add(firstPage.url) // also mark the actual resolved URL

    // If maxPages > 1, discover pages using ALL strategies in parallel
    if (maxPages > 1) {
      const baseOrigin = baseUrl.origin // e.g. https://keycense.com

      // ── Run all 3 discovery strategies in parallel ──
      const [sitemapUrls, commonPathUrls, htmlLinks] = await Promise.all([
        // Strategy A: Sitemap discovery
        discoverSitemapUrls(baseOrigin, baseHostname).catch(() => [] as URL[]),
        // Strategy B: Common page path probing
        probeCommonPaths(baseOrigin, baseHostname).catch(() => [] as URL[]),
        // Strategy C: HTML/text link extraction (original approach)
        (async () => {
          // If we have raw HTML, extract links from it (static sites)
          if (firstPage.rawHtml) {
            return extractLinks(firstPage.rawHtml, url).links
          }
          // If Jina already extracted links (stored before cleanup), use those
          if (firstPage.discoveredUrls && firstPage.discoveredUrls.length > 0) {
            console.log(`[crawler] Using ${firstPage.discoveredUrls.length} pre-extracted Jina links`)
            return firstPage.discoveredUrls.map((u) => {
              try { return new URL(u) } catch { return null }
            }).filter((u): u is URL => u !== null)
          }
          // Last resort — fetch again specifically for link discovery (uses Jina fallback)
          const fetchedLinks = await fetchLinksOnly(url)
          return fetchedLinks
        })(),
      ])

      console.log(`[crawler] Discovery results — sitemap: ${sitemapUrls.length}, common paths: ${commonPathUrls.length}, HTML links: ${htmlLinks.length}`)

      // ── Merge and deduplicate all discovered URLs ──
      const allDiscoveredMap = new Map<string, URL>()

      // Sitemap URLs first (highest quality — these are pages the site wants indexed)
      for (const u of sitemapUrls) allDiscoveredMap.set(u.toString(), u)
      // Then HTML-extracted links (direct evidence of navigation)
      for (const u of htmlLinks) {
        if (!allDiscoveredMap.has(u.toString())) allDiscoveredMap.set(u.toString(), u)
      }
      // Then probed common paths (fallback for JS-heavy sites)
      for (const u of commonPathUrls) {
        if (!allDiscoveredMap.has(u.toString())) allDiscoveredMap.set(u.toString(), u)
      }

      const allDiscovered = [...allDiscoveredMap.values()]

      // Level 1: pages to crawl from all sources
      const level1ToVisit = allDiscovered
        .filter((link) => link.hostname === baseHostname && !visited.has(link.toString()))
        .slice(0, Math.min(40, maxPages - 1))

      console.log(`[crawler] Level 1: ${level1ToVisit.length} pages to crawl (merged from all strategies)`)

      // Crawl level 1 in parallel (3 at a time for speed)
      const level1Pages: CrawledPage[] = []
      for (let i = 0; i < level1ToVisit.length; i += 3) {
        if (pages.length >= maxPages) break

        const batch = level1ToVisit.slice(i, Math.min(i + 3, level1ToVisit.length))
        const results = await Promise.all(
          batch.map((link) => fetchPageRobust(link.toString())),
        )

        for (const page of results) {
          if (page && pages.length < maxPages) {
            pages.push(page)
            visited.add(page.url)
            level1Pages.push(page)
          }
        }

        // Brief rate limit between batches
        if (i + 3 < level1ToVisit.length && pages.length < maxPages) {
          await new Promise((resolve) => setTimeout(resolve, 200))
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
            if (link.hostname === baseHostname && !visited.has(link.toString())) {
              level2Candidates.push(link)
              visited.add(link.toString())
            }
          }
        }

        // Limit level 2 to remaining slots
        const remaining = maxPages - pages.length
        const level2ToVisit = level2Candidates.slice(0, Math.min(remaining, 20))

        console.log(`[crawler] Level 2: ${level2ToVisit.length} pages to crawl`)

        for (let i = 0; i < level2ToVisit.length; i += 3) {
          if (pages.length >= maxPages) break

          const batch = level2ToVisit.slice(i, Math.min(i + 3, level2ToVisit.length))
          const results = await Promise.all(
            batch.map((link) => fetchPageRobust(link.toString())),
          )

          for (const page of results) {
            if (page && pages.length < maxPages) {
              pages.push(page)
            }
          }

          if (i + 3 < level2ToVisit.length && pages.length < maxPages) {
            await new Promise((resolve) => setTimeout(resolve, 200))
          }
        }
      }
    }

    console.log(`[crawler] Finished: ${pages.length} pages crawled for ${url}`)

    // Strip internal fields before returning
    return pages.map(({ rawHtml, discoveredUrls, ...rest }) => rest)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[crawler] Error in crawlPages:', message)
    return pages.map(({ rawHtml, ...rest }) => rest)
  }
}
