// ============================================================
// ClearUX Proprietary Pipeline — Technical Health Checks
// PROPRIETARY — do not distribute outside the ClearUX codebase.
// ============================================================
//
// Deterministic, measured checks that run against raw HTML.
// Zero LLM calls — pure DOM analysis for hard facts:
//   - Load time measurement
//   - Image audit (alt text, lazy loading, dimensions, format)
//   - Heading hierarchy validation
//   - Accessibility checks (ARIA, landmarks, form labels, contrast hints)
//   - Performance indicators (DOM size, render-blocking, third-party scripts)
//   - Link validation
// ============================================================

/* ── Result Types ──────────────────────────────────────────── */

export interface ImageIssue {
  src: string
  alt: string | null
  missingAlt: boolean
  missingDimensions: boolean
  missingLazyLoading: boolean
  isLegacyFormat: boolean  // not webp/avif
  estimatedSize: 'unknown' | 'small' | 'large'  // heuristic from src
}

export interface HeadingNode {
  level: number   // 1-6
  text: string
}

export interface HeadingIssue {
  type: 'multiple_h1' | 'skipped_level' | 'empty_heading' | 'missing_h1'
  description: string
  element?: string
}

export interface AccessibilityIssue {
  type: 'missing_form_label' | 'missing_aria_landmark' | 'missing_skip_link' | 'missing_lang' | 'empty_link' | 'empty_button' | 'missing_alt' | 'low_contrast_hint'
  description: string
  element?: string
  severity: 'critical' | 'high' | 'medium' | 'low'
}

export interface PerformanceIssue {
  type: 'large_dom' | 'render_blocking_css' | 'render_blocking_js' | 'too_many_scripts' | 'inline_styles_heavy' | 'no_compression_hint'
  description: string
  value?: number
  severity: 'high' | 'medium' | 'low'
}

export interface LinkIssue {
  url: string
  type: 'empty_href' | 'javascript_href' | 'hash_only' | 'broken_anchor'
  description: string
}

export interface TechnicalAudit {
  // Performance
  loadTimeMs: number | null
  domElementCount: number
  htmlSizeBytes: number
  scriptCount: number
  stylesheetCount: number
  inlineStyleCount: number
  performanceIssues: PerformanceIssue[]
  performanceScore: number  // 0-100

  // Images
  totalImages: number
  imagesWithAlt: number
  imagesWithDimensions: number
  imagesWithLazyLoading: number
  modernFormatImages: number  // webp, avif
  imageIssues: ImageIssue[]
  imageScore: number  // 0-100

  // Headings
  headings: HeadingNode[]
  headingIssues: HeadingIssue[]
  headingScore: number  // 0-100

  // Accessibility
  hasSkipLink: boolean
  hasLangAttribute: boolean
  landmarkCount: number
  formCount: number
  formsWithLabels: number
  ariaRoleCount: number
  accessibilityIssues: AccessibilityIssue[]
  accessibilityScore: number  // 0-100

  // Links
  totalLinks: number
  externalLinks: number
  internalLinks: number
  linkIssues: LinkIssue[]

  // Overall
  overallScore: number  // 0-100 weighted average
}

/* ── Helpers ────────────────────────────────────────────────── */

/** Simple regex tag extractor — works on raw HTML without a DOM parser */
function findAll(html: string, pattern: RegExp): RegExpExecArray[] {
  const results: RegExpExecArray[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')
  while ((match = re.exec(html)) !== null) results.push(match)
  return results
}

function attr(tag: string, name: string): string | null {
  // Match attr="value", attr='value', or attr=value
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|(\\S+))`, 'i')
  const m = tag.match(re)
  if (!m) return null
  return m[1] ?? m[2] ?? m[3] ?? null
}

function hasAttr(tag: string, name: string): boolean {
  return new RegExp(`\\b${name}\\b`, 'i').test(tag)
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

function countMatches(html: string, pattern: RegExp): number {
  return (html.match(pattern) || []).length
}

/* ── Core Analysis ─────────────────────────────────────────── */

export function runTechnicalChecks(rawHtml: string, loadTimeMs: number | null, pageUrl: string): TechnicalAudit {
  const html = rawHtml || ''
  const htmlLower = html.toLowerCase()

  // ── Performance ─────────────────────────────────────────
  const domElementCount = countMatches(html, /<[a-z][a-z0-9]*[\s>]/gi)
  const htmlSizeBytes = new TextEncoder().encode(html).length
  const scriptTags = findAll(html, /<script\b[^>]*>/gi)
  const scriptCount = scriptTags.length
  const stylesheetCount = countMatches(html, /<link\b[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi)
  const inlineStyleCount = countMatches(html, /\bstyle\s*=\s*["']/gi)

  const performanceIssues: PerformanceIssue[] = []

  if (domElementCount > 1500) {
    performanceIssues.push({
      type: 'large_dom',
      description: `DOM has ${domElementCount.toLocaleString()} elements (recommended: under 1,500)`,
      value: domElementCount,
      severity: domElementCount > 3000 ? 'high' : 'medium',
    })
  }

  // Render-blocking CSS in <head>
  const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)
  const headHtml = headMatch?.[1] || ''
  const blockingCss = countMatches(headHtml, /<link\b[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi)
  if (blockingCss > 3) {
    performanceIssues.push({
      type: 'render_blocking_css',
      description: `${blockingCss} render-blocking stylesheets in <head> (consider deferring non-critical CSS)`,
      value: blockingCss,
      severity: blockingCss > 5 ? 'high' : 'medium',
    })
  }

  // Render-blocking JS in <head> without async/defer
  const headScripts = findAll(headHtml, /<script\b[^>]*>/gi)
  const blockingJs = headScripts.filter(m => {
    const tag = m[0]
    return !hasAttr(tag, 'async') && !hasAttr(tag, 'defer') && attr(tag, 'src')
  }).length
  if (blockingJs > 0) {
    performanceIssues.push({
      type: 'render_blocking_js',
      description: `${blockingJs} render-blocking script(s) in <head> without async or defer`,
      value: blockingJs,
      severity: blockingJs > 2 ? 'high' : 'medium',
    })
  }

  if (scriptCount > 15) {
    performanceIssues.push({
      type: 'too_many_scripts',
      description: `${scriptCount} script tags found (consider bundling — recommended: under 15)`,
      value: scriptCount,
      severity: scriptCount > 25 ? 'high' : 'medium',
    })
  }

  if (inlineStyleCount > 30) {
    performanceIssues.push({
      type: 'inline_styles_heavy',
      description: `${inlineStyleCount} inline style attributes (consider using CSS classes)`,
      value: inlineStyleCount,
      severity: 'low',
    })
  }

  // Performance score
  let perfScore = 100
  if (loadTimeMs && loadTimeMs > 3000) perfScore -= Math.min(30, Math.floor((loadTimeMs - 3000) / 200))
  if (domElementCount > 1500) perfScore -= Math.min(20, Math.floor((domElementCount - 1500) / 200))
  if (blockingJs > 0) perfScore -= blockingJs * 5
  if (blockingCss > 3) perfScore -= (blockingCss - 3) * 3
  if (scriptCount > 15) perfScore -= Math.min(15, (scriptCount - 15) * 2)
  if (htmlSizeBytes > 200_000) perfScore -= Math.min(15, Math.floor((htmlSizeBytes - 200_000) / 50_000))
  perfScore = Math.max(0, Math.min(100, perfScore))

  // ── Images ──────────────────────────────────────────────
  const imgTags = findAll(html, /<img\b[^>]*\/?>/gi)
  const totalImages = imgTags.length
  let imagesWithAlt = 0
  let imagesWithDimensions = 0
  let imagesWithLazyLoading = 0
  let modernFormatImages = 0
  const imageIssues: ImageIssue[] = []

  for (const match of imgTags) {
    const tag = match[0]
    const src = attr(tag, 'src') || ''
    const altVal = attr(tag, 'alt')
    const hasAlt = altVal !== null
    const hasDims = (hasAttr(tag, 'width') && hasAttr(tag, 'height')) || false
    const hasLazy = attr(tag, 'loading') === 'lazy' || hasAttr(tag, 'data-lazy') || hasAttr(tag, 'data-src')
    const ext = src.split('?')[0].split('.').pop()?.toLowerCase() || ''
    const isModern = ['webp', 'avif'].includes(ext)

    if (hasAlt) imagesWithAlt++
    if (hasDims) imagesWithDimensions++
    if (hasLazy) imagesWithLazyLoading++
    if (isModern) modernFormatImages++

    const missingAlt = !hasAlt
    const missingDimensions = !hasDims
    const missingLazyLoading = !hasLazy
    const isLegacyFormat = !isModern && ['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext)

    if (missingAlt || missingDimensions || isLegacyFormat) {
      imageIssues.push({
        src: src.substring(0, 200),
        alt: altVal,
        missingAlt,
        missingDimensions,
        missingLazyLoading,
        isLegacyFormat,
        estimatedSize: 'unknown',
      })
    }
  }

  // Image score
  let imgScore = 100
  if (totalImages > 0) {
    const altRatio = imagesWithAlt / totalImages
    const dimRatio = imagesWithDimensions / totalImages
    const modernRatio = totalImages > 0 ? modernFormatImages / totalImages : 1
    imgScore = Math.round(altRatio * 40 + dimRatio * 25 + modernRatio * 20 + (imagesWithLazyLoading / Math.max(1, totalImages)) * 15)
  }
  imgScore = Math.max(0, Math.min(100, imgScore))

  // ── Headings ────────────────────────────────────────────
  const headingMatches = findAll(html, /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi)
  const headings: HeadingNode[] = headingMatches.map(m => ({
    level: parseInt(m[1].charAt(1)),
    text: stripTags(m[2]).substring(0, 200),
  }))

  const headingIssues: HeadingIssue[] = []
  const h1s = headings.filter(h => h.level === 1)

  if (h1s.length === 0) {
    headingIssues.push({ type: 'missing_h1', description: 'Page has no H1 element' })
  } else if (h1s.length > 1) {
    headingIssues.push({ type: 'multiple_h1', description: `Page has ${h1s.length} H1 elements (should be exactly 1)`, element: h1s.map(h => h.text).join(', ') })
  }

  // Check for skipped levels (e.g. H2 → H4)
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1].level
    const curr = headings[i].level
    if (curr > prev + 1) {
      headingIssues.push({
        type: 'skipped_level',
        description: `Heading jumps from H${prev} to H${curr} (skips H${prev + 1})`,
        element: headings[i].text,
      })
    }
  }

  // Empty headings
  for (const h of headings) {
    if (!h.text || h.text.trim().length === 0) {
      headingIssues.push({ type: 'empty_heading', description: `Empty H${h.level} element`, element: '' })
    }
  }

  // Heading score
  let headingScore = 100
  if (h1s.length === 0) headingScore -= 30
  if (h1s.length > 1) headingScore -= 15
  headingScore -= headingIssues.filter(i => i.type === 'skipped_level').length * 10
  headingScore -= headingIssues.filter(i => i.type === 'empty_heading').length * 5
  headingScore = Math.max(0, Math.min(100, headingScore))

  // ── Accessibility ───────────────────────────────────────
  const accessibilityIssues: AccessibilityIssue[] = []

  // Language attribute
  const hasLangAttribute = /<html\b[^>]*\blang\s*=\s*["'][^"']+["']/i.test(html)
  if (!hasLangAttribute) {
    accessibilityIssues.push({
      type: 'missing_lang',
      description: 'HTML element missing lang attribute',
      severity: 'high',
    })
  }

  // Skip link
  const hasSkipLink = /skip[\s-]*(?:to[\s-]*)?(?:main|content|nav)/i.test(html)
  if (!hasSkipLink) {
    accessibilityIssues.push({
      type: 'missing_skip_link',
      description: 'No skip-to-content link found for keyboard navigation',
      severity: 'medium',
    })
  }

  // ARIA landmarks
  const landmarkCount = countMatches(html, /role\s*=\s*["'](?:main|navigation|banner|contentinfo|complementary|search)["']/gi)
    + countMatches(html, /<(?:main|nav|header|footer|aside|form)\b/gi)
  const hasMainLandmark = /<main\b/i.test(html) || /role\s*=\s*["']main["']/i.test(html)
  const hasNavLandmark = /<nav\b/i.test(html) || /role\s*=\s*["']navigation["']/i.test(html)

  if (!hasMainLandmark) {
    accessibilityIssues.push({
      type: 'missing_aria_landmark',
      description: 'No <main> landmark found — screen readers need this to identify primary content',
      severity: 'high',
    })
  }
  if (!hasNavLandmark) {
    accessibilityIssues.push({
      type: 'missing_aria_landmark',
      description: 'No <nav> landmark found — screen readers need this to identify navigation',
      severity: 'medium',
    })
  }

  // ARIA roles count
  const ariaRoleCount = countMatches(html, /\brole\s*=\s*["']/gi)
    + countMatches(html, /\baria-\w+\s*=\s*["']/gi)

  // Form labels
  const formTags = findAll(html, /<form\b[^>]*>[\s\S]*?<\/form>/gi)
  const formCount = formTags.length
  let formsWithLabels = 0

  // Simpler approach: count all inputs and labels on the page
  const inputCount = countMatches(html, /<(?:input|select|textarea)\b[^>]*>/gi) - countMatches(html, /type\s*=\s*["'](?:hidden|submit|button|reset|image)["']/gi)
  const labelCount = countMatches(html, /<label\b/gi)
  const ariaLabelCount = countMatches(html, /aria-label\s*=\s*["']/gi)

  if (inputCount > 0 && (labelCount + ariaLabelCount) < inputCount) {
    const missing = inputCount - labelCount - ariaLabelCount
    accessibilityIssues.push({
      type: 'missing_form_label',
      description: `${missing} form input(s) appear to lack associated <label> or aria-label`,
      severity: 'high',
    })
  }
  if (formCount > 0) {
    formsWithLabels = Math.min(formCount, labelCount > 0 ? formCount : 0)
  }

  // Empty links
  const emptyLinks = findAll(html, /<a\b[^>]*>\s*<\/a>/gi)
  if (emptyLinks.length > 0) {
    accessibilityIssues.push({
      type: 'empty_link',
      description: `${emptyLinks.length} empty link(s) with no text content (invisible to screen readers)`,
      severity: 'medium',
    })
  }

  // Empty buttons
  const emptyButtons = findAll(html, /<button\b[^>]*>\s*<\/button>/gi)
  if (emptyButtons.length > 0) {
    accessibilityIssues.push({
      type: 'empty_button',
      description: `${emptyButtons.length} empty button(s) with no text content`,
      severity: 'medium',
    })
  }

  // Images without alt (from image audit)
  const missingAltCount = imageIssues.filter(i => i.missingAlt).length
  if (missingAltCount > 0) {
    accessibilityIssues.push({
      type: 'missing_alt',
      description: `${missingAltCount} image(s) missing alt text`,
      severity: 'high',
    })
  }

  // Accessibility score
  let a11yScore = 100
  if (!hasLangAttribute) a11yScore -= 15
  if (!hasSkipLink) a11yScore -= 10
  if (!hasMainLandmark) a11yScore -= 15
  if (!hasNavLandmark) a11yScore -= 5
  if (missingAltCount > 0) a11yScore -= Math.min(25, missingAltCount * 5)
  if (emptyLinks.length > 0) a11yScore -= Math.min(10, emptyLinks.length * 3)
  if (inputCount > 0 && (labelCount + ariaLabelCount) < inputCount) a11yScore -= 15
  a11yScore = Math.max(0, Math.min(100, a11yScore))

  // ── Links ───────────────────────────────────────────────
  const allLinks = findAll(html, /<a\b([^>]*)>/gi)
  let externalLinks = 0
  let internalLinkCount = 0
  const linkIssues: LinkIssue[] = []
  let baseHost = ''
  try { baseHost = new URL(pageUrl).hostname.replace(/^www\./i, '').toLowerCase() } catch {}

  for (const match of allLinks) {
    const href = attr(match[0], 'href')
    if (!href || href.trim() === '') {
      linkIssues.push({ url: '', type: 'empty_href', description: 'Link with empty or missing href' })
      continue
    }
    if (href.startsWith('javascript:')) {
      linkIssues.push({ url: href.substring(0, 100), type: 'javascript_href', description: 'Link uses javascript: protocol (inaccessible)' })
      continue
    }
    if (href === '#') {
      linkIssues.push({ url: '#', type: 'hash_only', description: 'Link with href="#" (not a real destination)' })
      continue
    }
    try {
      const linkHost = new URL(href, pageUrl).hostname.replace(/^www\./i, '').toLowerCase()
      if (linkHost === baseHost) internalLinkCount++
      else externalLinks++
    } catch {
      internalLinkCount++ // relative links
    }
  }

  // ── Overall Score ───────────────────────────────────────
  // Weighted: Performance 25%, Images 20%, Headings 15%, Accessibility 40%
  const overallScore = Math.round(
    perfScore * 0.25 +
    imgScore * 0.20 +
    headingScore * 0.15 +
    a11yScore * 0.40
  )

  return {
    loadTimeMs,
    domElementCount,
    htmlSizeBytes,
    scriptCount,
    stylesheetCount,
    inlineStyleCount,
    performanceIssues,
    performanceScore: perfScore,

    totalImages,
    imagesWithAlt,
    imagesWithDimensions,
    imagesWithLazyLoading,
    modernFormatImages,
    imageIssues: imageIssues.slice(0, 50), // cap to avoid huge payloads
    imageScore: imgScore,

    headings,
    headingIssues,
    headingScore,

    hasSkipLink,
    hasLangAttribute,
    landmarkCount,
    formCount,
    formsWithLabels,
    ariaRoleCount,
    accessibilityIssues,
    accessibilityScore: a11yScore,

    totalLinks: allLinks.length,
    externalLinks,
    internalLinks: internalLinkCount,
    linkIssues: linkIssues.slice(0, 30),

    overallScore,
  }
}
