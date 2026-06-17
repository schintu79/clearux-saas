/**
 * Google PageSpeed Insights API client
 *
 * Fetches real Core Web Vitals, Lighthouse scores, and diagnostics for a URL
 * using the PageSpeed Insights API (free tier, key-based).
 *
 * Now captures ALL four Lighthouse categories:
 *   Performance · Accessibility · Best Practices · SEO
 *
 * PROPRIETARY — do not distribute outside the Fixpath codebase.
 */

/* ── Types ────────────────────────────────────────────── */

export interface PageSpeedMetric {
  /** Raw numeric value */
  value: number
  /** Human-readable display value (e.g. "2.4 s", "0.12") */
  displayValue: string
  /** Pass/fail status against Google thresholds */
  status: 'good' | 'needs_improvement' | 'poor'
}

export interface PageSpeedDiagnostic {
  id: string
  title: string
  description: string
  /** Estimated savings in ms (if applicable) */
  savingsMs: number | null
  /** Estimated savings in bytes (if applicable) */
  savingsBytes: number | null
  /** Score 0-1 (0 = failing, 1 = passing) */
  score: number | null
}

export interface LighthouseCategories {
  /** Overall performance score 0-100 */
  performance: number
  /** Accessibility score 0-100 */
  accessibility: number
  /** Best practices score 0-100 */
  bestPractices: number
  /** SEO score 0-100 */
  seo: number
}

export interface PageSpeedResult {
  /** Overall performance score 0-100 (backward compat) */
  score: number
  /** All four Lighthouse category scores */
  categories: LighthouseCategories
  /** Strategy used for this test */
  strategy: 'mobile' | 'desktop'
  /** Core Web Vitals + key metrics */
  metrics: {
    fcp: PageSpeedMetric
    lcp: PageSpeedMetric
    cls: PageSpeedMetric
    inp: PageSpeedMetric
    ttfb: PageSpeedMetric
    speedIndex: PageSpeedMetric
    tbt: PageSpeedMetric
  }
  /** Actionable diagnostics (opportunities + audits) */
  diagnostics: PageSpeedDiagnostic[]
  /** URL that was actually tested (after redirects) */
  finalUrl: string
  /** Base64-encoded screenshot thumbnail (data URI) */
  screenshotUrl: string | null
  /** ISO timestamp of when the test was run */
  testedAt: string
}

export interface SpeedData {
  mobile: PageSpeedResult | null
  desktop: PageSpeedResult | null
  testedAt: string
}

/* ── API call ─────────────────────────────────────────── */

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

function getApiKey(): string {
  const key = process.env.GOOGLE_PAGESPEED_API_KEY || process.env.GOOGLE_API_KEY || ''
  if (!key) {
    console.warn('[pagespeed] No API key found — GOOGLE_PAGESPEED_API_KEY and GOOGLE_API_KEY are both empty. Requests may be rate-limited or rejected.')
  }
  return key
}

/**
 * Classify a metric value against Google's CWV thresholds
 */
function classifyMetric(
  id: string,
  value: number,
): 'good' | 'needs_improvement' | 'poor' {
  const thresholds: Record<string, [number, number]> = {
    fcp: [1800, 3000],            // ms
    lcp: [2500, 4000],            // ms
    cls: [0.1, 0.25],             // unitless
    inp: [200, 500],              // ms
    ttfb: [800, 1800],            // ms
    speedIndex: [3400, 5800],     // ms
    tbt: [200, 600],              // ms
  }
  const [good, poor] = thresholds[id] || [Infinity, Infinity]
  if (value <= good) return 'good'
  if (value <= poor) return 'needs_improvement'
  return 'poor'
}

/**
 * Format a metric value for display
 */
function formatMetric(id: string, value: number): string {
  if (id === 'cls') return value.toFixed(3)
  if (value >= 1000) return `${(value / 1000).toFixed(1)} s`
  return `${Math.round(value)} ms`
}

/**
 * Parse a single PageSpeed Insights API response into our typed structure
 */
function parseResponse(data: any, strategy: 'mobile' | 'desktop'): PageSpeedResult {
  const lighthouse = data?.lighthouseResult
  if (!lighthouse) {
    throw new Error('No lighthouse result in PageSpeed response')
  }

  const cats = lighthouse.categories || {}
  const audits = lighthouse.audits || {}

  // Parse all four category scores
  const categories: LighthouseCategories = {
    performance: Math.round((cats?.performance?.score ?? 0) * 100),
    accessibility: Math.round((cats?.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((cats?.['best-practices']?.score ?? 0) * 100),
    seo: Math.round((cats?.seo?.score ?? 0) * 100),
  }

  // Extract metrics
  const extractMetric = (auditId: string, metricKey: string): PageSpeedMetric => {
    const audit = audits[auditId]
    const numericValue = audit?.numericValue ?? 0
    return {
      value: numericValue,
      displayValue: audit?.displayValue || formatMetric(metricKey, numericValue),
      status: classifyMetric(metricKey, numericValue),
    }
  }

  const metrics = {
    fcp: extractMetric('first-contentful-paint', 'fcp'),
    lcp: extractMetric('largest-contentful-paint', 'lcp'),
    cls: extractMetric('cumulative-layout-shift', 'cls'),
    inp: extractMetric('interaction-to-next-paint', 'inp'),
    ttfb: extractMetric('server-response-time', 'ttfb'),
    speedIndex: extractMetric('speed-index', 'speedIndex'),
    tbt: extractMetric('total-blocking-time', 'tbt'),
  }

  // Extract diagnostics (opportunities with savings)
  const diagnosticIds = [
    'render-blocking-resources',
    'uses-optimized-images',
    'unused-javascript',
    'unused-css-rules',
    'uses-long-cache-ttl',
    'unminified-javascript',
    'unminified-css',
    'offscreen-images',
    'uses-responsive-images',
    'efficient-animated-content',
    'third-party-summary',
    'dom-size',
    'total-byte-weight',
    'server-response-time',
    'redirects',
    'uses-text-compression',
    'uses-rel-preconnect',
    'font-display',
    'bootup-time',
    'mainthread-work-breakdown',
    'legacy-javascript',
  ]

  const diagnostics: PageSpeedDiagnostic[] = []
  for (const id of diagnosticIds) {
    const audit = audits[id]
    if (!audit) continue
    // Only include failing or partially failing audits
    if (audit.score === 1 || audit.score === null) continue
    diagnostics.push({
      id,
      title: audit.title || id,
      description: (audit.description || '').replace(/\[.*?\]\(.*?\)/g, '').trim(),
      savingsMs: audit.details?.overallSavingsMs ?? null,
      savingsBytes: audit.details?.overallSavingsBytes ?? null,
      score: audit.score ?? null,
    })
  }

  // Sort by potential savings (biggest impact first)
  diagnostics.sort((a, b) => (b.savingsMs ?? 0) - (a.savingsMs ?? 0))

  // Extract screenshot (Lighthouse includes a final-screenshot audit)
  let screenshotUrl: string | null = null
  const screenshotAudit = audits['final-screenshot']
  if (screenshotAudit?.details?.data) {
    screenshotUrl = screenshotAudit.details.data // base64 data URI
  }

  return {
    score: categories.performance,
    categories,
    strategy,
    metrics,
    diagnostics,
    finalUrl: data?.id || '',
    screenshotUrl,
    testedAt: new Date().toISOString(),
  }
}

/* ── Public API ───────────────────────────────────────── */

/**
 * Run a PageSpeed test for a single strategy (mobile or desktop).
 * Requests ALL Lighthouse categories for comprehensive results.
 * Returns null if the API call fails (network error, rate limit, etc.)
 */
export async function runPageSpeedTest(
  url: string,
  strategy: 'mobile' | 'desktop',
): Promise<PageSpeedResult | null> {
  const apiKey = getApiKey()
  const params = new URLSearchParams({
    url,
    strategy,
  })
  // Request all four categories
  params.append('category', 'performance')
  params.append('category', 'accessibility')
  params.append('category', 'best-practices')
  params.append('category', 'seo')
  if (apiKey) params.set('key', apiKey)

  try {
    const fullUrl = `${PSI_ENDPOINT}?${params.toString()}`
    console.log(`[pagespeed] Fetching ${strategy} for ${url} (all categories)...`)
    const res = await fetch(fullUrl, {
      signal: AbortSignal.timeout(90000), // 90s timeout — requesting 4 categories takes longer
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn(`[pagespeed] API returned ${res.status} for ${url} (${strategy}): ${body.slice(0, 300)}`)
      return null
    }
    const data = await res.json()
    if (!data?.lighthouseResult) {
      console.warn(`[pagespeed] No lighthouseResult in response for ${url} (${strategy}). Keys:`, Object.keys(data || {}))
      return null
    }
    return parseResponse(data, strategy)
  } catch (err: any) {
    console.warn(`[pagespeed] Error fetching ${strategy} for ${url}:`, err?.message || err)
    return null
  }
}

/**
 * Run PageSpeed tests for both mobile and desktop.
 * Returns a SpeedData object suitable for storing on the audit record.
 */
export async function runFullSpeedTest(url: string): Promise<SpeedData> {
  // Ensure URL has protocol — PageSpeed API requires a full URL
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`
  const [mobile, desktop] = await Promise.all([
    runPageSpeedTest(normalizedUrl, 'mobile'),
    runPageSpeedTest(normalizedUrl, 'desktop'),
  ])

  return {
    mobile,
    desktop,
    testedAt: new Date().toISOString(),
  }
}

/* ── Findings generation from speed data ──────────────── */

export interface SpeedFinding {
  title: string
  description: string
  recommendation: string
  /** Specific, user/business-facing "why it matters" — never the generic fallback. */
  whyItMatters: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  /** Whether this can be fixed from the Fix Console */
  fixableFromConsole: boolean
  /** Performance metric this relates to */
  metricType: string
  /** Who should fix this */
  ownerTeam: 'engineering' | 'marketing'
}

/**
 * Principle-based impact per Core Web Vital / metric — used so EVERY speed
 * finding carries a concrete "why it matters" instead of the generic
 * "may affect how visitors experience your site" fallback. Works for any
 * diagnostic, mapped or not, on any site.
 */
export function speedImpact(metric: string): string {
  switch (metric) {
    case 'lcp':
      return 'Slows how quickly visitors see your main content appear. A slow load is one of the strongest predictors of people leaving before the page is usable, especially on mobile.'
    case 'tbt':
      return 'The browser is busy downloading and processing code, so the page looks ready but does not respond to taps or clicks yet — visitors perceive it as frozen or broken.'
    case 'inp':
      return 'Makes taps, clicks, and key presses feel laggy. When the interface does not respond instantly, visitors lose confidence and often give up mid-task.'
    case 'cls':
      return 'Content moves around as the page loads, causing visitors to mis-tap buttons or lose their place while reading — it reads as an unstable, low-quality site.'
    case 'ttfb':
      return 'Nothing can render until your server responds, so a slow first byte sets the floor for how fast the whole page can possibly feel.'
    default:
      return 'Adds avoidable weight and delay to every visit, making the site feel slower and costing bandwidth that mobile visitors pay for.'
  }
}

/**
 * Severity for a PageSpeed OPPORTUNITY / diagnostic (unused JS, render-blocking,
 * redirects, etc.). These are optimizations, not failures, so they are capped at
 * MEDIUM — never high/critical. Rationale (2026-06-14): PSI's estimated savingsMs
 * wobbles run-to-run with network variance; the old logic flipped a finding to
 * "high" when savings crossed 1000ms, which silently moved a site's score 7
 * points with no actual change (Unused JS medium→high tripped the 6-high cap).
 * Real, user-perceived performance FAILURES are the CWV-poor findings
 * (LCP/CLS/INP), which remain high and are threshold-bucketed (stable).
 */
export function opportunitySeverity(savingsMs?: number | null): 'medium' | 'low' {
  return savingsMs != null && savingsMs > 300 ? 'medium' : 'low'
}

/**
 * Map PageSpeed diagnostics to actionable speed findings.
 * Split into Category 1 (fixable from console) and Category 2 (advisory).
 */
export function generateSpeedFindings(speedData: SpeedData): SpeedFinding[] {
  const findings: SpeedFinding[] = []
  const result = speedData.mobile || speedData.desktop
  if (!result) return findings

  // ── Category 1: Fixable from console ──
  const fixableDiagnostics: Record<string, { title: string; desc: string; rec: string; why: string; metric: string }> = {
    'render-blocking-resources': {
      title: 'Render-blocking resources slowing page load',
      desc: 'CSS and JavaScript files that block page rendering are delaying when content becomes visible to users.',
      rec: 'Add async or defer attributes to non-critical scripts. Move critical CSS inline and load remaining stylesheets asynchronously.',
      why: 'Visitors stare at a blank or half-built page while these files download and run. Every extra second before content appears measurably increases the share of people who give up and leave, especially on mobile.',
      metric: 'lcp',
    },
    'uses-optimized-images': {
      title: 'Images not optimized for web',
      desc: 'Images are being served without proper compression, causing unnecessary bandwidth usage and slower load times.',
      rec: 'Convert images to WebP or AVIF format. Use quality settings of 75-85% for photographs. Ensure all images have explicit width and height attributes.',
      why: 'Oversized images are usually the single largest thing a visitor waits to download. They delay the first meaningful paint and, on mobile data, cost the visitor real money — both push impatient people away before the page is usable.',
      metric: 'lcp',
    },
    'unused-javascript': {
      title: 'Unused JavaScript loaded on page',
      desc: 'JavaScript code is being downloaded and parsed that is never executed on this page, wasting bandwidth and CPU time.',
      rec: 'Audit your JavaScript bundles with code coverage tools. Remove unused libraries, implement code-splitting, and defer non-critical scripts.',
      why: 'The browser still downloads, parses, and compiles this dead code before the page can respond to taps or clicks. On mid-range phones that is often seconds of avoidable delay during which the page looks ready but is not.',
      metric: 'tbt',
    },
    'unused-css-rules': {
      title: 'Unused CSS loaded on page',
      desc: 'CSS rules are being downloaded that do not match any elements on this page, adding unnecessary weight.',
      rec: 'Use PurgeCSS or similar tools to remove unused CSS. Consider splitting CSS per page or component.',
      why: 'This dead styling is downloaded and parsed on every single visit for no benefit, delaying the first paint and inflating page weight that visitors on slow or metered connections pay for.',
      metric: 'lcp',
    },
    'uses-long-cache-ttl': {
      title: 'Missing or short cache headers',
      desc: 'Static assets are not configured with long cache lifetimes, causing repeat visitors to re-download unchanged files.',
      rec: 'Set Cache-Control headers with max-age of at least 1 year for static assets (JS, CSS, images). Use content hashes in filenames for cache busting.',
      why: 'Returning visitors re-download files that never changed, so every repeat visit is needlessly slow and your bandwidth bill is higher than it needs to be. Proper caching makes the second visit feel near-instant.',
      metric: 'lcp',
    },
    'unminified-javascript': {
      title: 'Unminified JavaScript assets',
      desc: 'JavaScript files are served without minification, meaning they contain unnecessary whitespace, comments, and long variable names.',
      rec: 'Enable minification in your build pipeline (Terser, esbuild, or SWC). Ensure production builds strip source maps from public-facing assets.',
      why: 'The extra bytes are pure waste sent to every visitor on every visit, slowing download and parse time. Minification typically cuts script size 30-60% with zero functional change.',
      metric: 'tbt',
    },
    'offscreen-images': {
      title: 'Missing lazy loading on images',
      desc: 'Images below the fold are loaded immediately on page load instead of being deferred until the user scrolls to them.',
      rec: 'Add loading="lazy" to all images below the fold. Keep above-the-fold hero images eager-loaded for LCP.',
      why: 'Images the visitor may never scroll to are loaded up front, stealing bandwidth from the content they can actually see and delaying when the page becomes interactive.',
      metric: 'lcp',
    },
  }

  // ── Category 2: Advisory (non-code issues) ──
  const advisoryDiagnostics: Record<string, { title: string; desc: string; rec: string; why: string; metric: string }> = {
    'uses-responsive-images': {
      title: 'Images too large for display size',
      desc: 'Images are being served at dimensions larger than their display size, wasting bandwidth on unnecessary pixels.',
      rec: 'Serve images at the correct size using srcset and sizes attributes. Generate multiple image variants for different viewport widths.',
      why: 'Visitors download far more image data than their screen can display — wasted bandwidth that slows loading and costs mobile users money, with no visible gain in quality.',
      metric: 'lcp',
    },
    'third-party-summary': {
      title: 'Too many third-party scripts loaded',
      desc: 'Multiple third-party scripts (analytics, chat widgets, tracking pixels) are competing for network and CPU resources.',
      rec: 'Audit third-party scripts and remove any that are not actively providing value. Defer non-critical third-party scripts. Consider self-hosting critical third-party resources.',
      why: 'Each third-party script can block the main thread and delay interactivity. A single slow analytics or chat vendor can make your whole page feel sluggish even when your own code is fast.',
      metric: 'tbt',
    },
    'dom-size': {
      title: 'Excessive DOM size',
      desc: 'The page has an unusually large number of DOM elements, which slows down style calculations, layout, and paint operations.',
      rec: 'Simplify page structure. Use virtualization for long lists. Remove unnecessary wrapper elements. Consider paginating or lazy-loading content sections.',
      why: 'A bloated DOM makes every scroll, click, and animation more expensive to render, so the page feels janky and unresponsive — most noticeably on lower-powered phones.',
      metric: 'inp',
    },
    'server-response-time': {
      title: 'Slow server response time (TTFB)',
      desc: 'The server takes too long to respond to requests. This is typically a hosting infrastructure issue rather than a code issue.',
      rec: 'Investigate server-side rendering time, database query performance, and hosting tier. Consider upgrading hosting, adding a CDN, or implementing edge caching.',
      why: 'Nothing on the page can render until the server responds, so a slow first byte delays everything downstream — it sets the floor for how fast the page can possibly feel.',
      metric: 'ttfb',
    },
    'redirects': {
      title: 'Multiple redirects detected',
      desc: 'The page requires multiple redirects before reaching the final URL, adding network round-trip latency.',
      rec: 'Eliminate unnecessary redirects. Update internal links to point directly to final URLs. Use 301 redirects only when necessary.',
      why: 'Each redirect is a full network round-trip before the real page even starts loading, adding latency that is most painful on mobile networks.',
      metric: 'ttfb',
    },
  }

  for (const diag of result.diagnostics) {
    const fixable = fixableDiagnostics[diag.id]
    if (fixable) {
      const severity = opportunitySeverity(diag.savingsMs)
      findings.push({
        title: fixable.title,
        description: fixable.desc,
        recommendation: fixable.rec,
        whyItMatters: fixable.why,
        severity,
        fixableFromConsole: true,
        metricType: fixable.metric,
        ownerTeam: 'engineering',
      })
    }

    const advisory = advisoryDiagnostics[diag.id]
    if (advisory) {
      findings.push({
        title: advisory.title,
        description: advisory.desc,
        recommendation: advisory.rec,
        whyItMatters: advisory.why,
        severity: opportunitySeverity(diag.savingsMs),
        fixableFromConsole: false,
        metricType: advisory.metric,
        ownerTeam: diag.id === 'server-response-time' ? 'engineering' : 'engineering',
      })
    }
  }

  // Add CWV-specific findings if metrics are poor
  if (result.metrics.lcp.status === 'poor') {
    const exists = findings.some(f => f.metricType === 'lcp')
    if (!exists) {
      findings.push({
        title: 'Largest Contentful Paint is too slow',
        description: `LCP is ${result.metrics.lcp.displayValue}, well above the 2.5s threshold. Users perceive the page as slow to load.`,
        recommendation: 'Optimize the largest visible element (usually a hero image or heading). Preload critical resources, reduce server response time, and eliminate render-blocking resources.',
        whyItMatters: speedImpact('lcp'),
        severity: 'high',
        fixableFromConsole: false,
        metricType: 'lcp',
        ownerTeam: 'engineering',
      })
    }
  }

  if (result.metrics.cls.status === 'poor') {
    findings.push({
      title: 'Layout shift causing visual instability',
      description: `CLS is ${result.metrics.cls.displayValue}, above the 0.1 threshold. Elements are moving unexpectedly as the page loads, frustrating users.`,
      recommendation: 'Set explicit width and height on all images and embeds. Reserve space for dynamic content. Avoid inserting content above existing content after page load.',
      whyItMatters: speedImpact('cls'),
      severity: 'high',
      fixableFromConsole: true,
      metricType: 'cls',
      ownerTeam: 'engineering',
    })
  }

  if (result.metrics.inp.status === 'poor') {
    findings.push({
      title: 'Page interactions are sluggish',
      description: `INP is ${result.metrics.inp.displayValue}, above the 200ms threshold. User interactions (clicks, taps, key presses) feel delayed.`,
      recommendation: 'Break up long tasks on the main thread. Defer non-critical JavaScript. Use web workers for heavy computation. Reduce DOM size to speed up event handling.',
      whyItMatters: speedImpact('inp'),
      severity: 'high',
      fixableFromConsole: false,
      metricType: 'inp',
      ownerTeam: 'engineering',
    })
  }

  return findings
}
