// ============================================================
// ClearUX — Firecrawl API Client
// ============================================================
// Thin wrapper around the Firecrawl REST API (v1).
// Used by the audit crawler for site mapping and page scraping.
//
// Env var: FIRE_CRAWL_API_KEY (set on Vercel)
//
// PROPRIETARY — do not distribute outside the ClearUX codebase.
// ============================================================

const FIRECRAWL_BASE = 'https://api.firecrawl.dev/v1'

/* ── API key ──────────────────────────────────────────────── */

function getFirecrawlKey(): string | null {
  // Support both env var naming conventions (Vercel may have either)
  return process.env.FIRE_CRAWL_API_KEY || process.env.FIRECRAWL_API_KEY || null
}

/** Check whether Firecrawl is configured (key present). */
export function isFirecrawlConfigured(): boolean {
  const hasKey = Boolean(getFirecrawlKey())
  if (!hasKey) {
    console.log('[firecrawl] Not configured — neither FIRE_CRAWL_API_KEY nor FIRECRAWL_API_KEY is set')
  }
  return hasKey
}

/* ── Types ────────────────────────────────────────────────── */

/** Firecrawl /v1/scrape response (relevant fields only) */
export interface FirecrawlScrapeResult {
  url: string
  markdown?: string
  html?: string
  rawHtml?: string
  metadata?: {
    title?: string
    description?: string
    language?: string
    ogTitle?: string
    ogDescription?: string
    ogImage?: string
    statusCode?: number
    [key: string]: unknown
  }
  links?: string[]
  actions?: unknown
}

/** Firecrawl /v1/map response */
export interface FirecrawlMapResult {
  success: boolean
  links?: string[]
  error?: string
}

/* ── Core fetch helper ────────────────────────────────────── */

async function firecrawlRequest<T>(
  endpoint: string,
  body: Record<string, unknown>,
  timeoutMs: number = 30_000,
): Promise<T> {
  const key = getFirecrawlKey()
  if (!key) throw new Error('Firecrawl API key not configured (FIRE_CRAWL_API_KEY)')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const resp = await fetch(`${FIRECRAWL_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`Firecrawl ${endpoint} HTTP ${resp.status}: ${text.slice(0, 300)}`)
    }

    return (await resp.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/* ── Scrape a single page ─────────────────────────────────── */

/**
 * Scrape a single URL via Firecrawl.
 * Returns markdown + html + metadata + links.
 * Returns `null` on error (caller should fall back to other strategies).
 */
export async function firecrawlScrape(
  url: string,
  opts?: {
    formats?: string[]
    timeout?: number
    waitFor?: number
    onlyMainContent?: boolean
    includeTags?: string[]
    excludeTags?: string[]
  },
): Promise<FirecrawlScrapeResult | null> {
  try {
    const body: Record<string, unknown> = {
      url,
      formats: opts?.formats ?? ['markdown', 'html', 'links'],
      onlyMainContent: opts?.onlyMainContent ?? false, // We want full page for audit
      timeout: opts?.timeout ?? 30000,
    }

    if (opts?.waitFor) body.waitFor = opts.waitFor
    if (opts?.includeTags) body.includeTags = opts.includeTags
    if (opts?.excludeTags) body.excludeTags = opts.excludeTags

    const resp = await firecrawlRequest<{ success: boolean; data?: FirecrawlScrapeResult; error?: string }>(
      '/scrape',
      body,
      (opts?.timeout ?? 30000) + 5000, // HTTP timeout slightly longer than Firecrawl's internal timeout
    )

    if (!resp.success || !resp.data) {
      console.warn(`[firecrawl] Scrape failed for ${url}: ${resp.error || 'no data'}`)
      return null
    }

    return resp.data
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[firecrawl] Scrape error for ${url}: ${msg}`)
    return null
  }
}

/* ── Map a site (URL discovery) ───────────────────────────── */

/**
 * Use Firecrawl's /map endpoint to discover internal URLs.
 * Much faster than sitemap + common path probing.
 * Returns an array of discovered URL strings, or `[]` on error.
 */
export async function firecrawlMap(
  url: string,
  opts?: {
    limit?: number
    search?: string
    ignoreSitemap?: boolean
    includeSubdomains?: boolean
  },
): Promise<string[]> {
  try {
    const body: Record<string, unknown> = {
      url,
      limit: opts?.limit ?? 200,
    }

    if (opts?.search) body.search = opts.search
    if (opts?.ignoreSitemap !== undefined) body.ignoreSitemap = opts.ignoreSitemap
    if (opts?.includeSubdomains !== undefined) body.includeSubdomains = opts.includeSubdomains

    const resp = await firecrawlRequest<FirecrawlMapResult>(
      '/map',
      body,
      15_000, // Map should be fast — 15s timeout
    )

    if (!resp.success || !resp.links) {
      console.warn(`[firecrawl] Map failed for ${url}: ${resp.error || 'no links'}`)
      return []
    }

    console.log(`[firecrawl] Map discovered ${resp.links.length} URLs for ${url}`)
    return resp.links
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[firecrawl] Map error for ${url}: ${msg}`)
    return []
  }
}
