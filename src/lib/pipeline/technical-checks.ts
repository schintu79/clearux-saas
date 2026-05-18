// ============================================================
// ClearUX Technical Checks
// ============================================================
// Lightweight HTML-based technical-health checks. Operates on raw
// HTML when available, with optional load-time and HTTP status hints
// from the crawler.
//
// The output shape is intentionally JSON-serialisable so it can be
// stored verbatim in `audit_pages.technical_audit` (jsonb) and
// rendered in the dashboard's "Technical health" tab.
// ============================================================

export interface TechnicalCheckInput {
  url: string
  html: string | null
  loadTimeMs?: number | null
  statusCode?: number | null
}

export interface TechnicalCheckResult {
  url: string
  performance: {
    loadTimeMs: number | null
    htmlBytes: number | null
    statusCode: number | null
    /** good (<1000ms), needs_improvement (1000-3000ms), slow (>3000ms), unknown */
    rating: 'good' | 'needs_improvement' | 'slow' | 'unknown'
  }
  images: {
    total: number
    missingAlt: number
    decorativeAlt: number
    samplesMissingAlt: string[]
  }
  headings: {
    h1Count: number
    h2Count: number
    h3Count: number
    h1Texts: string[]
    issues: string[]
  }
  accessibility: {
    hasLangAttribute: boolean
    hasViewportMeta: boolean
    hasMainLandmark: boolean
    hasSkipLink: boolean
    ariaLabelCount: number
    issues: string[]
  }
  links: {
    total: number
    internal: number
    external: number
    nofollow: number
    /** Anchors with empty/non-descriptive text (e.g. "click here"). */
    nonDescriptive: number
  }
}

const NON_DESCRIPTIVE_LINK_TEXT = new Set([
  'click here',
  'here',
  'read more',
  'more',
  'learn more',
  'this',
  'link',
])

function ratePerformance(ms: number | null | undefined): TechnicalCheckResult['performance']['rating'] {
  if (ms == null) return 'unknown'
  if (ms < 1000) return 'good'
  if (ms <= 3000) return 'needs_improvement'
  return 'slow'
}

function getAttr(tag: string, name: string): string | null {
  const re = new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"|\\s${name}\\s*=\\s*'([^']*)'`, 'i')
  const m = tag.match(re)
  if (!m) return null
  return (m[1] ?? m[2] ?? '').trim()
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function checkImages(html: string): TechnicalCheckResult['images'] {
  const imgRegex = /<img\b[^>]*>/gi
  const samples: string[] = []
  let total = 0
  let missingAlt = 0
  let decorativeAlt = 0
  let m: RegExpExecArray | null
  while ((m = imgRegex.exec(html)) !== null) {
    total++
    const tag = m[0]
    const alt = getAttr(tag, 'alt')
    if (alt === null) {
      missingAlt++
      const src = getAttr(tag, 'src')
      if (src && samples.length < 5) samples.push(src)
    } else if (alt === '') {
      decorativeAlt++
    }
  }
  return { total, missingAlt, decorativeAlt, samplesMissingAlt: samples }
}

function checkHeadings(html: string): TechnicalCheckResult['headings'] {
  const headingRegex = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi
  const order: number[] = []
  const h1Texts: string[] = []
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  let m: RegExpExecArray | null
  while ((m = headingRegex.exec(html)) !== null) {
    const level = parseInt(m[1], 10)
    counts[level]++
    order.push(level)
    if (level === 1) {
      const text = stripTags(m[2]).slice(0, 200)
      if (text) h1Texts.push(text)
    }
  }
  const issues: string[] = []
  if (counts[1] === 0) issues.push('Page has no <h1>')
  if (counts[1] > 1) issues.push(`Multiple <h1> tags (${counts[1]}) — search engines and assistive tech expect one main heading per page`)

  // Detect skipped heading levels (e.g. h1 → h3)
  for (let i = 1; i < order.length; i++) {
    const prev = order[i - 1]
    const cur = order[i]
    if (cur > prev + 1) {
      issues.push(`Heading hierarchy skips from h${prev} to h${cur}`)
      break
    }
  }

  return {
    h1Count: counts[1],
    h2Count: counts[2],
    h3Count: counts[3],
    h1Texts,
    issues,
  }
}

function checkAccessibility(html: string): TechnicalCheckResult['accessibility'] {
  const hasLangAttribute = /<html\b[^>]*\slang\s*=/i.test(html)
  const hasViewportMeta = /<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(html)
  const hasMainLandmark = /<main\b/i.test(html) || /role\s*=\s*["']main["']/i.test(html)
  const hasSkipLink = /href\s*=\s*["']#(?:main|content|main-content|skip)/i.test(html)
  const ariaMatches = html.match(/\saria-label\s*=/gi)
  const ariaLabelCount = ariaMatches ? ariaMatches.length : 0

  const issues: string[] = []
  if (!hasLangAttribute) issues.push('Missing `lang` attribute on <html>')
  if (!hasViewportMeta) issues.push('Missing viewport meta tag')
  if (!hasMainLandmark) issues.push('No <main> landmark detected')
  if (!hasSkipLink) issues.push('No skip-to-content link detected')

  return { hasLangAttribute, hasViewportMeta, hasMainLandmark, hasSkipLink, ariaLabelCount, issues }
}

function checkLinks(html: string, pageUrl: string): TechnicalCheckResult['links'] {
  let pageHost: string | null = null
  try { pageHost = new URL(pageUrl).hostname } catch { /* leave null */ }

  const anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
  let total = 0
  let internal = 0
  let external = 0
  let nofollow = 0
  let nonDescriptive = 0
  let m: RegExpExecArray | null
  while ((m = anchorRegex.exec(html)) !== null) {
    const attrs = m[1]
    const href = getAttr(`<a ${attrs}>`, 'href')
    if (!href) continue
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue
    total++
    const rel = getAttr(`<a ${attrs}>`, 'rel') || ''
    if (/\bnofollow\b/i.test(rel)) nofollow++

    let host: string | null = null
    try {
      host = href.startsWith('http') ? new URL(href).hostname : pageHost
    } catch { /* skip */ }

    if (pageHost && host && host.replace(/^www\./, '') === pageHost.replace(/^www\./, '')) {
      internal++
    } else if (host) {
      external++
    } else {
      internal++ // relative paths with no host info count as internal
    }

    const text = stripTags(m[2]).toLowerCase()
    if (!text || NON_DESCRIPTIVE_LINK_TEXT.has(text)) nonDescriptive++
  }
  return { total, internal, external, nofollow, nonDescriptive }
}

/**
 * Run the full suite of technical checks against a page's raw HTML.
 * Returns a JSON-serialisable structure suitable for persistence in jsonb.
 */
export function runTechnicalChecks(input: TechnicalCheckInput): TechnicalCheckResult {
  const html = input.html ?? ''
  const htmlBytes = html ? Buffer.byteLength(html, 'utf8') : null

  const performance: TechnicalCheckResult['performance'] = {
    loadTimeMs: input.loadTimeMs ?? null,
    htmlBytes,
    statusCode: input.statusCode ?? null,
    rating: ratePerformance(input.loadTimeMs),
  }

  if (!html) {
    return {
      url: input.url,
      performance,
      images: { total: 0, missingAlt: 0, decorativeAlt: 0, samplesMissingAlt: [] },
      headings: { h1Count: 0, h2Count: 0, h3Count: 0, h1Texts: [], issues: ['No raw HTML available — checks skipped'] },
      accessibility: {
        hasLangAttribute: false,
        hasViewportMeta: false,
        hasMainLandmark: false,
        hasSkipLink: false,
        ariaLabelCount: 0,
        issues: ['No raw HTML available — accessibility checks skipped'],
      },
      links: { total: 0, internal: 0, external: 0, nofollow: 0, nonDescriptive: 0 },
    }
  }

  return {
    url: input.url,
    performance,
    images: checkImages(html),
    headings: checkHeadings(html),
    accessibility: checkAccessibility(html),
    links: checkLinks(html, input.url),
  }
}

/**
 * Compact text summary for inclusion in the LLM analyzer prompt.
 * Keeps the prompt cheap while still surfacing the most actionable facts.
 */
export function formatTechnicalAuditForPrompt(result: TechnicalCheckResult): string {
  const lines: string[] = []
  lines.push(`URL: ${result.url}`)
  const perf = result.performance
  if (perf.loadTimeMs != null) {
    lines.push(`Load time: ${perf.loadTimeMs}ms (${perf.rating})`)
  } else {
    lines.push('Load time: not measured')
  }
  if (perf.htmlBytes != null) lines.push(`HTML size: ${perf.htmlBytes} bytes`)
  if (perf.statusCode != null) lines.push(`HTTP status: ${perf.statusCode}`)

  lines.push(
    `Images: ${result.images.total} total, ${result.images.missingAlt} missing alt, ${result.images.decorativeAlt} decorative`,
  )
  lines.push(
    `Headings: h1=${result.headings.h1Count}, h2=${result.headings.h2Count}, h3=${result.headings.h3Count}`,
  )
  if (result.headings.issues.length > 0) {
    lines.push(`Heading issues: ${result.headings.issues.join('; ')}`)
  }

  const a11y = result.accessibility
  lines.push(
    `Accessibility: lang=${a11y.hasLangAttribute}, viewport=${a11y.hasViewportMeta}, main=${a11y.hasMainLandmark}, skipLink=${a11y.hasSkipLink}, aria-labels=${a11y.ariaLabelCount}`,
  )
  if (a11y.issues.length > 0) lines.push(`A11y issues: ${a11y.issues.join('; ')}`)

  lines.push(
    `Links: ${result.links.total} total (${result.links.internal} internal, ${result.links.external} external, ${result.links.nofollow} nofollow, ${result.links.nonDescriptive} non-descriptive)`,
  )

  return lines.join('\n')
}
