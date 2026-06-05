/**
 * Browser Renderer — Puppeteer-based Content Extraction
 *
 * Renders pages in a headless browser and extracts content.
 * Used as a fallback when standard HTTP fetch strategies fail
 * (JS-only SPAs, mild anti-bot protection, rate limiting).
 *
 * Reuses the same Puppeteer launch path as responsive-checker.ts.
 *
 * Part of the Protected Site Audit Mode feature.
 * See docs/protected-site-audit-mode.md for architecture details.
 */

import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import type { HeadTagData } from './crawler'

// ── Types ─────────────────────────────────────────────────────

export interface BrowserRenderResult {
  url: string
  title: string | null
  h1: string | null
  metaDescription: string | null
  contentText: string | null
  rawHtml: string | null
  headTags: HeadTagData | null
  discoveredUrls: string[]
  linksFound: number
  statusCode: number | null
  loadTimeMs: number
  blockedByBot: boolean
  blockReason: string | null
}

// ── Constants ─────────────────────────────────────────────────

const DEFAULT_CONCURRENCY = 2
const DEFAULT_PAGE_TIMEOUT_MS = 20_000
const NAVIGATION_TIMEOUT_MS = 15_000
const MAX_CONTENT_LENGTH = 12_000

/** Realistic user agent for browser-rendered requests */
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

/**
 * Patterns that indicate the rendered page is still a bot challenge,
 * not real content. Matches the BLOCKED_PATTERNS from crawler.ts.
 */
const RENDER_BLOCK_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /challenge-platform/i, label: 'Cloudflare challenge' },
  { pattern: /cf-browser-verification/i, label: 'Cloudflare browser verification' },
  { pattern: /just a moment/i, label: 'Cloudflare waiting page' },
  { pattern: /checking your browser/i, label: 'Browser verification wall' },
  { pattern: /captcha/i, label: 'CAPTCHA challenge' },
  { pattern: /are you a robot/i, label: 'Robot verification' },
  { pattern: /verify you are human/i, label: 'Human verification' },
  { pattern: /access denied/i, label: 'Access denied page' },
]

// ── Browser management ────────────────────────────────────────

/**
 * Launch a headless browser. Same strategy as responsive-checker.ts:
 * 1. Try @sparticuz/chromium (serverless/Vercel)
 * 2. Fall back to local Chrome/Chromium binary
 */
async function launchBrowser(): Promise<Browser> {
  let executablePath: string

  try {
    const chromium = await import('@sparticuz/chromium')
    executablePath = await chromium.default.executablePath()
    return await puppeteer.launch({
      args: [
        ...chromium.default.args,
        '--disable-web-security',  // Allow cross-origin resource loading
        '--disable-features=IsolateOrigins,site-per-process',
      ],
      defaultViewport: { width: 1440, height: 900 },
      executablePath,
      headless: true,
    })
  } catch {
    const paths = [
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ]
    for (const p of paths) {
      try {
        const { accessSync } = await import('fs')
        accessSync(p)
        return await puppeteer.launch({
          executablePath: p,
          headless: true,
          defaultViewport: { width: 1440, height: 900 },
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
          ],
        })
      } catch {
        continue
      }
    }
    throw new Error('No Chromium/Chrome binary found for browser rendering.')
  }
}

// ── Content extraction ────────────────────────────────────────

/**
 * Extract structured content from a rendered page.
 * Runs inside page.evaluate() for DOM access.
 */
async function extractPageContent(page: Page): Promise<{
  title: string | null
  h1: string | null
  metaDescription: string | null
  contentText: string
  rawHtml: string
  headTags: HeadTagData
  discoveredUrls: string[]
  linksFound: number
}> {
  return page.evaluate((maxLen: number) => {
    // Title
    const title = document.title || null

    // H1
    const h1El = document.querySelector('h1')
    const h1 = h1El?.textContent?.trim() || null

    // Meta description
    const metaEl = document.querySelector('meta[name="description"]') as HTMLMetaElement | null
    const metaDescription = metaEl?.content?.trim() || null

    // Content text — extract body text, strip scripts/styles
    const body = document.body
    const clone = body.cloneNode(true) as HTMLElement
    clone.querySelectorAll('script, style, noscript, nav, footer, header').forEach(el => el.remove())
    let contentText = clone.innerText || clone.textContent || ''
    contentText = contentText.replace(/\s+/g, ' ').trim()
    if (contentText.length > maxLen) {
      contentText = contentText.substring(0, maxLen)
    }

    // Raw HTML
    const rawHtml = document.documentElement.outerHTML

    // Head tags
    const htmlEl = document.documentElement
    const lang = htmlEl.getAttribute('lang') || null
    const canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    const canonical = canonicalEl?.href || null
    const viewportEl = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null
    const viewport = viewportEl?.content || null
    const charsetEl = document.querySelector('meta[charset]') as HTMLMetaElement | null
    const charset = charsetEl?.getAttribute('charset') || null
    const robotsEl = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null
    const robotsMeta = robotsEl?.content || null

    // OG tags
    const ogTags: Record<string, string> = {}
    document.querySelectorAll('meta[property^="og:"]').forEach((el) => {
      const prop = (el as HTMLMetaElement).getAttribute('property')
      const content = (el as HTMLMetaElement).content
      if (prop && content) ogTags[prop] = content
    })

    // Twitter tags
    const twitterTags: Record<string, string> = {}
    document.querySelectorAll('meta[name^="twitter:"]').forEach((el) => {
      const name = (el as HTMLMetaElement).name
      const content = (el as HTMLMetaElement).content
      if (name && content) twitterTags[name] = content
    })

    // Hreflang
    const hreflang: Array<{ lang: string; href: string }> = []
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => {
      const lang = el.getAttribute('hreflang')
      const href = (el as HTMLLinkElement).href
      if (lang && href) hreflang.push({ lang, href })
    })

    // JSON-LD
    const jsonLd: Array<Record<string, unknown>> = []
    document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
      try {
        const parsed = JSON.parse(el.textContent || '')
        if (typeof parsed === 'object') jsonLd.push(parsed)
      } catch { /* ignore invalid JSON-LD */ }
    })

    // Links
    const links: string[] = []
    document.querySelectorAll('a[href]').forEach((el) => {
      const href = (el as HTMLAnchorElement).href
      if (href && href.startsWith('http')) links.push(href)
    })

    return {
      title,
      h1,
      metaDescription,
      contentText,
      rawHtml,
      headTags: {
        lang,
        canonical,
        ogTags,
        twitterTags,
        hreflang,
        robotsMeta,
        jsonLd,
        viewport,
        charset,
      } as HeadTagData,
      discoveredUrls: [...new Set(links)],
      linksFound: links.length,
    }
  }, MAX_CONTENT_LENGTH)
}

/**
 * Detect if the rendered page is still a bot challenge.
 * Returns the block reason label, or null if the page has real content.
 */
function detectRenderBlock(contentText: string, rawHtml: string): string | null {
  // Only flag if content is very short (likely a challenge page)
  const cleanLen = contentText.replace(/\s+/g, '').length
  if (cleanLen >= 500) return null

  for (const { pattern, label } of RENDER_BLOCK_PATTERNS) {
    if (pattern.test(rawHtml) || pattern.test(contentText)) {
      return label
    }
  }
  return null
}

// ── Public API ────────────────────────────────────────────────

/**
 * Render a single page in a headless browser and extract content.
 *
 * @param url URL to render
 * @param timeoutMs Per-page timeout (default 20s)
 * @returns Extracted content, or a result with blockedByBot=true if still blocked
 */
export async function browserRenderPage(
  url: string,
  timeoutMs: number = DEFAULT_PAGE_TIMEOUT_MS,
): Promise<BrowserRenderResult> {
  const startTime = Date.now()
  let browser: Browser | null = null

  try {
    browser = await launchBrowser()
    const page = await browser.newPage()

    await page.setUserAgent(BROWSER_UA)
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    })

    // Navigate and wait for network to settle
    let statusCode: number | null = null
    page.on('response', (response) => {
      if (response.url() === url || response.url().replace(/\/$/, '') === url.replace(/\/$/, '')) {
        statusCode = response.status()
      }
    })

    const navTimeout = Math.min(timeoutMs, NAVIGATION_TIMEOUT_MS)
    try {
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: navTimeout,
      })
    } catch {
      // networkidle0 can timeout on busy sites — fall back to domcontentloaded
      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: navTimeout,
        })
        // Wait a bit for JS to execute
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch {
        return makeEmptyResult(url, Date.now() - startTime, statusCode)
      }
    }

    // Extract content
    const content = await extractPageContent(page)
    const loadTimeMs = Date.now() - startTime

    // Check for bot protection in rendered output
    const blockReason = detectRenderBlock(content.contentText, content.rawHtml)
    if (blockReason) {
      return {
        url,
        title: content.title,
        h1: content.h1,
        metaDescription: content.metaDescription,
        contentText: content.contentText,
        rawHtml: content.rawHtml,
        headTags: content.headTags,
        discoveredUrls: content.discoveredUrls,
        linksFound: content.linksFound,
        statusCode,
        loadTimeMs,
        blockedByBot: true,
        blockReason,
      }
    }

    return {
      url,
      title: content.title,
      h1: content.h1,
      metaDescription: content.metaDescription,
      contentText: content.contentText,
      rawHtml: content.rawHtml,
      headTags: content.headTags,
      discoveredUrls: content.discoveredUrls,
      linksFound: content.linksFound,
      statusCode,
      loadTimeMs,
      blockedByBot: false,
      blockReason: null,
    }
  } catch (err) {
    return makeEmptyResult(url, Date.now() - startTime, null, String(err))
  } finally {
    if (browser) {
      await browser.close().catch(() => {})
    }
  }
}

/**
 * Render multiple pages with controlled concurrency.
 * Shares a single browser instance across pages.
 *
 * @param urls URLs to render
 * @param concurrency Max parallel pages (default 2)
 * @param timeoutMs Per-page timeout (default 20s)
 */
export async function browserRenderPages(
  urls: string[],
  concurrency: number = DEFAULT_CONCURRENCY,
  timeoutMs: number = DEFAULT_PAGE_TIMEOUT_MS,
): Promise<BrowserRenderResult[]> {
  if (urls.length === 0) return []

  let browser: Browser | null = null
  const results: BrowserRenderResult[] = []

  try {
    browser = await launchBrowser()

    // Process in batches for controlled concurrency
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency)
      const batchResults = await Promise.all(
        batch.map(async (url) => {
          const startTime = Date.now()
          let page: Page | null = null

          try {
            page = await browser!.newPage()
            await page.setUserAgent(BROWSER_UA)
            await page.setExtraHTTPHeaders({
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            })

            let statusCode: number | null = null
            page.on('response', (response) => {
              if (response.url() === url || response.url().replace(/\/$/, '') === url.replace(/\/$/, '')) {
                statusCode = response.status()
              }
            })

            const navTimeout = Math.min(timeoutMs, NAVIGATION_TIMEOUT_MS)
            try {
              await page.goto(url, { waitUntil: 'networkidle0', timeout: navTimeout })
            } catch {
              try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: navTimeout })
                await new Promise(resolve => setTimeout(resolve, 2000))
              } catch {
                return makeEmptyResult(url, Date.now() - startTime, statusCode)
              }
            }

            const content = await extractPageContent(page)
            const loadTimeMs = Date.now() - startTime
            const blockReason = detectRenderBlock(content.contentText, content.rawHtml)

            return {
              url,
              title: content.title,
              h1: content.h1,
              metaDescription: content.metaDescription,
              contentText: content.contentText,
              rawHtml: content.rawHtml,
              headTags: content.headTags,
              discoveredUrls: content.discoveredUrls,
              linksFound: content.linksFound,
              statusCode,
              loadTimeMs,
              blockedByBot: !!blockReason,
              blockReason,
            } as BrowserRenderResult
          } catch (err) {
            return makeEmptyResult(url, Date.now() - startTime, null, String(err))
          } finally {
            if (page) await page.close().catch(() => {})
          }
        }),
      )
      results.push(...batchResults)
    }

    return results
  } catch (err) {
    console.error('[browser-renderer] Browser launch failed:', err)
    // Return empty results for all URLs if browser can't start
    return urls.map(url => makeEmptyResult(url, 0, null, 'Browser launch failed'))
  } finally {
    if (browser) {
      await browser.close().catch(() => {})
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────

function makeEmptyResult(
  url: string,
  loadTimeMs: number,
  statusCode: number | null,
  error?: string,
): BrowserRenderResult {
  return {
    url,
    title: null,
    h1: null,
    metaDescription: null,
    contentText: null,
    rawHtml: null,
    headTags: null,
    discoveredUrls: [],
    linksFound: 0,
    statusCode,
    loadTimeMs,
    blockedByBot: false,
    blockReason: error ? `Browser render failed: ${error.substring(0, 200)}` : null,
  }
}
