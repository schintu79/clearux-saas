// ============================================================
// ClearUX Audit Engine — Robust Page Crawler
// Multi-strategy: direct fetch → Jina Reader fallback
// ============================================================
// PROPRIETARY — do not distribute outside the ClearUX codebase.
// ============================================================

import type { AuditPage } from '@/types/database'

/* ── Hostname normalization ───────────────────────────────── */

/** Strip www. prefix for hostname comparison so keycense.com ≡ www.keycense.com */
function normalizeHostname(hostname: string): string {
  return hostname.replace(/^www\./i, '').toLowerCase()
}

/** Check if two hostnames are equivalent (handles www/non-www) */
function isSameHost(a: string, b: string): boolean {
  return normalizeHostname(a) === normalizeHostname(b)
}

/** Normalize a URL string for deduplication (strip www, trailing slash, fragment, lowercase) */
function normalizeUrlForDedup(urlStr: string): string {
  try {
    const u = new URL(urlStr)
    u.hostname = normalizeHostname(u.hostname)
    u.hash = ''
    // Remove trailing slash except for bare domain
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1)
    }
    return u.toString().toLowerCase()
  } catch {
    return urlStr.toLowerCase()
  }
}

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
      url: response.url || url, // Use resolved URL after redirects (e.g. keycense.com → www.keycense.com)
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
      'X-No-Cache': 'true',
      'Cache-Control': 'no-cache',
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
                      if (isSameHost(u.hostname, hostname)) urls.push(u)
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
              if (isSameHost(u.hostname, hostname)) urls.push(u)
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
                if (isSameHost(u.hostname, hostname)) urls.push(u)
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
  // Core pages
  '/about', '/about-us', '/contact', '/contact-us', '/support',
  '/pricing', '/plans', '/services', '/features', '/integrations',
  '/blog', '/news', '/faq', '/faqs', '/help', '/help-center',
  '/terms', '/terms-of-service', '/terms-and-conditions',
  '/privacy', '/privacy-policy', '/cookie-policy', '/cookies',
  '/products', '/solutions', '/team', '/careers', '/jobs',
  '/case-studies', '/testimonials', '/reviews', '/customers',
  '/how-it-works', '/why-us', '/demo', '/get-started', '/tour',
  '/login', '/signup', '/register', '/sign-up', '/sign-in',
  // E-commerce
  '/shop', '/store', '/collections', '/categories', '/catalog',
  '/cart', '/checkout', '/account', '/orders', '/wishlist',
  // Documentation & resources
  '/docs', '/documentation', '/resources', '/guides', '/tutorials',
  '/changelog', '/release-notes', '/roadmap', '/status',
  '/api', '/developers', '/partners', '/affiliates',
  // Legal & trust
  '/security', '/compliance', '/gdpr', '/accessibility',
  '/sitemap', '/imprint', '/impressum', '/legal',
  // Marketing
  '/use-cases', '/industries', '/enterprise', '/startup',
  '/webinar', '/webinars', '/events', '/podcast',
  '/press', '/media', '/brand', '/community', '/forum',
]

async function probeCommonPaths(baseUrl: string, hostname: string): Promise<URL[]> {
  const found: URL[] = []

  // Probe in batches of 10 for speed (HEAD requests are lightweight)
  for (let i = 0; i < COMMON_PATHS.length; i += 10) {
    const batch = COMMON_PATHS.slice(i, i + 10)
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
            // Make sure it didn't redirect back to homepage or a catch-all
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
      if (links.length >= 1) {
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

    if (!firstPage) return pages

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
    markVisited(firstPage.url) // also mark the actual resolved URL

    // If maxPages > 1, discover pages using ALL strategies in parallel
    if (maxPages > 1) {
      // Use resolved hostname for discovery (so probed URLs match the actual site)
      const resolvedOrigin = `${baseUrl.protocol}//${baseHostname}`

      // ── Run all 3 discovery strategies in parallel ──
      const [sitemapUrls, commonPathUrls, htmlLinks] = await Promise.all([
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

          // C2: If Jina already extracted links (stored before cleanup), add those
          if (firstPage.discoveredUrls && firstPage.discoveredUrls.length > 0) {
            console.log(`[crawler] Using ${firstPage.discoveredUrls.length} pre-extracted Jina links`)
            for (const u of firstPage.discoveredUrls) {
              try { allLinks.push(new URL(u)) } catch { /* skip */ }
            }
          }

          // C3: If HTML extraction found very few links, also try Jina for JS-rendered links
          if (allLinks.length < 3) {
            console.log(`[crawler] Only ${allLinks.length} links from HTML — trying Jina for JS-rendered link discovery`)
            const fetchedLinks = await fetchLinksOnly(firstPage.url || url)
            allLinks.push(...fetchedLinks)
          }

          // Deduplicate
          return [...new Map(allLinks.map((l) => [normalizeUrlForDedup(l.toString()), l])).values()]
        })(),
      ])

      console.log(`[crawler] Discovery results — sitemap: ${sitemapUrls.length}, common paths: ${commonPathUrls.length}, HTML links: ${htmlLinks.length}`)
      if (sitemapUrls.length > 0) console.log(`[crawler] Sitemap URLs: ${sitemapUrls.slice(0, 5).map(u => u.pathname).join(', ')}${sitemapUrls.length > 5 ? '...' : ''}`)
      if (commonPathUrls.length > 0) console.log(`[crawler] Common paths found: ${commonPathUrls.slice(0, 5).map(u => u.pathname).join(', ')}${commonPathUrls.length > 5 ? '...' : ''}`)
      if (htmlLinks.length > 0) console.log(`[crawler] HTML links found: ${htmlLinks.slice(0, 5).map(u => u.pathname).join(', ')}${htmlLinks.length > 5 ? '...' : ''}`)

      // ── Merge and deduplicate all discovered URLs ──
      const allDiscoveredMap = new Map<string, URL>()

      // Sitemap URLs first (highest quality — these are pages the site wants indexed)
      for (const u of sitemapUrls) allDiscoveredMap.set(normalizeUrlForDedup(u.toString()), u)
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

      // Level 1: pages to crawl from all sources
      const level1ToVisit = allDiscovered
        .filter((link) => isSameHost(link.hostname, baseHostname) && !isVisited(link.toString()) && !isExcludedPath(link))
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
            markVisited(page.url)
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
