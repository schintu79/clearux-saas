/**
 * Google PageSpeed Insights API client
 *
 * Fetches real Core Web Vitals and performance scores for a URL
 * using the PageSpeed Insights API (free tier, key-based).
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

export interface PageSpeedResult {
  /** Overall performance score 0-100 */
  score: number
  /** Strategy used for this test */
  strategy: 'mobile' | 'desktop'
  /** Core Web Vitals */
  metrics: {
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
    lcp: [2500, 4000],           // ms
    cls: [0.1, 0.25],            // unitless
    inp: [200, 500],             // ms
    ttfb: [800, 1800],           // ms
    speedIndex: [3400, 5800],    // ms
    tbt: [200, 600],             // ms
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

  const categories = lighthouse.categories || {}
  const audits = lighthouse.audits || {}
  const score = Math.round((categories?.performance?.score ?? 0) * 100)

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

  return {
    score,
    strategy,
    metrics,
    diagnostics,
    finalUrl: data?.id || '',
    testedAt: new Date().toISOString(),
  }
}

/* ── Public API ───────────────────────────────────────── */

/**
 * Run a PageSpeed test for a single strategy (mobile or desktop).
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
    category: 'performance',
  })
  if (apiKey) params.set('key', apiKey)

  try {
    const res = await fetch(`${PSI_ENDPOINT}?${params.toString()}`, {
      signal: AbortSignal.timeout(30000), // 30s timeout
    })
    if (!res.ok) {
      console.warn(`[pagespeed] API returned ${res.status} for ${url} (${strategy})`)
      return null
    }
    const data = await res.json()
    return parseResponse(data, strategy)
  } catch (err) {
    console.warn(`[pagespeed] Error fetching ${strategy} for ${url}:`, err)
    return null
  }
}

/**
 * Run PageSpeed tests for both mobile and desktop.
 * Returns a SpeedData object suitable for storing on the audit record.
 */
export async function runFullSpeedTest(url: string): Promise<SpeedData> {
  const [mobile, desktop] = await Promise.all([
    runPageSpeedTest(url, 'mobile'),
    runPageSpeedTest(url, 'desktop'),
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
  severity: 'critical' | 'high' | 'medium' | 'low'
  /** Whether this can be fixed from the Fix Console */
  fixableFromConsole: boolean
  /** Performance metric this relates to */
  metricType: string
  /** Who should fix this */
  ownerTeam: 'engineering' | 'marketing'
}

/**
 * Map PageSpeed diagnostics to actionable speed findings.
 * Split into Category 1 (fixable from console) and Category 2 (advisory).
 */
export function generateSpeedFindings(speedData: SpeedData): SpeedFinding[] {
  const findings: SpeedFinding[] = []
  const result = speedData.mobile || speedData.desktop
  if (!result) return findings

  // Determine base severity from overall score
  const baseSeverity = (score: number): 'critical' | 'high' | 'medium' | 'low' => {
    if (score < 30) return 'critical'
    if (score < 50) return 'high'
    if (score < 90) return 'medium'
    return 'low'
  }

  // ── Category 1: Fixable from console ──
  const fixableDiagnostics: Record<string, { title: string; desc: string; rec: string; metric: string }> = {
    'render-blocking-resources': {
      title: 'Render-blocking resources slowing page load',
      desc: 'CSS and JavaScript files that block page rendering are delaying when content becomes visible to users.',
      rec: 'Add async or defer attributes to non-critical scripts. Move critical CSS inline and load remaining stylesheets asynchronously.',
      metric: 'lcp',
    },
    'uses-optimized-images': {
      title: 'Images not optimized for web',
      desc: 'Images are being served without proper compression, causing unnecessary bandwidth usage and slower load times.',
      rec: 'Convert images to WebP or AVIF format. Use quality settings of 75-85% for photographs. Ensure all images have explicit width and height attributes.',
      metric: 'lcp',
    },
    'unused-javascript': {
      title: 'Unused JavaScript loaded on page',
      desc: 'JavaScript code is being downloaded and parsed that is never executed on this page, wasting bandwidth and CPU time.',
      rec: 'Audit your JavaScript bundles with code coverage tools. Remove unused libraries, implement code-splitting, and defer non-critical scripts.',
      metric: 'tbt',
    },
    'unused-css-rules': {
      title: 'Unused CSS loaded on page',
      desc: 'CSS rules are being downloaded that do not match any elements on this page, adding unnecessary weight.',
      rec: 'Use PurgeCSS or similar tools to remove unused CSS. Consider splitting CSS per page or component.',
      metric: 'lcp',
    },
    'uses-long-cache-ttl': {
      title: 'Missing or short cache headers',
      desc: 'Static assets are not configured with long cache lifetimes, causing repeat visitors to re-download unchanged files.',
      rec: 'Set Cache-Control headers with max-age of at least 1 year for static assets (JS, CSS, images). Use content hashes in filenames for cache busting.',
      metric: 'lcp',
    },
    'unminified-javascript': {
      title: 'Unminified JavaScript assets',
      desc: 'JavaScript files are served without minification, meaning they contain unnecessary whitespace, comments, and long variable names.',
      rec: 'Enable minification in your build pipeline (Terser, esbuild, or SWC). Ensure production builds strip source maps from public-facing assets.',
      metric: 'tbt',
    },
    'offscreen-images': {
      title: 'Missing lazy loading on images',
      desc: 'Images below the fold are loaded immediately on page load instead of being deferred until the user scrolls to them.',
      rec: 'Add loading="lazy" to all images below the fold. Keep above-the-fold hero images eager-loaded for LCP.',
      metric: 'lcp',
    },
  }

  // ── Category 2: Advisory (non-code issues) ──
  const advisoryDiagnostics: Record<string, { title: string; desc: string; rec: string; metric: string }> = {
    'uses-responsive-images': {
      title: 'Images too large for display size',
      desc: 'Images are being served at dimensions larger than their display size, wasting bandwidth on unnecessary pixels.',
      rec: 'Serve images at the correct size using srcset and sizes attributes. Generate multiple image variants for different viewport widths.',
      metric: 'lcp',
    },
    'third-party-summary': {
      title: 'Too many third-party scripts loaded',
      desc: 'Multiple third-party scripts (analytics, chat widgets, tracking pixels) are competing for network and CPU resources.',
      rec: 'Audit third-party scripts and remove any that are not actively providing value. Defer non-critical third-party scripts. Consider self-hosting critical third-party resources.',
      metric: 'tbt',
    },
    'dom-size': {
      title: 'Excessive DOM size',
      desc: 'The page has an unusually large number of DOM elements, which slows down style calculations, layout, and paint operations.',
      rec: 'Simplify page structure. Use virtualization for long lists. Remove unnecessary wrapper elements. Consider paginating or lazy-loading content sections.',
      metric: 'inp',
    },
    'server-response-time': {
      title: 'Slow server response time (TTFB)',
      desc: 'The server takes too long to respond to requests. This is typically a hosting infrastructure issue rather than a code issue.',
      rec: 'Investigate server-side rendering time, database query performance, and hosting tier. Consider upgrading hosting, adding a CDN, or implementing edge caching.',
      metric: 'ttfb',
    },
    'redirects': {
      title: 'Multiple redirects detected',
      desc: 'The page requires multiple redirects before reaching the final URL, adding network round-trip latency.',
      rec: 'Eliminate unnecessary redirects. Update internal links to point directly to final URLs. Use 301 redirects only when necessary.',
      metric: 'ttfb',
    },
  }

  for (const diag of result.diagnostics) {
    const fixable = fixableDiagnostics[diag.id]
    if (fixable) {
      const severity = diag.savingsMs && diag.savingsMs > 1000
        ? 'high'
        : diag.savingsMs && diag.savingsMs > 300
          ? 'medium'
          : baseSeverity(result.score)
      findings.push({
        title: fixable.title,
        description: fixable.desc,
        recommendation: fixable.rec,
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
        severity: baseSeverity(result.score),
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
      severity: 'high',
      fixableFromConsole: false,
      metricType: 'inp',
      ownerTeam: 'engineering',
    })
  }

  return findings
}
