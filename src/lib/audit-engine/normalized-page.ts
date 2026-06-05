/**
 * Normalized Page — Canonical Page-Input Schema
 *
 * All acquisition methods (standard fetch, browser render, owner upload)
 * MUST produce this exact shape before any content enters the analysis
 * pipeline. This is the contract between acquisition and analysis.
 *
 * Part of the Protected Site Audit Mode feature.
 * See docs/protected-site-audit-mode.md for architecture details.
 */

import type { CrawledPage, HeadTagData } from './crawler'

// ── Acquisition metadata types ────────────────────────────────

export type AcquisitionMethod =
  | 'firecrawl'
  | 'direct'
  | 'jina'
  | 'browser_render'
  | 'owner_provided'   // future: manual content upload

export type AcquisitionQuality =
  | 'full'       // Content length >= 500 chars, real page content
  | 'partial'    // Content length 200-499 chars, may be truncated
  | 'degraded'   // Content length 50-199 chars, minimal usable content
  | 'empty'      // Content length < 50 chars or null, unusable

/**
 * Per-page acquisition provenance — tracks how the page was acquired
 * and what strategies were attempted.
 */
export interface PageAcquisition {
  /** Which method ultimately succeeded */
  method: AcquisitionMethod
  /** Quality assessment of the acquired content */
  quality: AcquisitionQuality
  /** All strategies attempted for this page, in order */
  attempts: AcquisitionAttempt[]
  /** Content length of the acquired text (0 if no content) */
  contentLength: number
  /** Whether this page was acquired via a fallback strategy */
  isFallback: boolean
}

export interface AcquisitionAttempt {
  method: AcquisitionMethod
  succeeded: boolean
  durationMs: number
  /** Reason for failure, if any */
  failReason?: string  // e.g. 'blocked_cloudflare', 'thin_content', 'timeout', 'http_403'
}

// ── Audit-level acquisition summary ───────────────────────────

export type AcquisitionState = 'crawlable' | 'browser_accessible' | 'protected'

/**
 * Summary of all page acquisitions for an audit.
 * Stored in audits.crawl_summary (JSONB column).
 */
export interface AcquisitionSummary {
  /** Overall acquisition state for the audit */
  state: AcquisitionState
  /** Breakdown by acquisition method */
  pagesByMethod: Record<AcquisitionMethod, number>
  /** How many pages hit each quality level */
  pagesByQuality: Record<AcquisitionQuality, number>
  /** Whether browser render fallback was used */
  usedBrowserFallback: boolean
  /** Whether any pages were still blocked after all strategies */
  hasBlockedPages: boolean
  /** What protection systems were detected */
  detectedProtection: string[]
  /** Total pages attempted vs successfully acquired */
  pagesAttempted: number
  pagesAcquired: number
}

// ── Canonical NormalizedPage schema ────────────────────────────

/**
 * NormalizedPage — the canonical page record that the analysis
 * pipeline consumes. Every acquisition method MUST produce this
 * exact shape. If a field can't be populated, it MUST be null.
 */
export interface NormalizedPage {
  // ── Identity ──────────────────────────────────────────────
  /** Canonical URL after redirect resolution */
  url: string
  /** Original URL before redirects (null if no redirect) */
  originalUrl: string | null

  // ── SEO metadata ──────────────────────────────────────────
  title: string | null
  h1: string | null
  metaDescription: string | null
  /** Parsed <head> tag data (canonical, og:*, hreflang, etc.) */
  headTags: HeadTagData | null

  // ── Content ───────────────────────────────────────────────
  /** Clean extracted text content, max 12000 chars */
  contentText: string | null
  /** Raw HTML (for link extraction, structured data, etc.) */
  rawHtml: string | null

  // ── Links ─────────────────────────────────────────────────
  /** URLs discovered on this page */
  discoveredUrls: string[]
  /** Total link count */
  linksFound: number

  // ── Technical ─────────────────────────────────────────────
  statusCode: number | null
  /** Wall-clock fetch time in ms */
  loadTimeMs: number | null
  /** ISO timestamp of acquisition */
  acquiredAt: string

  // ── Acquisition provenance ────────────────────────────────
  acquisition: PageAcquisition

  // ── Block detection ───────────────────────────────────────
  /** True when the page appears to be a bot-block page */
  blockedByBot: boolean
  /** Human-readable block reason */
  blockReason: string | null
}

// ── Quality assessment ────────────────────────────────────────

/**
 * Assess the quality of page content based on length.
 * Thresholds match the existing pipeline's decisions:
 *   >= 500 chars → full (good content for analysis)
 *   200-499 chars → partial (usable but limited)
 *   50-199 chars → degraded (minimal, may be a stub)
 *   < 50 chars → empty (unusable)
 */
export function assessContentQuality(contentText: string | null): AcquisitionQuality {
  const len = contentText?.length ?? 0
  if (len >= 500) return 'full'
  if (len >= 200) return 'partial'
  if (len >= 50) return 'degraded'
  return 'empty'
}

// ── Adapter: CrawledPage → NormalizedPage ─────────────────────

/**
 * Convert a CrawledPage (from the existing crawler) to a NormalizedPage.
 * This is a pure mapping — no new data is fetched.
 *
 * @param page The raw CrawledPage from crawlPages()
 * @param attempts Optional pre-built attempt list. If not provided,
 *                 a single attempt is inferred from the page's fields.
 */
export function fromCrawledPage(
  page: CrawledPage,
  attempts?: AcquisitionAttempt[],
): NormalizedPage {
  const method = mapFetchStrategy(page.fetchStrategy)
  const quality = assessContentQuality(page.contentText)

  // If no explicit attempts provided, infer one from the page data
  const resolvedAttempts = attempts ?? [{
    method,
    succeeded: quality !== 'empty' && !page.blockedByBot,
    durationMs: page.loadTimeMs ?? 0,
    failReason: page.blockedByBot ? (page.blockReason ?? 'blocked') : undefined,
  }]

  return {
    url: page.url,
    originalUrl: null,  // CrawledPage doesn't track pre-redirect URL
    title: page.title,
    h1: page.h1,
    metaDescription: page.metaDescription,
    headTags: page.headTags ?? null,
    contentText: page.contentText,
    rawHtml: page.rawHtml ?? null,
    discoveredUrls: page.discoveredUrls ?? [],
    linksFound: page.linksFound,
    statusCode: page.statusCode,
    loadTimeMs: page.loadTimeMs,
    acquiredAt: page.crawledAt,
    acquisition: {
      method,
      quality,
      attempts: resolvedAttempts,
      contentLength: page.contentText?.length ?? 0,
      isFallback: method === 'browser_render' || method === 'owner_provided',
    },
    blockedByBot: page.blockedByBot ?? false,
    blockReason: page.blockReason ?? null,
  }
}

/**
 * Map the fetchStrategy string from CrawledPage to our typed AcquisitionMethod.
 */
function mapFetchStrategy(strategy: string | undefined | null): AcquisitionMethod {
  switch (strategy) {
    case 'firecrawl': return 'firecrawl'
    case 'direct': return 'direct'
    case 'jina': return 'jina'
    case 'browser_render': return 'browser_render'
    case 'owner_provided': return 'owner_provided'
    default: return 'direct'  // Conservative default
  }
}

// ── Aggregation: NormalizedPage[] → analysis string ───────────

/**
 * Format normalized pages into the string format that the analyzer expects.
 *
 * This produces output IDENTICAL to the current aggregation in
 * process-audit.ts (lines 965-980). The format is:
 *
 *   URL: https://example.com/page
 *   Title: Page Title
 *   H1: Main Heading
 *   Meta Description: ...
 *   Head Tags:
 *     <structured head tag data>
 *   Content:
 *     <full page text>
 *
 *   ---
 *
 *   URL: https://example.com/another-page
 *   ...
 *
 * @param pages Filtered NormalizedPage array (post quality/auth/dedup filters)
 * @param formatHeadTags Function to format head tags (injected to avoid circular import)
 */
export function formatPagesForAnalysis(
  pages: NormalizedPage[],
  formatHeadTags: (tags: HeadTagData) => string,
): string {
  return pages
    .map((p) => {
      let block = ''
      if (p.url) block += `URL: ${p.url}\n`
      if (p.title) block += `Title: ${p.title}\n`
      if (p.h1) block += `H1: ${p.h1}\n`
      if (p.metaDescription) block += `Meta Description: ${p.metaDescription}\n`
      if (p.headTags) {
        const headBlock = formatHeadTags(p.headTags)
        if (headBlock) block += `Head Tags:\n${headBlock}\n`
      }
      if (p.contentText) block += `Content:\n${p.contentText}\n`
      return block
    })
    .join('\n---\n')
}

// ── Summary computation ───────────────────────────────────────

/**
 * Compute an AcquisitionSummary from a set of NormalizedPages.
 * This is stored in audits.crawl_summary for observability.
 */
export function computeAcquisitionSummary(
  pages: NormalizedPage[],
  state: AcquisitionState,
): AcquisitionSummary {
  const pagesByMethod: Record<AcquisitionMethod, number> = {
    firecrawl: 0,
    direct: 0,
    jina: 0,
    browser_render: 0,
    owner_provided: 0,
  }
  const pagesByQuality: Record<AcquisitionQuality, number> = {
    full: 0,
    partial: 0,
    degraded: 0,
    empty: 0,
  }
  const detectedProtection = new Set<string>()
  let usedBrowserFallback = false
  let hasBlockedPages = false

  for (const page of pages) {
    pagesByMethod[page.acquisition.method]++
    pagesByQuality[page.acquisition.quality]++

    if (page.acquisition.method === 'browser_render') {
      usedBrowserFallback = true
    }
    if (page.blockedByBot) {
      hasBlockedPages = true
      if (page.blockReason) {
        detectedProtection.add(page.blockReason)
      }
    }
  }

  return {
    state,
    pagesByMethod,
    pagesByQuality,
    usedBrowserFallback,
    hasBlockedPages,
    detectedProtection: Array.from(detectedProtection),
    pagesAttempted: pages.length,
    pagesAcquired: pages.filter(p => p.acquisition.quality !== 'empty').length,
  }
}
