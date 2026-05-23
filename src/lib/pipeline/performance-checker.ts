// ============================================================
// ClearUX Performance Checker
// ============================================================
// Extracts page-level performance metrics from raw HTML and
// aggregates them into a site-level performance summary.
//
// Builds on top of the existing technical-checks.ts infrastructure
// but focuses specifically on Core Web Vitals estimates, resource
// weight, render-blocking analysis, and third-party script detection.
//
// All estimates are heuristic-based (no real browser rendering) —
// the goal is directional accuracy for audit recommendations,
// not Lighthouse-grade measurement.
// ============================================================

import type { PagePerformanceData, PerformanceSummary } from '@/types/database'

// ── Known third-party domains ──────────────────────────────

const THIRD_PARTY_PATTERNS = [
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /googlesyndication\.com/i,
  /googleadservices\.com/i,
  /doubleclick\.net/i,
  /facebook\.net/i,
  /connect\.facebook\.com/i,
  /fbcdn\.net/i,
  /twitter\.com\/.*\.js/i,
  /platform\.twitter\.com/i,
  /cdn\.syndication\.twimg/i,
  /snap\.licdn\.com/i,
  /linkedin\.com/i,
  /pinterest\.com/i,
  /tiktok\.com/i,
  /hotjar\.com/i,
  /clarity\.ms/i,
  /segment\.io/i,
  /segment\.com/i,
  /amplitude\.com/i,
  /mixpanel\.com/i,
  /intercom\.io/i,
  /crisp\.chat/i,
  /drift\.com/i,
  /hubspot\.com/i,
  /hs-scripts\.com/i,
  /hs-analytics\.net/i,
  /marketo\.net/i,
  /mktoresp\.com/i,
  /optimizely\.com/i,
  /adobedtm\.com/i,
  /typekit\.net/i,
  /fonts\.googleapis\.com/i,
  /fonts\.gstatic\.com/i,
  /cdn\.jsdelivr\.net/i,
  /cdnjs\.cloudflare\.com/i,
  /unpkg\.com/i,
  /sentry\.io/i,
  /bugsnag\.com/i,
  /newrelic\.com/i,
  /datadoghq\.com/i,
  /stripe\.com/i,
  /js\.stripe\.com/i,
  /recaptcha.*google/i,
  /hcaptcha\.com/i,
  /cookiebot\.com/i,
  /onetrust\.com/i,
  /cookielaw\.org/i,
  /youtube\.com/i,
  /vimeo\.com/i,
  /wistia\.com/i,
  /player\.vimeo\.com/i,
  /maps\.googleapis\.com/i,
  /cloudflare\.com\/cdn-cgi/i,
  /wp\.com/i,
  /stats\.wp\.com/i,
  /pixel\.wp\.com/i,
  /shopify\.com/i,
  /cdn\.shopify\.com/i,
  /zendesk\.com/i,
  /tawk\.to/i,
  /livechatinc\.com/i,
  /olark\.com/i,
  /zopim\.com/i,
]

// ── Helper to get attribute from tag ───────────────────────

function getAttr(tag: string, name: string): string | null {
  const re = new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"|\\s${name}\\s*=\\s*'([^']*)'`, 'i')
  const m = tag.match(re)
  if (!m) return null
  return (m[1] ?? m[2] ?? '').trim()
}

// ── Core performance extraction ────────────────────────────

export interface PerformanceCheckInput {
  url: string
  html: string | null
  loadTimeMs?: number | null
}

/**
 * Extract performance metrics from a page's raw HTML.
 * All values are heuristic estimates — no browser rendering.
 */
export function extractPerformanceData(input: PerformanceCheckInput): PagePerformanceData {
  const html = input.html ?? ''
  const pageWeightBytes = html ? Buffer.byteLength(html, 'utf8') : 0
  const pageWeightKb = Math.round(pageWeightBytes / 1024)

  if (!html) {
    return {
      lcp_estimate_ms: null,
      inp_estimate_ms: null,
      cls_estimate: null,
      page_weight_kb: 0,
      script_count: 0,
      script_weight_kb: 0,
      render_blocking_scripts: 0,
      image_count: 0,
      image_weight_kb: 0,
      images_missing_dimensions: 0,
      images_not_lazy: 0,
      third_party_count: 0,
      third_party_domains: [],
      css_count: 0,
      font_count: 0,
      rating: 'good',
    }
  }

  // ── Scripts ──────────────────────────────────────────────
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  let scriptCount = 0
  let scriptWeightBytes = 0
  let renderBlockingScripts = 0
  const thirdPartyDomains = new Set<string>()
  let m: RegExpExecArray | null

  while ((m = scriptRegex.exec(html)) !== null) {
    scriptCount++
    const attrs = m[1]
    const inlineContent = m[2]

    // Inline script weight
    if (inlineContent && inlineContent.trim().length > 0) {
      scriptWeightBytes += Buffer.byteLength(inlineContent, 'utf8')
    }

    // Check if render-blocking (no async or defer attribute)
    const hasAsync = /\basync\b/i.test(attrs)
    const hasDefer = /\bdefer\b/i.test(attrs)
    const hasType = getAttr(`<script ${attrs}>`, 'type')
    const isModule = hasType === 'module'
    const isJson = hasType === 'application/json' || hasType === 'application/ld+json'

    if (!hasAsync && !hasDefer && !isModule && !isJson) {
      renderBlockingScripts++
    }

    // Third-party detection
    const src = getAttr(`<script ${attrs}>`, 'src')
    if (src) {
      try {
        const srcUrl = src.startsWith('//') ? `https:${src}` : src
        if (srcUrl.startsWith('http')) {
          const domain = new URL(srcUrl).hostname
          // Check against known third-party patterns
          for (const pattern of THIRD_PARTY_PATTERNS) {
            if (pattern.test(srcUrl)) {
              thirdPartyDomains.add(domain)
              break
            }
          }
        }
      } catch { /* invalid URL — skip */ }
    }
  }

  // Also check inline scripts for third-party patterns (e.g. GTM inline snippets)
  // Already counted above

  // ── Images ─────────────────────────────────────────────
  const imgRegex = /<img\b[^>]*>/gi
  let imageCount = 0
  let imagesMissingDimensions = 0
  let imagesNotLazy = 0

  while ((m = imgRegex.exec(html)) !== null) {
    imageCount++
    const tag = m[0]
    const width = getAttr(tag, 'width')
    const height = getAttr(tag, 'height')
    if (!width || !height) {
      imagesMissingDimensions++
    }
    const loading = getAttr(tag, 'loading')
    if (loading !== 'lazy') {
      imagesNotLazy++
    }
  }

  // Estimate image weight: we can't know actual file sizes from HTML,
  // so we use a rough heuristic based on image count
  // Average web image is ~50-100KB, but we're conservative
  const imageWeightKb = imageCount * 75 // rough estimate

  // ── CSS ────────────────────────────────────────────────
  const cssLinkRegex = /<link\b[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi
  let cssCount = 0
  while (cssLinkRegex.exec(html) !== null) {
    cssCount++
  }

  // Also count inline <style> blocks
  const styleRegex = /<style\b[^>]*>[\s\S]*?<\/style>/gi
  while (styleRegex.exec(html) !== null) {
    cssCount++
  }

  // ── Fonts ──────────────────────────────────────────────
  const fontRegex = /<link\b[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com|typekit\.net)[^>]*>/gi
  let fontCount = 0
  while (fontRegex.exec(html) !== null) {
    fontCount++
  }

  // Also count @font-face declarations
  const fontFaceRegex = /@font-face\s*\{/gi
  while (fontFaceRegex.exec(html) !== null) {
    fontCount++
  }

  // ── Third-party from link/iframe tags too ──────────────
  const linkSrcRegex = /<(?:link|iframe)\b[^>]*(?:href|src)\s*=\s*["']([^"']+)["'][^>]*>/gi
  while ((m = linkSrcRegex.exec(html)) !== null) {
    const href = m[1]
    try {
      const hrefUrl = href.startsWith('//') ? `https:${href}` : href
      if (hrefUrl.startsWith('http')) {
        const domain = new URL(hrefUrl).hostname
        for (const pattern of THIRD_PARTY_PATTERNS) {
          if (pattern.test(hrefUrl)) {
            thirdPartyDomains.add(domain)
            break
          }
        }
      }
    } catch { /* skip */ }
  }

  const thirdPartyDomainsArr = [...thirdPartyDomains].sort()
  const scriptWeightKb = Math.round(scriptWeightBytes / 1024)

  // ── CWV Estimates (heuristic) ─────────────────────────
  // LCP estimate: based on load time, page weight, and blocking resources
  const lcpEstimate = estimateLcp(input.loadTimeMs, pageWeightKb, renderBlockingScripts, imageCount)

  // INP estimate: based on script count and inline script weight
  const inpEstimate = estimateInp(scriptCount, scriptWeightKb, thirdPartyDomainsArr.length)

  // CLS estimate: based on images missing dimensions and lazy loading
  const clsEstimate = estimateCls(imagesMissingDimensions, imageCount, fontCount)

  // ── Overall rating ────────────────────────────────────
  const rating = computeRating(lcpEstimate, inpEstimate, clsEstimate, pageWeightKb, renderBlockingScripts)

  return {
    lcp_estimate_ms: lcpEstimate,
    inp_estimate_ms: inpEstimate,
    cls_estimate: clsEstimate,
    page_weight_kb: pageWeightKb,
    script_count: scriptCount,
    script_weight_kb: scriptWeightKb,
    render_blocking_scripts: renderBlockingScripts,
    image_count: imageCount,
    image_weight_kb: imageWeightKb,
    images_missing_dimensions: imagesMissingDimensions,
    images_not_lazy: imagesNotLazy,
    third_party_count: thirdPartyDomainsArr.length,
    third_party_domains: thirdPartyDomainsArr,
    css_count: cssCount,
    font_count: fontCount,
    rating,
  }
}

// ── CWV heuristic estimators ───────────────────────────────

function estimateLcp(
  loadTimeMs: number | null | undefined,
  pageWeightKb: number,
  blockingScripts: number,
  imageCount: number,
): number | null {
  // If we have actual load time, use it as base with adjustments
  if (loadTimeMs != null && loadTimeMs > 0) {
    // LCP is typically 50-80% of total page load for well-built sites
    let estimate = loadTimeMs * 0.7
    // Penalty for blocking scripts (each adds ~100-200ms to render)
    estimate += blockingScripts * 150
    // Heavy pages load slower
    if (pageWeightKb > 500) estimate *= 1.1
    if (pageWeightKb > 1000) estimate *= 1.2
    return Math.round(estimate)
  }

  // Without load time, estimate from page characteristics
  // Base: 1500ms for a typical page
  let estimate = 1500
  estimate += pageWeightKb * 0.5 // 0.5ms per KB
  estimate += blockingScripts * 200
  estimate += imageCount * 30
  return Math.round(estimate)
}

function estimateInp(
  scriptCount: number,
  scriptWeightKb: number,
  thirdPartyCount: number,
): number | null {
  // INP is about interaction responsiveness — more JS = worse INP
  // Base: 100ms for a lean page
  let estimate = 100
  estimate += scriptCount * 15 // each script adds overhead
  estimate += scriptWeightKb * 0.3 // inline JS weight
  estimate += thirdPartyCount * 30 // third-party scripts compete for main thread
  return Math.round(Math.min(estimate, 1500)) // cap at 1500ms
}

function estimateCls(
  imagesMissingDimensions: number,
  totalImages: number,
  fontCount: number,
): number {
  // CLS from images without dimensions
  let cls = 0
  if (totalImages > 0 && imagesMissingDimensions > 0) {
    // Each image without dimensions can cause ~0.05-0.15 layout shift
    cls += imagesMissingDimensions * 0.08
  }
  // Web fonts can cause FOIT/FOUT layout shift
  if (fontCount > 0) {
    cls += fontCount * 0.02
  }
  return Math.round(cls * 100) / 100 // 2 decimal places
}

function computeRating(
  lcpMs: number | null,
  inpMs: number | null,
  cls: number | null,
  pageWeightKb: number,
  blockingScripts: number,
): PagePerformanceData['rating'] {
  let poorSignals = 0
  let needsImprovementSignals = 0

  // LCP thresholds (Google: good <2.5s, poor >4s)
  if (lcpMs != null) {
    if (lcpMs > 4000) poorSignals++
    else if (lcpMs > 2500) needsImprovementSignals++
  }

  // INP thresholds (Google: good <200ms, poor >500ms)
  if (inpMs != null) {
    if (inpMs > 500) poorSignals++
    else if (inpMs > 200) needsImprovementSignals++
  }

  // CLS thresholds (Google: good <0.1, poor >0.25)
  if (cls != null) {
    if (cls > 0.25) poorSignals++
    else if (cls > 0.1) needsImprovementSignals++
  }

  // Page weight (>2MB is heavy)
  if (pageWeightKb > 2000) poorSignals++
  else if (pageWeightKb > 1000) needsImprovementSignals++

  // Blocking scripts
  if (blockingScripts > 5) poorSignals++
  else if (blockingScripts > 2) needsImprovementSignals++

  if (poorSignals >= 2) return 'poor'
  if (poorSignals >= 1 || needsImprovementSignals >= 2) return 'needs_improvement'
  return 'good'
}

// ── Site-level aggregation ─────────────────────────────────

/**
 * Aggregate page-level performance data into a site-level summary.
 */
export function aggregatePerformanceSummary(pages: PagePerformanceData[]): PerformanceSummary {
  if (pages.length === 0) {
    return {
      pages_analyzed: 0,
      avg_lcp_ms: null,
      avg_inp_ms: null,
      avg_cls: null,
      avg_page_weight_kb: 0,
      unique_third_party_domains: [],
      pages_with_blocking_scripts: 0,
      pages_with_layout_shift_risk: 0,
      pages_poor: 0,
      pages_needs_improvement: 0,
      pages_good: 0,
      overall_rating: 'good',
      top_concerns: [],
    }
  }

  // Averages
  const lcpValues = pages.map(p => p.lcp_estimate_ms).filter((v): v is number => v != null)
  const inpValues = pages.map(p => p.inp_estimate_ms).filter((v): v is number => v != null)
  const clsValues = pages.map(p => p.cls_estimate).filter((v): v is number => v != null)

  const avgLcp = lcpValues.length > 0 ? Math.round(lcpValues.reduce((a, b) => a + b, 0) / lcpValues.length) : null
  const avgInp = inpValues.length > 0 ? Math.round(inpValues.reduce((a, b) => a + b, 0) / inpValues.length) : null
  const avgCls = clsValues.length > 0 ? Math.round((clsValues.reduce((a, b) => a + b, 0) / clsValues.length) * 100) / 100 : null
  const avgPageWeight = Math.round(pages.reduce((a, p) => a + p.page_weight_kb, 0) / pages.length)

  // Unique third-party domains
  const allDomains = new Set<string>()
  for (const p of pages) {
    for (const d of p.third_party_domains) allDomains.add(d)
  }

  // Counts
  const pagesWithBlockingScripts = pages.filter(p => p.render_blocking_scripts > 0).length
  const pagesWithLayoutShiftRisk = pages.filter(p => p.images_missing_dimensions > 0 || (p.cls_estimate != null && p.cls_estimate > 0.1)).length
  const pagesPoor = pages.filter(p => p.rating === 'poor').length
  const pagesNeedsImprovement = pages.filter(p => p.rating === 'needs_improvement').length
  const pagesGood = pages.filter(p => p.rating === 'good').length

  // Overall rating
  let overallRating: PerformanceSummary['overall_rating'] = 'good'
  if (pagesPoor > pages.length * 0.3) overallRating = 'poor'
  else if (pagesPoor > 0 || pagesNeedsImprovement > pages.length * 0.4) overallRating = 'needs_improvement'

  // Top concerns (plain language)
  const concerns: string[] = []

  if (avgLcp != null && avgLcp > 2500) {
    concerns.push(avgLcp > 4000
      ? `Slow loading across the site (avg ${(avgLcp / 1000).toFixed(1)}s) — visitors may leave before content appears`
      : `Loading could be faster (avg ${(avgLcp / 1000).toFixed(1)}s) — aim for under 2.5s`
    )
  }

  if (avgPageWeight > 1000) {
    concerns.push(`Heavy pages (avg ${Math.round(avgPageWeight)}KB) — large downloads slow mobile users`)
  }

  const totalBlockingScripts = pages.reduce((a, p) => a + p.render_blocking_scripts, 0)
  if (totalBlockingScripts > pages.length * 2) {
    concerns.push(`Render-blocking scripts on ${pagesWithBlockingScripts} of ${pages.length} pages — delays visible content`)
  }

  if (allDomains.size > 5) {
    concerns.push(`${allDomains.size} third-party services detected — each adds network requests and potential delays`)
  }

  if (pagesWithLayoutShiftRisk > pages.length * 0.3) {
    concerns.push(`Layout shift risk on ${pagesWithLayoutShiftRisk} pages — content may jump around while loading`)
  }

  const totalImagesNotLazy = pages.reduce((a, p) => a + p.images_not_lazy, 0)
  const totalImages = pages.reduce((a, p) => a + p.image_count, 0)
  if (totalImages > 0 && totalImagesNotLazy > totalImages * 0.5) {
    concerns.push(`Most images load eagerly — lazy loading offscreen images would speed up initial render`)
  }

  if (avgInp != null && avgInp > 200) {
    concerns.push(avgInp > 500
      ? `Heavy JavaScript may cause sluggish interactions`
      : `Interaction responsiveness could be improved — scripts add main-thread work`
    )
  }

  return {
    pages_analyzed: pages.length,
    avg_lcp_ms: avgLcp,
    avg_inp_ms: avgInp,
    avg_cls: avgCls,
    avg_page_weight_kb: avgPageWeight,
    unique_third_party_domains: [...allDomains].sort(),
    pages_with_blocking_scripts: pagesWithBlockingScripts,
    pages_with_layout_shift_risk: pagesWithLayoutShiftRisk,
    pages_poor: pagesPoor,
    pages_needs_improvement: pagesNeedsImprovement,
    pages_good: pagesGood,
    overall_rating: overallRating,
    top_concerns: concerns,
  }
}

// ── Performance findings generator ─────────────────────────

export interface PerformanceFinding {
  title: string
  description: string
  recommendation: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  performance_metric_type: string
  owner_team: 'engineering' | 'marketing' | 'product' | 'design'
  estimated_impact: string
  /** Which pages this finding affects */
  affected_pages: string[]
  /** Why this matters in business terms */
  why_it_matters: string
  /** Who should fix it */
  who_should_fix: string
}

/**
 * Generate actionable performance findings from site-level data.
 * Each finding includes plain-language framing, owner guidance,
 * and business impact language.
 */
export function generatePerformanceFindings(
  summary: PerformanceSummary,
  pageData: Array<{ url: string; perf: PagePerformanceData }>,
): PerformanceFinding[] {
  const findings: PerformanceFinding[] = []

  // ── LCP: Slow loading on key pages ───────────────────────
  if (summary.avg_lcp_ms != null && summary.avg_lcp_ms > 2500) {
    const slowPages = pageData
      .filter(p => p.perf.lcp_estimate_ms != null && p.perf.lcp_estimate_ms > 2500)
      .map(p => p.url)
    const severity = summary.avg_lcp_ms > 4000 ? 'critical' as const : 'high' as const
    findings.push({
      title: 'Slow page loading affects user experience',
      description: `Pages take an estimated ${(summary.avg_lcp_ms / 1000).toFixed(1)} seconds on average before the main content becomes visible. Google recommends under 2.5 seconds. ${slowPages.length} page${slowPages.length !== 1 ? 's' : ''} exceed${slowPages.length === 1 ? 's' : ''} this threshold.`,
      recommendation: 'Reduce render-blocking resources, optimize images with modern formats (WebP/AVIF), implement critical CSS inlining, and consider a CDN for faster delivery.',
      severity,
      performance_metric_type: 'lcp',
      owner_team: 'engineering',
      estimated_impact: 'Each additional second of load time can reduce conversions by up to 7%.',
      affected_pages: slowPages.slice(0, 10),
      why_it_matters: 'Slow loading drives visitors away before they see your content. Mobile users on slower connections are hit hardest.',
      who_should_fix: 'Engineering team — requires changes to resource loading, image optimization, and server configuration.',
    })
  }

  // ── Render-blocking scripts ──────────────────────────────
  const totalBlocking = pageData.reduce((a, p) => a + p.perf.render_blocking_scripts, 0)
  if (totalBlocking > 0 && summary.pages_with_blocking_scripts > 0) {
    const affectedPages = pageData
      .filter(p => p.perf.render_blocking_scripts > 0)
      .map(p => p.url)
    findings.push({
      title: 'Render-blocking scripts delay visible content',
      description: `${totalBlocking} script${totalBlocking !== 1 ? 's' : ''} across ${summary.pages_with_blocking_scripts} page${summary.pages_with_blocking_scripts !== 1 ? 's' : ''} block the browser from rendering content until they finish loading. This means visitors see a blank page while scripts download.`,
      recommendation: 'Add `async` or `defer` attributes to non-critical scripts. Move analytics and tracking scripts to load after the page is visible. Consider lazy-loading third-party widgets.',
      severity: totalBlocking > summary.pages_analyzed * 3 ? 'high' : 'medium',
      performance_metric_type: 'render_blocking',
      owner_team: 'engineering',
      estimated_impact: 'Each render-blocking script can add 100-300ms to the time before visitors see content.',
      affected_pages: affectedPages.slice(0, 10),
      why_it_matters: 'Blocking scripts create a blank-page experience that increases bounce rates, especially on mobile.',
      who_should_fix: 'Engineering team — requires adding async/defer attributes and restructuring script loading order.',
    })
  }

  // ── Third-party script overload ──────────────────────────
  const thirdPartyCount = summary.unique_third_party_domains?.length ?? 0
  if (thirdPartyCount > 5) {
    findings.push({
      title: 'Too many third-party services slow your site',
      description: `${thirdPartyCount} different third-party services detected across your pages. Each adds network requests, DNS lookups, and JavaScript execution that compete with your content for loading priority.`,
      recommendation: 'Audit which third-party scripts are essential. Remove unused analytics/tracking. Consider self-hosting critical third-party resources. Use resource hints (preconnect, dns-prefetch) for remaining third-party domains.',
      severity: thirdPartyCount > 10 ? 'high' : 'medium',
      performance_metric_type: 'third_party',
      owner_team: 'marketing',
      estimated_impact: 'Third-party scripts can account for 30-50% of total page load time on content-heavy sites.',
      affected_pages: pageData.filter(p => p.perf.third_party_count > 3).map(p => p.url).slice(0, 10),
      why_it_matters: 'Each third-party service is a point of failure. If one service is slow, your entire page feels slow.',
      who_should_fix: 'Marketing team (for analytics/tracking decisions) with engineering support for implementation.',
    })
  }

  // ── Layout shift risk ────────────────────────────────────
  const totalMissingDims = pageData.reduce((a, p) => a + p.perf.images_missing_dimensions, 0)
  if (totalMissingDims > 0) {
    const affectedPages = pageData
      .filter(p => p.perf.images_missing_dimensions > 0)
      .map(p => p.url)
    findings.push({
      title: 'Images without dimensions cause content to jump',
      description: `${totalMissingDims} image${totalMissingDims !== 1 ? 's' : ''} across ${affectedPages.length} page${affectedPages.length !== 1 ? 's' : ''} are missing width and height attributes. When these images load, surrounding content shifts position, which is disorienting for users trying to read or click.`,
      recommendation: 'Add explicit `width` and `height` attributes to all `<img>` tags. Use CSS `aspect-ratio` for responsive images. This lets browsers reserve the correct space before images load.',
      severity: totalMissingDims > 10 ? 'medium' : 'low',
      performance_metric_type: 'cls',
      owner_team: 'design',
      estimated_impact: 'Layout shift is one of Google\'s Core Web Vitals and directly affects search ranking.',
      affected_pages: affectedPages.slice(0, 10),
      why_it_matters: 'Content that jumps around while loading makes pages feel broken and can cause accidental clicks on the wrong element.',
      who_should_fix: 'Design and engineering — designers set image dimensions in templates, engineers add attributes in code.',
    })
  }

  // ── Images not using lazy loading ────────────────────────
  const totalNotLazy = pageData.reduce((a, p) => a + p.perf.images_not_lazy, 0)
  const totalImages = pageData.reduce((a, p) => a + p.perf.image_count, 0)
  if (totalImages > 5 && totalNotLazy > totalImages * 0.5) {
    findings.push({
      title: 'Most images load immediately instead of on demand',
      description: `${totalNotLazy} of ${totalImages} images across the site load eagerly. Images below the fold should use lazy loading so the browser prioritizes content the visitor sees first.`,
      recommendation: 'Add `loading="lazy"` to images that appear below the initial viewport. Keep above-the-fold hero images as eager loading. Most modern frameworks support this natively.',
      severity: 'medium',
      performance_metric_type: 'lazy_loading',
      owner_team: 'engineering',
      estimated_impact: 'Lazy loading can reduce initial page weight by 30-60% on image-heavy pages.',
      affected_pages: pageData.filter(p => p.perf.images_not_lazy > 2).map(p => p.url).slice(0, 10),
      why_it_matters: 'Loading all images upfront wastes bandwidth and slows down the initial page render, especially on mobile connections.',
      who_should_fix: 'Engineering team — a simple attribute change on image tags.',
    })
  }

  // ── Heavy page weight ────────────────────────────────────
  const heavyPages = pageData.filter(p => p.perf.page_weight_kb > 1000)
  if (heavyPages.length > 0) {
    const avgWeight = Math.round(heavyPages.reduce((a, p) => a + p.perf.page_weight_kb, 0) / heavyPages.length)
    findings.push({
      title: 'Heavy pages slow down mobile users',
      description: `${heavyPages.length} page${heavyPages.length !== 1 ? 's' : ''} exceed${heavyPages.length === 1 ? 's' : ''} 1MB in size (average ${avgWeight > 1024 ? `${(avgWeight / 1024).toFixed(1)}MB` : `${avgWeight}KB`}). Large pages take longer to download, especially on mobile data connections.`,
      recommendation: 'Compress images, minify CSS and JavaScript, enable gzip/brotli compression on the server, and remove unused code.',
      severity: avgWeight > 2000 ? 'high' : 'medium',
      performance_metric_type: 'page_weight',
      owner_team: 'engineering',
      estimated_impact: 'Pages over 1MB can take 5+ seconds to load on 3G connections, which covers a significant portion of mobile users globally.',
      affected_pages: heavyPages.map(p => p.url).slice(0, 10),
      why_it_matters: 'Heavy pages cost mobile users real money in data and patience. They also hurt search rankings.',
      who_should_fix: 'Engineering team — requires build tooling changes and server configuration.',
    })
  }

  // ── INP: Sluggish interactions ───────────────────────────
  if (summary.avg_inp_ms != null && summary.avg_inp_ms > 200) {
    const slowInteractionPages = pageData
      .filter(p => p.perf.inp_estimate_ms != null && p.perf.inp_estimate_ms > 200)
      .map(p => p.url)
    findings.push({
      title: 'JavaScript may cause sluggish button and link responses',
      description: `Estimated interaction delay averages ${summary.avg_inp_ms}ms. Google recommends under 200ms for a responsive feel. Heavy JavaScript execution blocks the browser from responding to clicks and taps quickly.`,
      recommendation: 'Break up long JavaScript tasks. Defer non-essential scripts. Use web workers for heavy computation. Reduce third-party script impact on the main thread.',
      severity: summary.avg_inp_ms > 500 ? 'high' : 'medium',
      performance_metric_type: 'inp',
      owner_team: 'engineering',
      estimated_impact: 'Sluggish interactions make users feel like the site is broken, reducing engagement and form completions.',
      affected_pages: slowInteractionPages.slice(0, 10),
      why_it_matters: 'When buttons and links feel unresponsive, users lose confidence in the site and are less likely to complete actions like purchases or signups.',
      who_should_fix: 'Engineering team — requires JavaScript optimization and potentially architectural changes.',
    })
  }

  // Sort by severity priority
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return findings
}

/**
 * Compact text summary for inclusion in the LLM analyzer prompt.
 */
export function formatPerformanceForPrompt(data: PagePerformanceData): string {
  const lines: string[] = []
  lines.push(`Performance: ${data.rating}`)
  if (data.lcp_estimate_ms != null) lines.push(`  LCP estimate: ${data.lcp_estimate_ms}ms`)
  if (data.inp_estimate_ms != null) lines.push(`  INP estimate: ${data.inp_estimate_ms}ms`)
  if (data.cls_estimate != null) lines.push(`  CLS estimate: ${data.cls_estimate}`)
  lines.push(`  Page weight: ${data.page_weight_kb}KB`)
  lines.push(`  Scripts: ${data.script_count} (${data.render_blocking_scripts} render-blocking, ${data.script_weight_kb}KB inline)`)
  lines.push(`  Images: ${data.image_count} (${data.images_missing_dimensions} missing dimensions, ${data.images_not_lazy} not lazy)`)
  if (data.third_party_count > 0) lines.push(`  Third-party: ${data.third_party_count} domains (${data.third_party_domains.join(', ')})`)
  lines.push(`  CSS: ${data.css_count}, Fonts: ${data.font_count}`)
  return lines.join('\n')
}
