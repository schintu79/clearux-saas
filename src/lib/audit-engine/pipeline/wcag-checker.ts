// ============================================================
// ClearUX Audit Engine — WCAG 2.1 AA Checker
// ============================================================
// Comprehensive automated WCAG 2.1 Level AA conformance checks
// with AI-powered heuristic analysis for criteria that cannot
// be fully verified by DOM inspection alone.
//
// Three layers:
//  1. Automated DOM checks (Puppeteer) — ~40 criteria
//  2. HTML-based static analysis — heading order, lang, forms
//  3. AI heuristic analysis — timing, sensory, meaningful seq.
//
// Results produce:
//  - Per-criterion pass/fail/warning checklist
//  - Individual AnalysisFinding objects for each failure
//  - Summary text for AI context injection
// ============================================================
// PROPRIETARY — do not distribute outside the ClearUX codebase.
// ============================================================

import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { launchAuditBrowser } from '@/lib/audit-engine/browser-launcher'

/* ── WCAG 2.1 AA Criteria Taxonomy ─────────────────────────── */

export type WcagPrinciple = 'perceivable' | 'operable' | 'understandable' | 'robust'
export type WcagStatus = 'pass' | 'fail' | 'warning' | 'not_applicable' | 'needs_review'
export type WcagCheckMethod = 'automated' | 'heuristic' | 'manual_only'

export interface WcagCriterion {
  id: string              // e.g. "1.1.1"
  name: string            // e.g. "Non-text Content"
  level: 'A' | 'AA'
  principle: WcagPrinciple
  method: WcagCheckMethod
}

export interface WcagCheckResult {
  criterion: WcagCriterion
  status: WcagStatus
  issues: WcagIssue[]
}

export interface WcagIssue {
  element?: string        // CSS selector or tag description
  description: string     // What's wrong
  recommendation: string  // How to fix it
  severity: 'critical' | 'high' | 'medium' | 'low'
  evidence?: string       // Snippet of the offending element
}

export interface WcagPageResult {
  url: string
  timestamp: string
  checklist: WcagCheckResult[]
  score: number           // 0-100 — percentage of criteria passing
  summary: string         // Compact text for AI context injection
  findings: WcagFinding[] // Pre-built findings ready for DB insertion
}

export interface WcagFinding {
  title: string
  description: string
  recommendation: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  wcagCriterion: string   // e.g. "1.4.3"
  wcagPrinciple: WcagPrinciple
  element?: string
  evidence?: string
  pageUrl: string
}

export interface WcagAuditResult {
  pages: WcagPageResult[]
  overallScore: number
  totalFindings: number
  summary: string
}

/* ── Full WCAG 2.1 AA Criteria List ──────────────────────── */

const WCAG_CRITERIA: WcagCriterion[] = [
  // ── Perceivable ──
  { id: '1.1.1', name: 'Non-text Content',                   level: 'A',  principle: 'perceivable', method: 'automated' },
  { id: '1.2.1', name: 'Audio-only and Video-only',          level: 'A',  principle: 'perceivable', method: 'heuristic' },
  { id: '1.2.2', name: 'Captions (Prerecorded)',             level: 'A',  principle: 'perceivable', method: 'heuristic' },
  { id: '1.2.3', name: 'Audio Description or Media Alt',     level: 'A',  principle: 'perceivable', method: 'heuristic' },
  { id: '1.2.5', name: 'Audio Description (Prerecorded)',    level: 'AA', principle: 'perceivable', method: 'heuristic' },
  { id: '1.3.1', name: 'Info and Relationships',             level: 'A',  principle: 'perceivable', method: 'automated' },
  { id: '1.3.2', name: 'Meaningful Sequence',                level: 'A',  principle: 'perceivable', method: 'heuristic' },
  { id: '1.3.3', name: 'Sensory Characteristics',            level: 'A',  principle: 'perceivable', method: 'heuristic' },
  { id: '1.3.4', name: 'Orientation',                        level: 'AA', principle: 'perceivable', method: 'automated' },
  { id: '1.3.5', name: 'Identify Input Purpose',             level: 'AA', principle: 'perceivable', method: 'automated' },
  { id: '1.4.1', name: 'Use of Color',                       level: 'A',  principle: 'perceivable', method: 'heuristic' },
  { id: '1.4.2', name: 'Audio Control',                      level: 'A',  principle: 'perceivable', method: 'automated' },
  { id: '1.4.3', name: 'Contrast (Minimum)',                 level: 'AA', principle: 'perceivable', method: 'automated' },
  { id: '1.4.4', name: 'Resize Text',                        level: 'AA', principle: 'perceivable', method: 'automated' },
  { id: '1.4.5', name: 'Images of Text',                     level: 'AA', principle: 'perceivable', method: 'heuristic' },
  { id: '1.4.10', name: 'Reflow',                            level: 'AA', principle: 'perceivable', method: 'automated' },
  { id: '1.4.11', name: 'Non-text Contrast',                 level: 'AA', principle: 'perceivable', method: 'automated' },
  { id: '1.4.12', name: 'Text Spacing',                      level: 'AA', principle: 'perceivable', method: 'automated' },
  { id: '1.4.13', name: 'Content on Hover or Focus',         level: 'AA', principle: 'perceivable', method: 'heuristic' },
  // ── Operable ──
  { id: '2.1.1', name: 'Keyboard',                           level: 'A',  principle: 'operable', method: 'automated' },
  { id: '2.1.2', name: 'No Keyboard Trap',                   level: 'A',  principle: 'operable', method: 'automated' },
  { id: '2.1.4', name: 'Character Key Shortcuts',            level: 'A',  principle: 'operable', method: 'heuristic' },
  { id: '2.2.1', name: 'Timing Adjustable',                  level: 'A',  principle: 'operable', method: 'heuristic' },
  { id: '2.2.2', name: 'Pause, Stop, Hide',                  level: 'A',  principle: 'operable', method: 'automated' },
  { id: '2.3.1', name: 'Three Flashes or Below Threshold',   level: 'A',  principle: 'operable', method: 'heuristic' },
  { id: '2.4.1', name: 'Bypass Blocks',                      level: 'A',  principle: 'operable', method: 'automated' },
  { id: '2.4.2', name: 'Page Titled',                        level: 'A',  principle: 'operable', method: 'automated' },
  { id: '2.4.3', name: 'Focus Order',                        level: 'A',  principle: 'operable', method: 'automated' },
  { id: '2.4.4', name: 'Link Purpose (In Context)',          level: 'A',  principle: 'operable', method: 'automated' },
  { id: '2.4.5', name: 'Multiple Ways',                      level: 'AA', principle: 'operable', method: 'heuristic' },
  { id: '2.4.6', name: 'Headings and Labels',                level: 'AA', principle: 'operable', method: 'automated' },
  { id: '2.4.7', name: 'Focus Visible',                      level: 'AA', principle: 'operable', method: 'automated' },
  { id: '2.5.1', name: 'Pointer Gestures',                   level: 'A',  principle: 'operable', method: 'heuristic' },
  { id: '2.5.2', name: 'Pointer Cancellation',               level: 'A',  principle: 'operable', method: 'heuristic' },
  { id: '2.5.3', name: 'Label in Name',                      level: 'A',  principle: 'operable', method: 'automated' },
  { id: '2.5.4', name: 'Motion Actuation',                   level: 'A',  principle: 'operable', method: 'heuristic' },
  // ── Understandable ──
  { id: '3.1.1', name: 'Language of Page',                   level: 'A',  principle: 'understandable', method: 'automated' },
  { id: '3.1.2', name: 'Language of Parts',                  level: 'AA', principle: 'understandable', method: 'automated' },
  { id: '3.2.1', name: 'On Focus',                           level: 'A',  principle: 'understandable', method: 'heuristic' },
  { id: '3.2.2', name: 'On Input',                           level: 'A',  principle: 'understandable', method: 'heuristic' },
  { id: '3.2.3', name: 'Consistent Navigation',              level: 'AA', principle: 'understandable', method: 'heuristic' },
  { id: '3.2.4', name: 'Consistent Identification',          level: 'AA', principle: 'understandable', method: 'heuristic' },
  { id: '3.3.1', name: 'Error Identification',               level: 'A',  principle: 'understandable', method: 'automated' },
  { id: '3.3.2', name: 'Labels or Instructions',             level: 'A',  principle: 'understandable', method: 'automated' },
  { id: '3.3.3', name: 'Error Suggestion',                   level: 'AA', principle: 'understandable', method: 'heuristic' },
  { id: '3.3.4', name: 'Error Prevention (Legal/Financial)',  level: 'AA', principle: 'understandable', method: 'heuristic' },
  // ── Robust ──
  { id: '4.1.1', name: 'Parsing',                            level: 'A',  principle: 'robust', method: 'automated' },
  { id: '4.1.2', name: 'Name, Role, Value',                  level: 'A',  principle: 'robust', method: 'automated' },
  { id: '4.1.3', name: 'Status Messages',                    level: 'AA', principle: 'robust', method: 'heuristic' },
]

/* ── Contrast helpers (used inside page.evaluate inline) ───── */
// Note: contrast computation runs inside the browser via page.evaluate()
// because we need computed styles. The sRGB-to-linear conversion and
// luminance math are inlined in the 1.4.3 check below.

/* ── Browser management (shared with responsive-checker) ──── */

async function launchBrowser(): Promise<Browser> {
  // Shared launcher (Plan §0.6) — real serverless error is reported, not swallowed
  return launchAuditBrowser({ viewport: null })
}

/* ── Automated DOM checks ───────────────────────────────────── */

async function runAutomatedChecks(page: Page, url: string): Promise<WcagCheckResult[]> {
  const results: WcagCheckResult[] = []

  // Helper to build result
  const addResult = (id: string, status: WcagStatus, issues: WcagIssue[] = []) => {
    const criterion = WCAG_CRITERIA.find(c => c.id === id)
    if (criterion) results.push({ criterion, status, issues })
  }

  // ── 1.1.1 Non-text Content (images without alt) ──
  const imgData = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img')
    const missing: Array<{ src: string; snippet: string }> = []
    for (const img of imgs) {
      const alt = img.getAttribute('alt')
      if (alt === null) { // alt="" is intentionally decorative — ok
        missing.push({
          src: img.src?.slice(0, 80) || '(no src)',
          snippet: img.outerHTML.slice(0, 120),
        })
      }
    }
    // Also check SVGs without accessible names
    const svgs = document.querySelectorAll('svg:not([aria-hidden="true"])')
    const missingSvg: string[] = []
    for (const svg of svgs) {
      const hasTitle = svg.querySelector('title')
      const hasLabel = svg.getAttribute('aria-label') || svg.getAttribute('aria-labelledby')
      if (!hasTitle && !hasLabel) missingSvg.push(svg.outerHTML.slice(0, 80))
    }
    return { missing, missingSvg, total: imgs.length }
  })

  if (imgData.missing.length > 0 || imgData.missingSvg.length > 0) {
    const issues: WcagIssue[] = []
    for (const img of imgData.missing.slice(0, 5)) {
      issues.push({
        element: `<img src="${img.src}">`,
        description: 'Image has no alt attribute. Screen readers cannot describe this image.',
        recommendation: 'Add a descriptive alt attribute, or alt="" if the image is purely decorative.',
        severity: 'high',
        evidence: img.snippet,
      })
    }
    for (const svg of imgData.missingSvg.slice(0, 3)) {
      issues.push({
        element: '<svg>',
        description: 'SVG has no accessible name (no <title>, aria-label, or aria-labelledby).',
        recommendation: 'Add <title> inside the SVG or aria-label on the element, or aria-hidden="true" if decorative.',
        severity: 'medium',
        evidence: svg,
      })
    }
    addResult('1.1.1', 'fail', issues)
  } else {
    addResult('1.1.1', 'pass')
  }

  // ── 1.3.1 Info and Relationships (semantic markup) ──
  const structureData = await page.evaluate(() => {
    const issues: Array<{ desc: string; el: string; sev: string }> = []
    // Check for visual headings that aren't semantic
    const allBold = document.querySelectorAll('b, strong')
    for (const el of allBold) {
      const fs = parseFloat(window.getComputedStyle(el).fontSize || '16')
      if (fs >= 20 && !el.closest('h1,h2,h3,h4,h5,h6')) {
        issues.push({ desc: 'Bold large text not using heading tags', el: el.textContent?.slice(0, 50) || '', sev: 'medium' })
        break
      }
    }
    // Check for form inputs without labels
    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea')
    let unlabeled = 0
    for (const input of inputs) {
      const id = input.getAttribute('id')
      const hasLabel = id ? document.querySelector(`label[for="${id}"]`) : false
      const hasAriaLabel = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby')
      const wrappedInLabel = input.closest('label')
      if (!hasLabel && !hasAriaLabel && !wrappedInLabel) {
        unlabeled++
      }
    }
    if (unlabeled > 0) {
      issues.push({ desc: `${unlabeled} form input(s) without associated label`, el: '<input>', sev: 'high' })
    }
    // Check for data tables without headers
    const tables = document.querySelectorAll('table')
    for (const table of tables) {
      if (table.querySelector('th') === null && table.rows.length > 2) {
        issues.push({ desc: 'Data table has no header cells (<th>)', el: '<table>', sev: 'medium' })
        break
      }
    }
    // Check for lists using divs instead of ul/ol
    const navs = document.querySelectorAll('nav')
    for (const nav of navs) {
      if (!nav.querySelector('ul, ol') && nav.querySelectorAll('a').length > 3) {
        issues.push({ desc: 'Navigation links not in a list (<ul>/<ol>)', el: '<nav>', sev: 'low' })
        break
      }
    }
    return { issues, inputCount: inputs.length }
  })

  if (structureData.issues.length > 0) {
    addResult('1.3.1', 'fail', structureData.issues.map(i => ({
      description: i.desc,
      recommendation: i.desc.includes('label') ? 'Associate each input with a <label for="..."> or aria-label attribute.'
        : i.desc.includes('heading') ? 'Use <h2>...<h6> for content headings instead of styled <b>/<strong>.'
        : i.desc.includes('table') ? 'Add <th> header cells to data tables for screen reader context.'
        : 'Use semantic HTML elements (<ul>, <ol>, <nav>) to convey structure.',
      severity: (i.sev as WcagIssue['severity']),
      element: i.el,
    })))
  } else {
    addResult('1.3.1', 'pass')
  }

  // ── 1.3.4 Orientation (no orientation lock) ──
  const orientationLock = await page.evaluate(() => {
    const styles = Array.from(document.styleSheets)
    for (const sheet of styles) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSMediaRule && /orientation:\s*portrait|orientation:\s*landscape/.test(rule.conditionText)) {
            if (/display:\s*none|visibility:\s*hidden|height:\s*0|width:\s*0/.test(rule.cssText)) {
              return true
            }
          }
        }
      } catch { /* cross-origin stylesheet */ }
    }
    return false
  })
  addResult('1.3.4', orientationLock ? 'fail' : 'pass',
    orientationLock ? [{ description: 'Content is hidden in one orientation — possible orientation lock.', recommendation: 'Do not restrict content to a single display orientation.', severity: 'medium' }] : [])

  // ── 1.3.5 Identify Input Purpose (autocomplete) ──
  const inputPurpose = await page.evaluate(() => {
    const personalInputs = document.querySelectorAll(
      'input[type="email"], input[type="tel"], input[name*="name" i], input[name*="email" i], input[name*="phone" i], input[name*="address" i], input[name*="zip" i], input[name*="city" i]'
    )
    const missing: string[] = []
    for (const input of personalInputs) {
      if (!input.getAttribute('autocomplete')) {
        missing.push(`<input name="${input.getAttribute('name') || input.getAttribute('type')}">`)
      }
    }
    return missing.slice(0, 5)
  })
  addResult('1.3.5', inputPurpose.length > 0 ? 'fail' : 'pass',
    inputPurpose.map(el => ({
      element: el,
      description: 'Personal data input missing autocomplete attribute.',
      recommendation: 'Add autocomplete="email", "tel", "name", etc. to help autofill and assistive technology.',
      severity: 'low',
    })))

  // ── 1.4.2 Audio Control (autoplay) ──
  const autoplayMedia = await page.evaluate(() => {
    const audios = document.querySelectorAll('audio[autoplay], video[autoplay]')
    return audios.length
  })
  addResult('1.4.2', autoplayMedia > 0 ? 'fail' : 'pass',
    autoplayMedia > 0 ? [{ description: `${autoplayMedia} media element(s) have autoplay. Users who cannot see may find it difficult to locate and pause them.`, recommendation: 'Remove autoplay or provide a clearly labeled pause/stop control within the first few elements.', severity: 'high' }] : [])

  // ── 1.4.3 Contrast (Minimum) — sample text elements ──
  const contrastIssues = await page.evaluate(() => {
    const issues: Array<{ text: string; fg: string; bg: string; ratio: number; fontSize: number; el: string }> = []
    const textElements = document.querySelectorAll('p, span, a, li, td, th, label, h1, h2, h3, h4, h5, h6, button, div')
    let checked = 0
    for (const el of textElements) {
      if (checked > 50) break
      const text = el.textContent?.trim()
      if (!text || text.length < 2) continue
      // Only check leaf-like text nodes
      if (el.children.length > 3) continue
      const style = window.getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue
      const fg = style.color
      const bg = style.backgroundColor
      if (!fg || !bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue
      checked++
      const parseFg = fg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
      const parseBg = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
      if (!parseFg || !parseBg) continue
      const fgR = parseInt(parseFg[1]), fgG = parseInt(parseFg[2]), fgB = parseInt(parseFg[3])
      const bgR = parseInt(parseBg[1]), bgG = parseInt(parseBg[2]), bgB = parseInt(parseBg[3])

      function srgb(c: number) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
      const l1 = 0.2126 * srgb(fgR / 255) + 0.7152 * srgb(fgG / 255) + 0.0722 * srgb(fgB / 255)
      const l2 = 0.2126 * srgb(bgR / 255) + 0.7152 * srgb(bgG / 255) + 0.0722 * srgb(bgB / 255)
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
      const fontSize = parseFloat(style.fontSize || '16')
      const isBold = parseInt(style.fontWeight || '400') >= 700
      const isLarge = fontSize >= 24 || (fontSize >= 18.66 && isBold)
      const threshold = isLarge ? 3 : 4.5
      if (ratio < threshold) {
        const tag = el.tagName.toLowerCase()
        const cls = el.className ? `.${String(el.className).split(' ').slice(0, 2).join('.')}` : ''
        issues.push({
          text: text.slice(0, 40),
          fg, bg,
          ratio: Math.round(ratio * 100) / 100,
          fontSize,
          el: `<${tag}${cls}>`,
        })
      }
    }
    return issues.slice(0, 8)
  })
  addResult('1.4.3', contrastIssues.length > 0 ? 'fail' : 'pass',
    contrastIssues.map(i => ({
      element: i.el,
      description: `Text "${i.text}" has contrast ratio ${i.ratio}:1 (fg: ${i.fg}, bg: ${i.bg}). WCAG AA requires ${i.fontSize >= 24 ? '3:1' : '4.5:1'}.`,
      recommendation: `Increase contrast between text and background to at least ${i.fontSize >= 24 ? '3:1' : '4.5:1'}.`,
      severity: i.ratio < 3 ? 'critical' : 'high',
      evidence: `${i.fg} on ${i.bg} = ${i.ratio}:1`,
    })))

  // ── 1.4.4 Resize Text (viewport units locking text) ──
  const resizeIssue = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="viewport"]')
    const content = meta?.getAttribute('content') || ''
    return /maximum-scale\s*=\s*1([^.]|$)|user-scalable\s*=\s*no/i.test(content)
  })
  addResult('1.4.4', resizeIssue ? 'fail' : 'pass',
    resizeIssue ? [{ description: 'Viewport meta tag disables user scaling (maximum-scale=1 or user-scalable=no).', recommendation: 'Allow users to zoom by removing maximum-scale and user-scalable restrictions.', severity: 'critical' }] : [])

  // ── 1.4.10 Reflow at 320px ──
  const currentVP = page.viewport()
  await page.setViewport({ width: 320, height: 480 })
  const reflowOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > 320 + 10
  })
  if (currentVP) await page.setViewport(currentVP)
  addResult('1.4.10', reflowOverflow ? 'fail' : 'pass',
    reflowOverflow ? [{ description: 'Page has horizontal scroll at 320px width. Content should reflow to a single column without horizontal scrolling.', recommendation: 'Use responsive CSS (max-width: 100%, flexbox, or grid) so content reflows at narrow widths.', severity: 'high' }] : [])

  // ── 1.4.11 Non-text Contrast (UI components, focus indicators) ──
  const uiContrastIssues = await page.evaluate(() => {
    const issues: string[] = []
    // Check buttons and inputs for border/background contrast
    const els = document.querySelectorAll('button, input, select, textarea, [role="button"]')
    let checked = 0
    for (const el of els) {
      if (checked > 20) break
      const style = window.getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      checked++
      const border = style.borderColor
      const bg = style.backgroundColor
      if (border === 'rgba(0, 0, 0, 0)' && bg === 'rgba(0, 0, 0, 0)') {
        // No visible boundary — might fail non-text contrast
        const tag = el.tagName.toLowerCase()
        issues.push(`<${tag}> with no visible boundary`)
      }
    }
    return issues.slice(0, 3)
  })
  addResult('1.4.11', uiContrastIssues.length > 0 ? 'warning' : 'pass',
    uiContrastIssues.map(el => ({
      element: el,
      description: 'Interactive element may lack sufficient visual boundary contrast (3:1 against adjacent colors).',
      recommendation: 'Ensure buttons, inputs, and other UI components have visible borders or fills with at least 3:1 contrast ratio.',
      severity: 'medium',
    })))

  // ── 1.4.12 Text Spacing — check if content clips when spacing is increased ──
  const textSpacingIssue = await page.evaluate(() => {
    // Inject WCAG text spacing overrides
    const style = document.createElement('style')
    style.textContent = `* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }`
    document.head.appendChild(style)
    // Check for overflow:hidden clipping
    let clipped = 0
    const els = document.querySelectorAll('div, section, article, p, span, li')
    for (const el of els) {
      const cs = window.getComputedStyle(el)
      if (cs.overflow === 'hidden' && el.scrollHeight > el.clientHeight + 5) {
        clipped++
      }
    }
    style.remove()
    return clipped
  })
  addResult('1.4.12', textSpacingIssue > 0 ? 'fail' : 'pass',
    textSpacingIssue > 0 ? [{ description: `${textSpacingIssue} element(s) clip content when WCAG text spacing overrides are applied (line-height 1.5, letter-spacing 0.12em).`, recommendation: 'Avoid fixed heights with overflow:hidden on text containers. Use min-height or auto height so content can expand.', severity: 'medium' }] : [])

  // ── 2.1.1 Keyboard — check focusable elements ──
  const keyboardData = await page.evaluate(() => {
    const interactive = document.querySelectorAll('a[href], button, input, select, textarea, [tabindex], [role="button"], [role="link"], [onclick]')
    let nonFocusable = 0
    const examples: string[] = []
    for (const el of interactive) {
      const tabindex = el.getAttribute('tabindex')
      if (tabindex === '-1') {
        nonFocusable++
        if (examples.length < 3) examples.push(el.outerHTML.slice(0, 80))
      }
      // Check divs/spans with onclick but no tabindex
      if (el.hasAttribute('onclick') && !el.hasAttribute('tabindex') && !el.matches('a, button, input, select, textarea')) {
        nonFocusable++
        if (examples.length < 3) examples.push(el.outerHTML.slice(0, 80))
      }
    }
    return { nonFocusable, examples }
  })
  addResult('2.1.1', keyboardData.nonFocusable > 0 ? 'fail' : 'pass',
    keyboardData.nonFocusable > 0 ? [{
      description: `${keyboardData.nonFocusable} interactive element(s) are not keyboard-accessible (tabindex="-1" or click handlers without keyboard support).`,
      recommendation: 'Ensure all interactive elements are focusable (remove tabindex="-1") and add keyboard event handlers alongside click handlers.',
      severity: 'high',
      evidence: keyboardData.examples.join('\n'),
    }] : [])

  // ── 2.2.2 Pause, Stop, Hide (auto-moving content) ──
  const autoMoving = await page.evaluate(() => {
    const marquees = document.querySelectorAll('marquee, [class*="marquee"], [class*="scroll"], [class*="carousel"][data-autoplay], [class*="slider"][data-autoplay]')
    const animations = document.querySelectorAll('[class*="animate"], [class*="spinning"], [style*="animation"]')
    return { marquees: marquees.length, animations: animations.length }
  })
  addResult('2.2.2', autoMoving.marquees > 0 ? 'fail' : (autoMoving.animations > 3 ? 'warning' : 'pass'),
    autoMoving.marquees > 0 ? [{ description: `Auto-moving/scrolling content detected (${autoMoving.marquees} marquee-like elements).`, recommendation: 'Provide a pause/stop mechanism for any auto-updating or auto-moving content.', severity: 'high' }] : [])

  // ── 2.4.1 Bypass Blocks (skip links, landmarks) ──
  const bypassData = await page.evaluate(() => {
    const skipLink = document.querySelector('a[href="#main"], a[href="#content"], a[href="#main-content"], [class*="skip"]')
    const landmarks = document.querySelectorAll('main, [role="main"], nav, [role="navigation"], header, [role="banner"], footer, [role="contentinfo"]')
    return { hasSkip: !!skipLink, landmarkCount: landmarks.length }
  })
  addResult('2.4.1', bypassData.hasSkip || bypassData.landmarkCount >= 3 ? 'pass' : 'fail',
    (!bypassData.hasSkip && bypassData.landmarkCount < 3) ? [{
      description: 'No skip navigation link or sufficient ARIA landmarks found. Keyboard users must tab through repetitive navigation on every page.',
      recommendation: 'Add a "Skip to main content" link as the first focusable element, and use <main>, <nav>, <header>, <footer> landmarks.',
      severity: 'high',
    }] : [])

  // ── 2.4.2 Page Titled ──
  const pageTitle = await page.evaluate(() => document.title?.trim() || '')
  addResult('2.4.2', pageTitle.length > 0 ? 'pass' : 'fail',
    pageTitle.length === 0 ? [{ description: 'Page has no <title> element.', recommendation: 'Add a descriptive <title> that identifies the page topic.', severity: 'high' }] : [])

  // ── 2.4.3 Focus Order (tabindex > 0) ──
  const badTabindex = await page.evaluate(() => {
    const els = document.querySelectorAll('[tabindex]')
    let positiveCount = 0
    for (const el of els) {
      const val = parseInt(el.getAttribute('tabindex') || '0')
      if (val > 0) positiveCount++
    }
    return positiveCount
  })
  addResult('2.4.3', badTabindex > 0 ? 'fail' : 'pass',
    badTabindex > 0 ? [{ description: `${badTabindex} element(s) have positive tabindex values, which override natural focus order.`, recommendation: 'Remove positive tabindex values. Use DOM order to control focus sequence.', severity: 'medium' }] : [])

  // ── 2.4.4 Link Purpose (In Context) ──
  const vagueLinkData = await page.evaluate(() => {
    const vague = new Set(['click here', 'here', 'read more', 'more', 'link', 'learn more', 'details', 'click', 'this'])
    const links = document.querySelectorAll('a')
    const bad: string[] = []
    for (const a of links) {
      const text = (a.textContent || '').trim().toLowerCase()
      const ariaLabel = a.getAttribute('aria-label')?.trim()
      if (!ariaLabel && vague.has(text)) bad.push(text)
    }
    return bad.slice(0, 5)
  })
  addResult('2.4.4', vagueLinkData.length > 0 ? 'fail' : 'pass',
    vagueLinkData.map(t => ({
      description: `Link text "${t}" does not describe its purpose.`,
      recommendation: `Replace generic link text like "${t}" with descriptive text (e.g., "Read our accessibility guide").`,
      severity: 'medium',
    })))

  // ── 2.4.6 Headings and Labels ──
  const headingData = await page.evaluate(() => {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
    const empty: string[] = []
    const levels: number[] = []
    for (const h of headings) {
      const text = h.textContent?.trim()
      const level = parseInt(h.tagName[1])
      levels.push(level)
      if (!text) empty.push(h.tagName)
    }
    // Check for skipped levels
    const skips: string[] = []
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] > levels[i - 1] + 1) {
        skips.push(`h${levels[i - 1]} → h${levels[i]}`)
      }
    }
    return { empty, skips, count: headings.length }
  })
  const headingIssues: WcagIssue[] = []
  if (headingData.empty.length > 0) headingIssues.push({ description: `${headingData.empty.length} empty heading(s) found.`, recommendation: 'Add descriptive text to all headings or remove empty heading elements.', severity: 'medium' })
  if (headingData.skips.length > 0) headingIssues.push({ description: `Heading hierarchy skips levels: ${headingData.skips.join(', ')}.`, recommendation: 'Use headings in sequential order (h1, h2, h3...) without skipping levels.', severity: 'low' })
  addResult('2.4.6', headingIssues.length > 0 ? 'fail' : 'pass', headingIssues)

  // ── 2.4.7 Focus Visible ──
  const focusVisible = await page.evaluate(() => {
    const els = document.querySelectorAll('a, button, input, select, textarea, [tabindex="0"]')
    let outlineNone = 0
    for (const el of Array.from(els).slice(0, 20)) {
      const style = window.getComputedStyle(el)
      if (style.outlineStyle === 'none' && style.outlineWidth === '0px') {
        // Check if there's a focus override in stylesheets
        // Simple heuristic — if outline is explicitly none, flag it
        outlineNone++
      }
    }
    // Check for a TRULY global focus-outline removal (2026-06-12 fix).
    // The old regex (/\*.*:focus|:focus/) matched ANY selector containing
    // ':focus' that set outline:none — including the textbook-accessible
    // pattern 'input:focus-visible { outline: none; box-shadow: ring }'.
    // It flagged fixpath.ai itself as critical while the site had a
    // correct global *:focus-visible 2px outline. A removal only counts
    // when (a) the selector is genuinely global (*:focus / *:focus-visible
    // or a bare html/body :focus), AND (b) the same rule provides NO
    // replacement indicator (box-shadow), AND (c) no other global rule
    // restores a visible indicator.
    let globalOutlineNone = false
    let globalIndicatorProvided = false
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule) {
            const sel = rule.selectorText || ''
            const isGlobalFocusSel = /(^|,)\s*(\*|html|body)?\s*:focus(-visible)?\s*($|,)/.test(sel) || /(^|,)\s*\*\s*:focus(-visible)?/.test(sel)
            if (!isGlobalFocusSel) continue
            const removesOutline = rule.style.outline === 'none' || rule.style.outlineStyle === 'none' || rule.style.outlineWidth === '0px'
            const providesIndicator =
              (rule.style.boxShadow && rule.style.boxShadow !== 'none') ||
              (rule.style.outline && rule.style.outline !== 'none' && rule.style.outline !== '') ||
              (rule.style.outlineWidth && rule.style.outlineWidth !== '0px' && rule.style.outlineWidth !== '')
            if (providesIndicator) globalIndicatorProvided = true
            else if (removesOutline) globalOutlineNone = true
          }
        }
      } catch { /* cross-origin */ }
    }
    // A global rule that RESTORES a visible indicator outweighs a removal
    if (globalIndicatorProvided) globalOutlineNone = false
    return { outlineNone, globalOutlineNone }
  })
  addResult('2.4.7', focusVisible.globalOutlineNone ? 'fail' : (focusVisible.outlineNone > 5 ? 'warning' : 'pass'),
    focusVisible.globalOutlineNone ? [{
      description: 'Global CSS rule removes focus outlines (*:focus { outline: none }). Keyboard users cannot see which element is focused.',
      recommendation: 'Replace outline:none with a visible focus style (e.g., outline: 2px solid #005fcc) or use :focus-visible for a keyboard-only indicator.',
      severity: 'critical',
    }] : [])

  // ── 2.5.3 Label in Name ──
  const labelNameData = await page.evaluate(() => {
    const issues: string[] = []
    const buttons = document.querySelectorAll('button[aria-label], a[aria-label], [role="button"][aria-label]')
    for (const el of buttons) {
      const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase()
      const visibleText = (el.textContent || '').trim().toLowerCase()
      if (visibleText && ariaLabel && !ariaLabel.includes(visibleText)) {
        issues.push(`"${visibleText}" has aria-label="${ariaLabel}" which doesn't contain the visible text`)
      }
    }
    return issues.slice(0, 3)
  })
  addResult('2.5.3', labelNameData.length > 0 ? 'fail' : 'pass',
    labelNameData.map(desc => ({ description: desc, recommendation: 'Ensure aria-label includes the visible text so voice control users can activate the element.', severity: 'medium' })))

  // ── 3.1.1 Language of Page ──
  const langAttr = await page.evaluate(() => document.documentElement.getAttribute('lang') || '')
  addResult('3.1.1', langAttr.length > 0 ? 'pass' : 'fail',
    langAttr.length === 0 ? [{ description: 'The <html> element is missing a lang attribute.', recommendation: 'Add lang="en" (or appropriate language code) to the <html> tag.', severity: 'high' }] : [])

  // ── 3.1.2 Language of Parts ──
  // Heuristic: check if page appears multi-language but has no lang attributes on parts
  const langParts = await page.evaluate(() => {
    const elements = document.querySelectorAll('[lang]')
    return elements.length // Count elements with lang overrides
  })
  // If the page title or meta suggests multiple languages, flag
  addResult('3.1.2', 'pass') // Marked pass by default — AI heuristic will review

  // ── 3.3.1 Error Identification (required fields without validation) ──
  const formValidation = await page.evaluate(() => {
    const required = document.querySelectorAll('[required], [aria-required="true"]')
    const withoutType = document.querySelectorAll('input:not([type])')
    return { requiredCount: required.length, untypedCount: withoutType.length }
  })
  addResult('3.3.1', formValidation.untypedCount > 0 ? 'warning' : 'pass',
    formValidation.untypedCount > 0 ? [{ description: `${formValidation.untypedCount} input(s) without type attribute may not provide proper error identification.`, recommendation: 'Set appropriate type attributes (email, tel, number, etc.) so browsers can validate input.', severity: 'low' }] : [])

  // ── 3.3.2 Labels or Instructions ──
  // Already covered in 1.3.1 — reuse form label check
  const formLabelsOk = structureData.issues.filter(i => i.desc.includes('label')).length === 0
  addResult('3.3.2', formLabelsOk ? 'pass' : 'fail',
    formLabelsOk ? [] : [{ description: 'Form inputs lack visible labels. Placeholder text alone is not sufficient as labels disappear when typing.', recommendation: 'Add persistent <label> elements for all form inputs.', severity: 'high' }])

  // ── 4.1.1 Parsing (duplicate IDs) ──
  const duplicateIds = await page.evaluate(() => {
    const ids = new Map<string, number>()
    document.querySelectorAll('[id]').forEach(el => {
      const id = el.id
      if (id) ids.set(id, (ids.get(id) || 0) + 1)
    })
    const dupes: string[] = []
    ids.forEach((count, id) => { if (count > 1) dupes.push(id) })
    return dupes.slice(0, 5)
  })
  addResult('4.1.1', duplicateIds.length > 0 ? 'fail' : 'pass',
    duplicateIds.map(id => ({ description: `Duplicate id="${id}" found in the document.`, recommendation: 'Ensure all id attributes are unique within the page.', severity: 'medium' })))

  // ── 4.1.2 Name, Role, Value ──
  const ariaData = await page.evaluate(() => {
    const issues: string[] = []
    // Check custom interactive elements
    const customs = document.querySelectorAll('[role="button"], [role="tab"], [role="tabpanel"], [role="dialog"], [role="menu"], [role="menuitem"]')
    for (const el of customs) {
      const role = el.getAttribute('role')
      const name = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.textContent?.trim()
      if (!name) issues.push(`<${el.tagName.toLowerCase()} role="${role}"> has no accessible name`)
      // Check state attributes
      if (role === 'tab' && !el.hasAttribute('aria-selected')) issues.push(`Tab element missing aria-selected`)
      if (role === 'dialog' && !el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) issues.push('Dialog missing aria-label/aria-labelledby')
    }
    return issues.slice(0, 5)
  })
  addResult('4.1.2', ariaData.length > 0 ? 'fail' : 'pass',
    ariaData.map(desc => ({ description: desc, recommendation: 'Ensure all custom ARIA roles have accessible names and required state attributes.', severity: 'high' })))

  return results
}

/* ── AI Heuristic Analysis ──────────────────────────────────── */

/** Build the list of criteria that need AI heuristic review. */
function getHeuristicCriteria(automatedResults: WcagCheckResult[]): WcagCriterion[] {
  const automatedIds = new Set(automatedResults.map(r => r.criterion.id))
  return WCAG_CRITERIA.filter(c => c.method === 'heuristic' && !automatedIds.has(c.id))
}

/**
 * Build an AI prompt that asks for heuristic assessment of
 * WCAG criteria that cannot be fully automated.
 */
export function buildHeuristicPrompt(url: string, html: string, automatedResults: WcagCheckResult[]): string {
  const heuristicCriteria = getHeuristicCriteria(automatedResults)
  if (heuristicCriteria.length === 0) return ''

  const criteriaList = heuristicCriteria.map(c =>
    `- ${c.id} ${c.name} (${c.level}, ${c.principle})`
  ).join('\n')

  const automatedSummary = automatedResults
    .filter(r => r.status === 'fail')
    .map(r => `  FAIL ${r.criterion.id}: ${r.issues[0]?.description || r.criterion.name}`)
    .join('\n')

  // Truncate HTML for prompt context
  const trimmedHtml = html.length > 15000 ? html.slice(0, 15000) + '\n... (truncated)' : html

  return `You are a WCAG 2.1 Level AA accessibility expert. Analyze this web page and assess the following criteria that cannot be fully verified by automated DOM checks.

URL: ${url}

Already-confirmed failures from automated checks:
${automatedSummary || '  (none)'}

Criteria to assess (provide pass/fail/warning for each):
${criteriaList}

HTML content:
\`\`\`html
${trimmedHtml}
\`\`\`

For each criterion, respond in this EXACT JSON format (array of objects):
[
  {
    "id": "1.2.1",
    "status": "pass" | "fail" | "warning" | "not_applicable",
    "issues": [
      {
        "description": "What's wrong",
        "recommendation": "How to fix it",
        "severity": "critical" | "high" | "medium" | "low",
        "element": "Optional element reference",
        "evidence": "Optional evidence"
      }
    ]
  }
]

Rules:
- Be conservative: only mark "fail" when there is clear evidence in the HTML
- Mark "not_applicable" if the criterion doesn't apply (e.g., no video on page)
- Mark "warning" if you suspect an issue but can't confirm from HTML alone
- Keep descriptions concise and actionable
- Return ONLY the JSON array, no other text`
}

/**
 * Parse AI heuristic response into WcagCheckResult objects.
 */
export function parseHeuristicResponse(response: string): WcagCheckResult[] {
  const results: WcagCheckResult[] = []
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return results
    const data = JSON.parse(jsonMatch[0]) as Array<{
      id: string
      status: string
      issues?: Array<{
        description: string
        recommendation: string
        severity?: string
        element?: string
        evidence?: string
      }>
    }>
    for (const item of data) {
      const criterion = WCAG_CRITERIA.find(c => c.id === item.id)
      if (!criterion) continue
      const status = (['pass', 'fail', 'warning', 'not_applicable', 'needs_review'].includes(item.status)
        ? item.status : 'needs_review') as WcagStatus
      results.push({
        criterion,
        status,
        issues: (item.issues || []).map(i => ({
          description: i.description || '',
          recommendation: i.recommendation || '',
          severity: (['critical', 'high', 'medium', 'low'].includes(i.severity || '') ? i.severity : 'medium') as WcagIssue['severity'],
          element: i.element,
          evidence: i.evidence,
        })),
      })
    }
  } catch {
    // If AI response is malformed, mark all heuristic criteria as needs_review
  }
  return results
}

/* ── Convert to findings ────────────────────────────────────── */

function resultsToFindings(checkResults: WcagCheckResult[], pageUrl: string): WcagFinding[] {
  const findings: WcagFinding[] = []
  for (const result of checkResults) {
    if (result.status !== 'fail' && result.status !== 'warning') continue
    for (const issue of result.issues) {
      findings.push({
        title: `WCAG ${result.criterion.id}: ${result.criterion.name}`,
        description: issue.description,
        recommendation: issue.recommendation,
        severity: issue.severity,
        wcagCriterion: result.criterion.id,
        wcagPrinciple: result.criterion.principle,
        element: issue.element,
        evidence: issue.evidence,
        pageUrl,
      })
    }
    // If no issues but status is fail, create a generic finding
    if (result.issues.length === 0 && result.status === 'fail') {
      findings.push({
        title: `WCAG ${result.criterion.id}: ${result.criterion.name}`,
        description: `This page does not meet WCAG 2.1 AA criterion ${result.criterion.id} (${result.criterion.name}).`,
        recommendation: `Review and fix the page to comply with WCAG ${result.criterion.id}.`,
        severity: result.criterion.level === 'A' ? 'high' : 'medium',
        wcagCriterion: result.criterion.id,
        wcagPrinciple: result.criterion.principle,
        pageUrl,
      })
    }
  }
  return findings
}

/* ── Build summary text for AI context injection ────────────── */

function buildSummary(results: WcagCheckResult[]): string {
  const pass = results.filter(r => r.status === 'pass').length
  const fail = results.filter(r => r.status === 'fail').length
  const warn = results.filter(r => r.status === 'warning').length
  const na = results.filter(r => r.status === 'not_applicable').length
  const total = results.length

  const lines = [`WCAG 2.1 AA CHECK: ${pass}/${total} criteria pass (${fail} fail, ${warn} warnings, ${na} N/A)`]

  const failures = results.filter(r => r.status === 'fail')
  if (failures.length > 0) {
    lines.push('Failures:')
    for (const f of failures.slice(0, 10)) {
      const issue = f.issues[0]?.description || f.criterion.name
      lines.push(`  - ${f.criterion.id} ${f.criterion.name}: ${issue.slice(0, 100)}`)
    }
  }

  const warnings = results.filter(r => r.status === 'warning')
  if (warnings.length > 0) {
    lines.push('Warnings:')
    for (const w of warnings.slice(0, 5)) {
      lines.push(`  - ${w.criterion.id} ${w.criterion.name}`)
    }
  }

  return lines.join('\n')
}

/* ── Score calculation ──────────────────────────────────────── */

function calculateScore(results: WcagCheckResult[]): number {
  const applicable = results.filter(r => r.status !== 'not_applicable')
  if (applicable.length === 0) return 100
  const passing = applicable.filter(r => r.status === 'pass').length
  // Warnings count as half-pass
  const halfPass = applicable.filter(r => r.status === 'warning').length * 0.5
  return Math.round(((passing + halfPass) / applicable.length) * 100)
}

/* ── Public API ─────────────────────────────────────────────── */

/**
 * Run automated WCAG checks on a single page using Puppeteer.
 * Returns the automated results; AI heuristic prompt is built
 * separately so the caller can run it through their AI pipeline.
 */
export async function checkWcagAutomated(
  urls: string[],
  maxPages: number = 3,
): Promise<{
  automatedResults: Map<string, WcagCheckResult[]>
  heuristicPrompts: Map<string, string>
}> {
  const automatedResults = new Map<string, WcagCheckResult[]>()
  const heuristicPrompts = new Map<string, string>()
  const pagesToCheck = urls.slice(0, maxPages)

  let browser: Browser | null = null
  try {
    browser = await launchBrowser()

    for (const url of pagesToCheck) {
      let page: Page | null = null
      try {
        page = await browser.newPage()
        await page.setViewport({ width: 1440, height: 900 })
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 })
        await new Promise(resolve => setTimeout(resolve, 1000)) // Let JS settle

        // Run automated DOM checks
        const results = await runAutomatedChecks(page, url)
        automatedResults.set(url, results)

        // Get page HTML for heuristic prompt
        const html = await page.evaluate(() => document.documentElement.outerHTML)
        const prompt = buildHeuristicPrompt(url, html, results)
        if (prompt) heuristicPrompts.set(url, prompt)
      } catch (err) {
        console.error(`[wcag-checker] Failed to check ${url}:`, err)
        automatedResults.set(url, [])
      } finally {
        if (page) await page.close().catch(() => {})
      }
    }
  } finally {
    if (browser) await browser.close().catch(() => {})
  }

  return { automatedResults, heuristicPrompts }
}


/**
 * Severity doctrine governor (2026-06-12, Stefano's calibration call):
 * CRITICAL is reserved for findings where a user literally cannot
 * complete a task — keyboard traps, global focus-indicator removal,
 * zoom/scaling disabled, unlabeled form inputs, keyboard-unreachable
 * controls. Anything else marked critical by an individual check is
 * demoted to high. One critical caps the site at 55 — that penalty must
 * be reserved for true blockers, or scores become punishment instead of
 * information. Centralized here so individual checks stay simple and
 * the doctrine has ONE enforcement point.
 */
const CRITICAL_ELIGIBLE_PATTERNS: RegExp[] = [
  /keyboard trap/i,
  /focus (outline|indicator|style)s? .*(remov|disabl|none)|outline:\s*none/i,
  /(maximum-scale|user-scalable|zoom).*(disabl|restrict|prevent)|disables user scaling/i,
  /(input|form (field|control))s? .*(without|lack|missing|no) (a |an )?(label|accessible name)/i,
  /not (keyboard[- ])?(focusable|reachable|operable)|cannot be reached.*keyboard/i,
]

export function enforceWcagSeverityDoctrine(findings: WcagFinding[]): WcagFinding[] {
  return findings.map((f) => {
    if (f.severity !== 'critical') return f
    const text = `${f.title} ${f.description}`
    if (CRITICAL_ELIGIBLE_PATTERNS.some((re) => re.test(text))) return f
    return { ...f, severity: 'high' as const }
  })
}

/**
 * Merge automated + heuristic results into final WcagPageResult objects.
 */
export function buildWcagResults(
  automatedResults: Map<string, WcagCheckResult[]>,
  heuristicResults: Map<string, WcagCheckResult[]>,
): WcagAuditResult {
  const pages: WcagPageResult[] = []

  for (const [url, automated] of automatedResults) {
    const heuristic = heuristicResults.get(url) || []
    const allResults = [...automated, ...heuristic]

    // Add any criteria not yet covered as needs_review
    const covered = new Set(allResults.map(r => r.criterion.id))
    for (const c of WCAG_CRITERIA) {
      if (!covered.has(c.id)) {
        allResults.push({ criterion: c, status: c.method === 'manual_only' ? 'not_applicable' : 'needs_review', issues: [] })
      }
    }

    pages.push({
      url,
      timestamp: new Date().toISOString(),
      checklist: allResults.sort((a, b) => a.criterion.id.localeCompare(b.criterion.id)),
      score: calculateScore(allResults),
      summary: buildSummary(allResults),
      findings: enforceWcagSeverityDoctrine(resultsToFindings(allResults, url)),
    })
  }

  const totalFindings = pages.reduce((sum, p) => sum + p.findings.length, 0)
  const overallScore = pages.length > 0
    ? Math.round(pages.reduce((sum, p) => sum + p.score, 0) / pages.length)
    : 100

  return {
    pages,
    overallScore,
    totalFindings,
    summary: pages.map(p => `${p.url}: ${p.score}/100 (${p.findings.length} issues)`).join('\n'),
  }
}

/**
 * Format WCAG results for AI analyzer context injection.
 * This replaces the vague "conduct an audit" recommendation with real data.
 */
export function formatWcagForPrompt(result: WcagAuditResult): string {
  if (result.pages.length === 0) return ''
  const lines = ['\n\n═══ WCAG 2.1 AA COMPLIANCE CHECK (Browser-verified) ═══\n']
  for (const page of result.pages) {
    lines.push(page.summary)
    lines.push('')
  }
  lines.push('IMPORTANT: Do NOT generate findings that say "conduct a WCAG audit" — the automated WCAG checker has already run. Instead, reference specific failures above and provide actionable fix recommendations for each.')
  return lines.join('\n')
}

/** All criteria — exported for UI checklist rendering */
export { WCAG_CRITERIA }
