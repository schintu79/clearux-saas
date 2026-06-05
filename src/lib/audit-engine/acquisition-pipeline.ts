/**
 * Acquisition Pipeline — Staged Page Acquisition Orchestrator
 *
 * Manages the three-stage acquisition flow:
 *   1. Standard crawl (existing crawlPages)
 *   2. Browser render fallback (for blocked/thin pages)
 *   3. Protected state (when all strategies fail)
 *
 * This module replaces the binary blocked/pass decision in
 * process-audit.ts with a graduated fallback chain.
 *
 * Part of the Protected Site Audit Mode feature.
 * See docs/protected-site-audit-mode.md for architecture details.
 */

import { crawlPages, type CrawledPage, type CrawlStats } from './crawler'
import { browserRenderPages, type BrowserRenderResult } from './browser-renderer'
import {
  type NormalizedPage,
  type AcquisitionState,
  type AcquisitionSummary,
  fromCrawledPage,
  computeAcquisitionSummary,
  assessContentQuality,
} from './normalized-page'
import {
  AcquisitionDiagnosticLogger,
  type AcquisitionDiagnostics,
} from './acquisition-diagnostics'

// ── Configuration ─────────────────────────────────────────────

export interface AcquisitionConfig {
  /** Enable browser render fallback (feature flag) */
  browserFallbackEnabled: boolean
  /** Max pages to browser-render (Puppeteer is expensive) */
  browserFallbackMaxPages: number
  /** Min ratio of blocked/thin pages to trigger browser fallback */
  fallbackThreshold: number
  /** Total acquisition timeout in ms (covers standard + browser render) */
  totalTimeoutMs: number
}

/** Default config when feature flag is off — matches current behavior exactly */
export const DEFAULT_CONFIG: AcquisitionConfig = {
  browserFallbackEnabled: false,
  browserFallbackMaxPages: 0,
  fallbackThreshold: 0.5,
  totalTimeoutMs: 180_000,
}

/** Config when feature flag is on — enables browser fallback */
export const BROWSER_FALLBACK_CONFIG: AcquisitionConfig = {
  browserFallbackEnabled: true,
  browserFallbackMaxPages: 5,
  fallbackThreshold: 0.5,
  totalTimeoutMs: 240_000,  // 4 minutes: 3min crawl + 1min browser
}

// ── Result types ──────────────────────────────────────────────

export interface AcquisitionResult {
  /** Normalized pages ready for analysis pipeline */
  pages: NormalizedPage[]
  /** Raw crawl stats from the standard crawl (for DB storage) */
  crawlStats: CrawlStats
  /** Raw crawled pages (for DB page insertion — existing format) */
  rawCrawledPages: CrawledPage[]
  /** Audit-level acquisition summary */
  summary: AcquisitionSummary
  /** Detailed diagnostics for audit_logs */
  diagnostics: AcquisitionDiagnostics
  /** The acquisition state determined for this audit */
  state: AcquisitionState
  /** Limitations detected during acquisition */
  limitations: AcquisitionLimitation[]
}

export interface AcquisitionLimitation {
  id: string
  title: string
  description: string
}

// ── Soft block markers (from process-audit.ts) ────────────────

const SOFT_BLOCK_MARKERS = [
  /just a moment/i, /checking your browser/i, /enable javascript/i,
  /please turn javascript on/i, /this site requires javascript/i,
  /access denied/i, /captcha/i, /verify you are human/i,
  /cloudflare/i, /ray id/i, /challenge-platform/i,
  /datadome/i, /perimeterx/i, /incapsula/i,
  /not available in your (?:region|country)/i,
  /this content is not available/i,
  /rate limit(?:ed|ing)?\b/i, /too many requests/i,
  /automated (?:access|requests?) (?:not|is not) allowed/i,
]

// ── Main acquisition function ─────────────────────────────────

/**
 * Staged acquisition pipeline. Replaces the binary crawl→validate
 * logic in process-audit.ts with a graduated fallback chain.
 *
 * When browserFallbackEnabled is false, this behaves identically
 * to the current pipeline — standard crawl with binary blocking.
 *
 * When enabled:
 * 1. Run standard crawl (crawlPages)
 * 2. Evaluate: if sufficient content → CRAWLABLE
 * 3. If blocked/thin → browser render fallback for affected pages
 * 4. Evaluate: if browser got content → BROWSER_ACCESSIBLE
 * 5. If still blocked → PROTECTED (caller handles refund)
 */
export async function acquirePages(
  url: string,
  maxPages: number,
  auditId: string,
  config: AcquisitionConfig,
  onProgress?: (pct: number, stage: string) => Promise<void>,
): Promise<AcquisitionResult> {
  const diag = new AcquisitionDiagnosticLogger(auditId)
  const limitations: AcquisitionLimitation[] = []

  // ── Stage 1: Standard crawl ─────────────────────────────────
  diag.logDecision('Starting standard crawl', { url, maxPages })

  const CRAWL_TIMEOUT_MS = Math.min(config.totalTimeoutMs, 180_000)
  const crawlStart = Date.now()

  let crawlOutput: { pages: CrawledPage[]; stats: CrawlStats } | null = null
  try {
    crawlOutput = await withTimeout(
      crawlPages(url, maxPages, onProgress),
      CRAWL_TIMEOUT_MS,
      'standard-crawl',
    )
  } catch (err) {
    diag.logError(`Standard crawl failed: ${String(err)}`, url)
  }

  if (!crawlOutput || crawlOutput.pages.length === 0) {
    diag.logDecision('Standard crawl returned no pages — attempting browser render if enabled')

    if (config.browserFallbackEnabled) {
      return await attemptBrowserOnly(url, auditId, config, diag, limitations)
    }

    // Feature flag off — throw like current pipeline
    const diagnostics = diag.flush('protected')
    throw new AcquisitionError(
      `Failed to crawl ${url} — no pages returned after ${Math.round((Date.now() - crawlStart) / 1000)}s.`,
      'protected',
      diagnostics,
    )
  }

  const crawledPages = crawlOutput.pages
  const crawlStats = crawlOutput.stats

  diag.logSummary(`Standard crawl complete: ${crawledPages.length} pages`, {
    pagesWithContent: crawledPages.filter(p => p.contentText && p.contentText.length >= 200).length,
    pagesBlocked: crawledPages.filter(p => p.blockedByBot).length,
  })

  // ── Evaluate standard crawl results ─────────────────────────
  const normalizedPages = crawledPages.map(p => fromCrawledPage(p))
  const evaluation = evaluateCrawlQuality(normalizedPages, url)

  if (evaluation.state === 'crawlable') {
    diag.logDecision('Standard crawl sufficient — state: CRAWLABLE', {
      contentRatio: evaluation.contentRatio,
      homepageOk: evaluation.homepageOk,
    })

    // Add degraded crawl limitation if applicable
    if (evaluation.contentRatio < 0.8 && crawledPages.length > 3) {
      const goodCount = normalizedPages.filter(p => p.acquisition.quality !== 'empty').length
      limitations.push({
        id: 'degraded_crawl',
        title: 'Limited content access',
        description: `Only ${goodCount} of ${crawledPages.length} pages returned usable content. Scores are based on the accessible pages only.`,
      })
    }

    const summary = computeAcquisitionSummary(normalizedPages, 'crawlable')
    return {
      pages: normalizedPages,
      crawlStats,
      rawCrawledPages: crawledPages,
      summary,
      diagnostics: diag.flush('crawlable'),
      state: 'crawlable',
      limitations,
    }
  }

  // ── Stage 2: Browser render fallback ────────────────────────
  if (!config.browserFallbackEnabled) {
    // Feature flag off — replicate current binary behavior
    diag.logDecision('Browser fallback disabled — checking for hard blocks')
    return handleLegacyBlocking(normalizedPages, crawledPages, crawlStats, url, diag, limitations)
  }

  diag.logDecision('Standard crawl insufficient — escalating to browser render', {
    reason: evaluation.reason,
    contentRatio: evaluation.contentRatio,
    homepageOk: evaluation.homepageOk,
  })

  // Identify pages that need browser rendering
  const pagesToRender = normalizedPages
    .filter(p => p.blockedByBot || p.acquisition.quality === 'empty' || p.acquisition.quality === 'degraded')
    .map(p => p.url)
    .slice(0, config.browserFallbackMaxPages)

  if (pagesToRender.length === 0) {
    // All pages have some content but quality is mixed — proceed with what we have
    diag.logDecision('No pages need browser rendering — proceeding with partial content')
    const summary = computeAcquisitionSummary(normalizedPages, 'crawlable')
    return {
      pages: normalizedPages,
      crawlStats,
      rawCrawledPages: crawledPages,
      summary,
      diagnostics: diag.flush('crawlable'),
      state: 'crawlable',
      limitations,
    }
  }

  diag.logDecision(`Browser rendering ${pagesToRender.length} page(s)`, { urls: pagesToRender })

  const BROWSER_TIMEOUT_MS = Math.max(config.totalTimeoutMs - (Date.now() - crawlStart), 30_000)
  let browserResults: BrowserRenderResult[] = []
  try {
    browserResults = await withTimeout(
      browserRenderPages(pagesToRender, 2, 20_000),
      BROWSER_TIMEOUT_MS,
      'browser-render',
    ) ?? []
  } catch (err) {
    diag.logError(`Browser render failed: ${String(err)}`)
  }

  // Log each browser render result
  for (const result of browserResults) {
    diag.logAttempt(result.url, {
      method: 'browser_render',
      succeeded: !result.blockedByBot && (result.contentText?.length ?? 0) >= 50,
      durationMs: result.loadTimeMs,
      failReason: result.blockedByBot ? (result.blockReason ?? 'still blocked') : undefined,
    })
  }

  // Merge browser results into the normalized pages
  const mergedPages = mergeBrowserResults(normalizedPages, browserResults)
  const postBrowserEval = evaluateCrawlQuality(mergedPages, url)

  if (postBrowserEval.homepageOk && postBrowserEval.contentRatio >= 0.3) {
    diag.logDecision(`Browser render helped — state: BROWSER_ACCESSIBLE`, {
      contentRatio: postBrowserEval.contentRatio,
    })

    limitations.push({
      id: 'browser_render_fallback',
      title: 'Browser rendering used',
      description: `Standard crawling was blocked on ${pagesToRender.length} page(s). We used browser rendering to access the content. Results may differ slightly from what standard crawlers see.`,
    })

    const summary = computeAcquisitionSummary(mergedPages, 'browser_accessible')
    return {
      pages: mergedPages,
      crawlStats,
      rawCrawledPages: crawledPages,
      summary,
      diagnostics: diag.flush('browser_accessible'),
      state: 'browser_accessible',
      limitations,
    }
  }

  // ── Stage 3: Protected ──────────────────────────────────────
  diag.logDecision('All strategies exhausted — state: PROTECTED', {
    contentRatio: postBrowserEval.contentRatio,
    homepageOk: postBrowserEval.homepageOk,
  })

  const protectedSummary = computeAcquisitionSummary(mergedPages, 'protected')
  const protectedDiag = diag.flush('protected')

  // Determine what protection was detected
  const detectedProtection = protectedSummary.detectedProtection.join(', ') || 'unknown protection'

  throw new AcquisitionError(
    `BLOCKED: ${url} is protected by ${detectedProtection}. ` +
    `Both standard crawling and browser rendering failed to retrieve usable content. ` +
    `Your credit has been refunded automatically.`,
    'protected',
    protectedDiag,
    protectedSummary,
  )
}

// ── Evaluation helpers ────────────────────────────────────────

interface CrawlEvaluation {
  state: 'crawlable' | 'needs_fallback'
  homepageOk: boolean
  contentRatio: number
  reason: string
}

/**
 * Evaluate whether the crawled content is sufficient for analysis.
 */
function evaluateCrawlQuality(pages: NormalizedPage[], targetUrl: string): CrawlEvaluation {
  if (pages.length === 0) {
    return { state: 'needs_fallback', homepageOk: false, contentRatio: 0, reason: 'no pages' }
  }

  const homepage = pages[0]
  const homepageOk = homepage.acquisition.quality !== 'empty' && !homepage.blockedByBot

  // Check for soft block markers on homepage
  if (homepageOk) {
    const homeContent = (homepage.contentText || '').replace(/\s+/g, ' ').trim()
    const matchedBlock = SOFT_BLOCK_MARKERS.find(p => p.test(homeContent))
    if (matchedBlock) {
      return {
        state: 'needs_fallback',
        homepageOk: false,
        contentRatio: 0,
        reason: `homepage matches soft block marker: ${matchedBlock.source}`,
      }
    }
  }

  const contentPages = pages.filter(p => p.acquisition.quality !== 'empty' && !p.blockedByBot)
  const contentRatio = contentPages.length / pages.length

  if (!homepageOk) {
    return { state: 'needs_fallback', homepageOk: false, contentRatio, reason: 'homepage blocked or empty' }
  }

  if (contentRatio >= 0.5) {
    return { state: 'crawlable', homepageOk: true, contentRatio, reason: 'sufficient content' }
  }

  return {
    state: 'needs_fallback',
    homepageOk: true,
    contentRatio,
    reason: `only ${contentPages.length}/${pages.length} pages have content`,
  }
}

/**
 * When browser fallback is disabled, replicate the current pipeline's
 * binary blocking logic. Throws the same errors as the current code.
 */
function handleLegacyBlocking(
  normalizedPages: NormalizedPage[],
  rawPages: CrawledPage[],
  crawlStats: CrawlStats,
  url: string,
  diag: AcquisitionDiagnosticLogger,
  limitations: AcquisitionLimitation[],
): AcquisitionResult {
  const homepage = normalizedPages[0]

  // Check homepage for bot blocking
  if (homepage?.blockedByBot) {
    const diagnostics = diag.flush('protected')
    throw new AcquisitionError(
      `BLOCKED: ${url} is protected by anti-bot technology (${homepage.blockReason || 'unknown protection'}). ` +
      `Your credit has been refunded automatically.`,
      'protected',
      diagnostics,
    )
  }

  // Check homepage for soft block markers
  const homeContent = (homepage?.contentText || '').replace(/\s+/g, ' ').trim()
  const matchedSoftBlock = SOFT_BLOCK_MARKERS.find(p => p.test(homeContent))
  if (matchedSoftBlock) {
    const diagnostics = diag.flush('protected')
    throw new AcquisitionError(
      `BLOCKED: ${url} appears to use bot protection that blocks automated crawlers. ` +
      `Your credit has been refunded automatically.`,
      'protected',
      diagnostics,
    )
  }

  // Check homepage content length
  if (homeContent.length < 200) {
    const diagnostics = diag.flush('protected')
    throw new AcquisitionError(
      `BLOCKED: ${url} returned very little content (${homeContent.length} characters). ` +
      `Your credit has been refunded automatically.`,
      'protected',
      diagnostics,
    )
  }

  // Degraded crawl check
  const goodPages = normalizedPages.filter(p => p.acquisition.quality !== 'empty')
  if (normalizedPages.length > 3 && goodPages.length <= 1) {
    limitations.push({
      id: 'degraded_crawl',
      title: 'Limited content access',
      description: `Only ${goodPages.length} of ${normalizedPages.length} pages returned usable content.`,
    })
  }

  const summary = computeAcquisitionSummary(normalizedPages, 'crawlable')
  return {
    pages: normalizedPages,
    crawlStats,
    rawCrawledPages: rawPages,
    summary,
    diagnostics: diag.flush('crawlable'),
    state: 'crawlable',
    limitations,
  }
}

/**
 * When standard crawl returns zero pages but browser fallback is enabled,
 * try browser-rendering the target URL directly.
 */
async function attemptBrowserOnly(
  url: string,
  auditId: string,
  config: AcquisitionConfig,
  diag: AcquisitionDiagnosticLogger,
  limitations: AcquisitionLimitation[],
): Promise<AcquisitionResult> {
  diag.logDecision('Standard crawl returned no pages — trying browser render for homepage')

  try {
    const browserResults = await browserRenderPages([url], 1, 20_000)
    const result = browserResults[0]

    if (result && !result.blockedByBot && (result.contentText?.length ?? 0) >= 200) {
      diag.logDecision('Browser render succeeded for homepage — state: BROWSER_ACCESSIBLE')

      const normalizedPage: NormalizedPage = {
        url: result.url,
        originalUrl: null,
        title: result.title,
        h1: result.h1,
        metaDescription: result.metaDescription,
        headTags: result.headTags,
        contentText: result.contentText,
        rawHtml: result.rawHtml,
        discoveredUrls: result.discoveredUrls,
        linksFound: result.linksFound,
        statusCode: result.statusCode,
        loadTimeMs: result.loadTimeMs,
        acquiredAt: new Date().toISOString(),
        acquisition: {
          method: 'browser_render',
          quality: assessContentQuality(result.contentText),
          attempts: [{
            method: 'browser_render',
            succeeded: true,
            durationMs: result.loadTimeMs,
          }],
          contentLength: result.contentText?.length ?? 0,
          isFallback: true,
        },
        blockedByBot: false,
        blockReason: null,
      }

      limitations.push({
        id: 'browser_render_only',
        title: 'Full site crawl blocked',
        description: 'Standard crawling was completely blocked. We used browser rendering to access the homepage only. The audit is based on a single page.',
      })
      limitations.push({
        id: 'single_page_crawled',
        title: 'Single page analysed',
        description: 'Scores and findings are based solely on the homepage.',
      })

      const emptyCrawlStats: CrawlStats = {
        urlsDiscovered: 1, pagesAnalyzed: 1, pagesSkipped: 0,
        pagesBlocked: 0, pagesDuplicate: 0, pagesExcluded: 0,
        jsPagesDetected: 0,
        discoverySources: { sitemap: 0, htmlLinks: 0, commonPaths: 0, firecrawlMap: 0 },
        excludedUrls: [], crawlStartedAt: new Date().toISOString(), crawlCompletedAt: new Date().toISOString(),
      }

      const summary = computeAcquisitionSummary([normalizedPage], 'browser_accessible')
      return {
        pages: [normalizedPage],
        crawlStats: emptyCrawlStats,
        rawCrawledPages: [],
        summary,
        diagnostics: diag.flush('browser_accessible'),
        state: 'browser_accessible',
        limitations,
      }
    }
  } catch (err) {
    diag.logError(`Browser-only render failed: ${String(err)}`, url)
  }

  // Total failure
  const diagnostics = diag.flush('protected')
  throw new AcquisitionError(
    `BLOCKED: ${url} could not be accessed by any acquisition strategy. ` +
    `Your credit has been refunded automatically.`,
    'protected',
    diagnostics,
  )
}

// ── Merge helpers ─────────────────────────────────────────────

/**
 * Merge browser-rendered results into the normalized page array.
 * Browser results replace the corresponding standard crawl results
 * only if the browser version has better content.
 */
function mergeBrowserResults(
  standardPages: NormalizedPage[],
  browserResults: BrowserRenderResult[],
): NormalizedPage[] {
  const browserByUrl = new Map<string, BrowserRenderResult>()
  for (const result of browserResults) {
    browserByUrl.set(result.url, result)
  }

  return standardPages.map(page => {
    const browserResult = browserByUrl.get(page.url)
    if (!browserResult) return page

    const browserQuality = assessContentQuality(browserResult.contentText)
    const standardQuality = page.acquisition.quality

    // Only replace if browser result is better
    const qualityOrder: Record<string, number> = { full: 3, partial: 2, degraded: 1, empty: 0 }
    if ((qualityOrder[browserQuality] ?? 0) <= (qualityOrder[standardQuality] ?? 0)) {
      return page // Standard result was better or equal
    }

    // Merge: use browser content but preserve standard crawl attempts in history
    return {
      ...page,
      title: browserResult.title ?? page.title,
      h1: browserResult.h1 ?? page.h1,
      metaDescription: browserResult.metaDescription ?? page.metaDescription,
      contentText: browserResult.contentText ?? page.contentText,
      rawHtml: browserResult.rawHtml ?? page.rawHtml,
      headTags: browserResult.headTags ?? page.headTags,
      discoveredUrls: browserResult.discoveredUrls.length > 0 ? browserResult.discoveredUrls : page.discoveredUrls,
      linksFound: browserResult.linksFound || page.linksFound,
      blockedByBot: browserResult.blockedByBot,
      blockReason: browserResult.blockReason,
      acquisition: {
        method: 'browser_render',
        quality: browserQuality,
        attempts: [
          ...page.acquisition.attempts,
          {
            method: 'browser_render' as const,
            succeeded: !browserResult.blockedByBot && (browserResult.contentText?.length ?? 0) >= 50,
            durationMs: browserResult.loadTimeMs,
            failReason: browserResult.blockedByBot ? (browserResult.blockReason ?? 'blocked') : undefined,
          },
        ],
        contentLength: browserResult.contentText?.length ?? 0,
        isFallback: true,
      },
    }
  })
}

// ── Utility ───────────────────────────────────────────────────

/**
 * Custom error class for acquisition failures.
 * Carries diagnostics and summary for logging by the caller.
 */
export class AcquisitionError extends Error {
  readonly state: AcquisitionState
  readonly diagnostics: AcquisitionDiagnostics
  readonly summary?: AcquisitionSummary

  constructor(
    message: string,
    state: AcquisitionState,
    diagnostics: AcquisitionDiagnostics,
    summary?: AcquisitionSummary,
  ) {
    super(message)
    this.name = 'AcquisitionError'
    this.state = state
    this.diagnostics = diagnostics
    this.summary = summary
  }
}

/**
 * Run a promise with a timeout. Returns null on timeout.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn(`[acquisition] ${label} timed out after ${timeoutMs}ms`)
        resolve(null)
      }, timeoutMs),
    ),
  ])
}
