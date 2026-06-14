// ============================================================
// ClearUX Audit Engine — Responsive Design Checker
// Uses Puppeteer to render pages at multiple viewport widths
// and detect real layout issues that text analysis cannot catch.
// ============================================================
// PROPRIETARY — do not distribute outside the ClearUX codebase.
// ============================================================

import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { launchAuditBrowser } from '@/lib/audit-engine/browser-launcher'
import type { AnalysisFinding } from './analyzer'

/* ── Viewport definitions ────────────────────────────────── */

interface ViewportDef {
  name: string
  width: number
  height: number
  isMobile: boolean
  hasTouch: boolean
  deviceScaleFactor: number
}

const VIEWPORTS: ViewportDef[] = [
  { name: 'Mobile',        width: 375,  height: 812,  isMobile: true,  hasTouch: true,  deviceScaleFactor: 3 },
  { name: 'Tablet',        width: 768,  height: 1024, isMobile: true,  hasTouch: true,  deviceScaleFactor: 2 },
  { name: 'Small Desktop', width: 1024, height: 768,  isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  { name: 'Desktop',       width: 1440, height: 900,  isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
]

/* ── Types ───────────────────────────────────────────────── */

export interface ResponsiveCheckResult {
  url: string
  viewportIssues: ViewportIssue[]
  hasMobileViewport: boolean
  /** Summary for AI context injection */
  summary: string
}

interface ViewportIssue {
  viewport: string
  width: number
  type: ResponsiveIssueType
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string
  recommendation: string
  evidence?: string
  element?: string
}

type ResponsiveIssueType =
  | 'horizontal_overflow'
  | 'touch_target_small'
  | 'text_too_small'
  | 'missing_viewport_meta'
  | 'fixed_width_element'
  | 'image_overflow'
  | 'nav_not_adapted'
  | 'desktop_nav_hidden'
  | 'content_hidden'
  | 'overlapping_elements'
  | 'line_length_too_long'
  | 'content_too_dense'
  | 'poor_readability'

/* ── Browser management ──────────────────────────────────── */

async function launchBrowser(): Promise<Browser> {
  // Shared launcher (Plan §0.6) — real serverless error is reported, not swallowed
  return launchAuditBrowser({ viewport: null })
}

/* ── Page-level checks ───────────────────────────────────── */

interface PageCheckInput {
  page: Page
  viewport: ViewportDef
  url: string
}

/**
 * Run all layout checks on a page at a specific viewport.
 * Each check runs inside page.evaluate() for DOM access.
 */
async function runChecks({ page, viewport, url }: PageCheckInput): Promise<ViewportIssue[]> {
  const issues: ViewportIssue[] = []

  // ── 1. Check viewport meta tag ──
  const hasViewportMeta = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="viewport"]')
    return meta ? (meta as HTMLMetaElement).content : null
  })

  if (!hasViewportMeta && viewport.name === 'Mobile') {
    issues.push({
      viewport: viewport.name,
      width: viewport.width,
      type: 'missing_viewport_meta',
      severity: 'critical',
      title: 'Missing viewport meta tag',
      description:
        'The page does not include a <meta name="viewport"> tag. Without it, mobile browsers render the page at desktop width and scale it down, making text unreadable and interactions impossible without zooming.',
      recommendation:
        'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the <head> of every page.',
      element: '<head>',
    })
  }

  // ── 2. Check horizontal overflow ──
  const overflowData = await page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth
    const viewportWidth = window.innerWidth
    const overflow = docWidth - viewportWidth

    // Find elements causing overflow
    const culprits: string[] = []
    if (overflow > 10) {
      const all = document.querySelectorAll('body *')
      for (const el of all) {
        // Skip decorative / aria-hidden subtrees (e.g. animated UI mockups) —
        // they are illustrative, not content, and must not generate findings.
        if (el.closest('[aria-hidden="true"],[data-audit-ignore="true"]')) continue
        const rect = el.getBoundingClientRect()
        if (rect.right > viewportWidth + 5 && rect.width > 0) {
          const tag = el.tagName.toLowerCase()
          const cls = el.className ? `.${String(el.className).split(' ').slice(0, 2).join('.')}` : ''
          const id = el.id ? `#${el.id}` : ''
          culprits.push(`<${tag}${id}${cls}>`)
          if (culprits.length >= 3) break
        }
      }
    }

    return { overflow, culprits }
  })

  if (overflowData.overflow > 10 && (viewport.name === 'Mobile' || viewport.name === 'Tablet')) {
    issues.push({
      viewport: viewport.name,
      width: viewport.width,
      type: 'horizontal_overflow',
      severity: 'high',
      title: `Horizontal scroll detected at ${viewport.width}px viewport`,
      description:
        `The page is ${overflowData.overflow}px wider than the ${viewport.width}px viewport, causing unwanted horizontal scrolling on ${viewport.name.toLowerCase()} devices.` +
        (overflowData.culprits.length > 0 ? ` Overflow caused by: ${overflowData.culprits.join(', ')}.` : ''),
      recommendation:
        'Ensure all content fits within the viewport width. Common fixes: add max-width: 100% to images and containers, use overflow-x: hidden on the body, and replace fixed-width values with relative units (%, vw, rem).',
      element: overflowData.culprits[0] || undefined,
    })
  }

  // ── 3. Check touch targets (mobile/tablet only) ──
  if (viewport.isMobile) {
    const touchData = await page.evaluate(() => {
      const MIN_SIZE = 44 // WCAG 2.5.5 minimum
      const interactive = document.querySelectorAll(
        'a, button, input, select, textarea, [role="button"], [role="link"], [tabindex]'
      )
      const tooSmall: Array<{ tag: string; width: number; height: number; text: string }> = []

      for (const el of interactive) {
        // Skip decorative / aria-hidden subtrees (illustrative UI mockups).
        if (el.closest('[aria-hidden="true"],[data-audit-ignore="true"]')) continue
        const rect = el.getBoundingClientRect()
        // Skip hidden or zero-size elements
        if (rect.width === 0 || rect.height === 0) continue
        // Skip elements off-screen
        if (rect.top > 5000 || rect.bottom < 0) continue

        if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) {
          const tag = el.tagName.toLowerCase()
          const text = (el as HTMLElement).innerText?.trim()?.slice(0, 30) || ''
          tooSmall.push({
            tag,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            text,
          })
          if (tooSmall.length >= 10) break
        }
      }

      return { total: interactive.length, tooSmall }
    })

    if (touchData.tooSmall.length > 0) {
      const examples = touchData.tooSmall
        .slice(0, 3)
        .map((t) => `<${t.tag}> "${t.text}" (${t.width}x${t.height}px)`)
        .join('; ')
      const ratio = Math.round((touchData.tooSmall.length / Math.max(touchData.total, 1)) * 100)

      issues.push({
        viewport: viewport.name,
        width: viewport.width,
        type: 'touch_target_small',
        severity: ratio > 30 ? 'high' : 'medium',
        title: `${touchData.tooSmall.length} touch targets below 44x44px minimum at ${viewport.width}px`,
        description:
          `${touchData.tooSmall.length} of ${touchData.total} interactive elements (${ratio}%) are smaller than the WCAG 2.5.5 minimum of 44x44px on ${viewport.name.toLowerCase()} viewport. Examples: ${examples}.`,
        recommendation:
          'Increase the size of interactive elements to at least 44x44px on touch devices. Use min-height and min-width, or add padding to increase the tap area without changing visual design.',
        evidence: examples,
      })
    }
  }

  // ── 4. Check text readability ──
  if (viewport.isMobile) {
    const textData = await page.evaluate(() => {
      const MIN_FONT = 12 // px — minimum readable on mobile
      const all = document.querySelectorAll('p, li, span, a, td, th, label, div')
      const tooSmall: Array<{ tag: string; fontSize: string; text: string }> = []
      const checked = new Set<Element>()

      for (const el of all) {
        if (checked.has(el)) continue
        // Skip decorative / aria-hidden subtrees (illustrative UI mockups).
        if (el.closest('[aria-hidden="true"],[data-audit-ignore="true"]')) continue
        const rect = (el as HTMLElement).getBoundingClientRect()
        // Skip invisible or off-screen
        if (rect.width === 0 || rect.height === 0 || rect.top > 3000) continue

        const style = window.getComputedStyle(el)
        const fontSize = parseFloat(style.fontSize)
        const text = (el as HTMLElement).innerText?.trim()

        // Only flag text-containing elements
        if (!text || text.length < 3) continue
        // Skip if a child is already flagged
        if (el.children.length > 0) continue

        checked.add(el)

        if (fontSize < MIN_FONT) {
          tooSmall.push({
            tag: el.tagName.toLowerCase(),
            fontSize: style.fontSize,
            text: text.slice(0, 40),
          })
          if (tooSmall.length >= 8) break
        }
      }

      return { tooSmall }
    })

    if (textData.tooSmall.length >= 3) {
      const examples = textData.tooSmall
        .slice(0, 3)
        .map((t) => `<${t.tag}> "${t.text}" at ${t.fontSize}`)
        .join('; ')

      issues.push({
        viewport: viewport.name,
        width: viewport.width,
        type: 'text_too_small',
        severity: 'medium',
        title: `${textData.tooSmall.length} text elements below 12px on ${viewport.name.toLowerCase()}`,
        description:
          `${textData.tooSmall.length} text elements render below the 12px minimum for mobile readability at the ${viewport.width}px viewport. Examples: ${examples}.`,
        recommendation:
          'Ensure body text is at least 16px and secondary text is at least 12px on mobile. Use responsive font sizes with clamp() or media queries to scale text appropriately across breakpoints.',
        evidence: examples,
      })
    }
  }

  // ── 5. Check for fixed-width elements ──
  if (viewport.isMobile) {
    const fixedWidthData = await page.evaluate((vw: number) => {
      const issues: Array<{ tag: string; declaredWidth: string }> = []
      const all = document.querySelectorAll('div, section, main, article, aside, table, img')

      for (const el of all) {
        // Skip decorative / aria-hidden subtrees (illustrative UI mockups).
        if (el.closest('[aria-hidden="true"],[data-audit-ignore="true"]')) continue
        const rect = el.getBoundingClientRect()
        if (rect.width === 0) continue

        const style = window.getComputedStyle(el)
        const width = style.width

        // Flag elements with explicit pixel widths wider than viewport
        if (width.endsWith('px')) {
          const px = parseFloat(width)
          if (px > vw && rect.right > vw) {
            const tag = el.tagName.toLowerCase()
            const cls = el.className ? `.${String(el.className).split(' ')[0]}` : ''
            issues.push({ tag: `<${tag}${cls}>`, declaredWidth: width })
            if (issues.length >= 5) break
          }
        }
      }

      return issues
    }, viewport.width)

    if (fixedWidthData.length > 0) {
      const examples = fixedWidthData
        .map((e) => `${e.tag} (width: ${e.declaredWidth})`)
        .join('; ')

      issues.push({
        viewport: viewport.name,
        width: viewport.width,
        type: 'fixed_width_element',
        severity: 'high',
        title: `${fixedWidthData.length} elements with fixed widths exceeding ${viewport.width}px viewport`,
        description:
          `${fixedWidthData.length} element(s) use fixed pixel widths larger than the ${viewport.width}px viewport, breaking the layout on ${viewport.name.toLowerCase()} devices. Elements: ${examples}.`,
        recommendation:
          'Replace fixed pixel widths with max-width: 100%, percentage-based widths, or CSS grid/flexbox. For tables, add overflow-x: auto to a wrapper container.',
        evidence: examples,
      })
    }
  }

  // ── 6. Check image overflow ──
  const imageOverflow = await page.evaluate((vw: number) => {
    const images = document.querySelectorAll('img, video, iframe, svg')
    const overflowing: Array<{ tag: string; naturalWidth: number; renderedWidth: number }> = []

    for (const el of images) {
      // Skip decorative / aria-hidden subtrees (illustrative UI mockups).
      if (el.closest('[aria-hidden="true"],[data-audit-ignore="true"]')) continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0) continue
      if (rect.right > vw + 5) {
        overflowing.push({
          tag: el.tagName.toLowerCase(),
          naturalWidth: (el as HTMLImageElement).naturalWidth || Math.round(rect.width),
          renderedWidth: Math.round(rect.width),
        })
        if (overflowing.length >= 5) break
      }
    }

    return overflowing
  }, viewport.width)

  if (imageOverflow.length > 0 && (viewport.name === 'Mobile' || viewport.name === 'Tablet')) {
    issues.push({
      viewport: viewport.name,
      width: viewport.width,
      type: 'image_overflow',
      severity: 'medium',
      title: `${imageOverflow.length} media elements overflow the ${viewport.width}px viewport`,
      description:
        `${imageOverflow.length} image/video/iframe element(s) extend beyond the viewport width at ${viewport.width}px, causing horizontal scroll or cropping.`,
      recommendation:
        'Add max-width: 100% and height: auto to all images. For iframes and videos, use a responsive wrapper with aspect-ratio or the padding-bottom technique.',
    })
  }

  // ── 7. Check navigation adaptation ──
  if (viewport.name === 'Mobile') {
    const navData = await page.evaluate(() => {
      const navs = document.querySelectorAll('nav, [role="navigation"]')
      const hamburger = document.querySelector(
        '[aria-label*="menu" i], [aria-label*="nav" i], .hamburger, .menu-toggle, ' +
        '.mobile-menu, .nav-toggle, button[class*="menu"], button[class*="nav"]'
      )

      let visibleNavLinks = 0
      let totalNavLinks = 0

      for (const nav of navs) {
        const links = nav.querySelectorAll('a')
        totalNavLinks += links.length
        for (const link of links) {
          const rect = link.getBoundingClientRect()
          const style = window.getComputedStyle(link)
          if (rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden') {
            visibleNavLinks++
          }
        }
      }

      return {
        hasNav: navs.length > 0,
        hasHamburger: !!hamburger,
        visibleNavLinks,
        totalNavLinks,
      }
    })

    // Flag if desktop nav is fully visible on mobile (not collapsed)
    if (navData.hasNav && navData.visibleNavLinks > 5 && !navData.hasHamburger) {
      issues.push({
        viewport: viewport.name,
        width: viewport.width,
        type: 'nav_not_adapted',
        severity: 'high',
        title: 'Navigation not adapted for mobile — no hamburger/collapse menu detected',
        description:
          `The navigation shows ${navData.visibleNavLinks} links on the ${viewport.width}px mobile viewport without a hamburger menu or mobile-adapted navigation pattern. This typically causes overflow, truncation, or tiny tap targets.`,
        recommendation:
          'Implement a responsive navigation pattern: hamburger menu, bottom nav bar, or collapsible accordion. Use a media query at max-width: 768px to switch from horizontal to mobile navigation.',
      })
    }
  }

  // ── 7b. Check desktop navigation hidden behind hamburger ──
  // Fixpath Audit Bible: hiding primary nav behind a hamburger on desktop is a
  // STRUCTURAL issue for mainstream commercial/institutional sites. This check
  // detects that pattern at the Desktop viewport so the AI analyzer has a
  // browser-verified signal to evaluate against the site profile.
  if (viewport.name === 'Desktop' || viewport.name === 'Small Desktop') {
    const desktopNavData = await page.evaluate(() => {
      const navs = document.querySelectorAll('nav, [role="navigation"], header')
      const hamburger = document.querySelector(
        '[aria-label*="menu" i], [aria-label*="nav" i], .hamburger, .menu-toggle, ' +
        '.mobile-menu, .nav-toggle, button[class*="menu"], button[class*="nav"], ' +
        '[class*="hamburger"], [class*="burger"], [data-toggle="collapse"], ' +
        'button[aria-expanded], [class*="mobile-nav"], [class*="menu-btn"], ' +
        '[class*="menu-icon"], [class*="nav-icon"]'
      )

      let visibleNavLinks = 0
      let totalNavLinks = 0
      const visibleLinkTexts: string[] = []

      for (const nav of navs) {
        const links = nav.querySelectorAll('a[href]')
        totalNavLinks += links.length
        for (const link of links) {
          const rect = link.getBoundingClientRect()
          const style = window.getComputedStyle(link)
          if (rect.width > 0 && rect.height > 0
            && style.display !== 'none' && style.visibility !== 'hidden'
            && rect.top >= 0 && rect.top < 200) {
            // Only count links in the header region (top 200px)
            visibleNavLinks++
            const text = (link as HTMLAnchorElement).textContent?.trim()
            if (text && visibleLinkTexts.length < 10) visibleLinkTexts.push(text)
          }
        }
      }

      // Check if the hamburger button itself is visible on this viewport
      let hamburgerVisible = false
      if (hamburger) {
        const rect = (hamburger as HTMLElement).getBoundingClientRect()
        const style = window.getComputedStyle(hamburger as HTMLElement)
        hamburgerVisible = rect.width > 0 && rect.height > 0
          && style.display !== 'none' && style.visibility !== 'hidden'
      }

      return {
        hasNav: navs.length > 0,
        hasHamburger: !!hamburger,
        hamburgerVisible,
        visibleNavLinks,
        totalNavLinks,
        visibleLinkTexts,
      }
    })

    // Flag when desktop viewport shows a visible hamburger with very few visible nav links.
    // This is the Bible's core navigation rule: mainstream sites should show primary
    // navigation directly, not hide it behind a toggle on screens ≥1024px.
    if (desktopNavData.hasHamburger && desktopNavData.hamburgerVisible && desktopNavData.visibleNavLinks <= 2) {
      issues.push({
        viewport: viewport.name,
        width: viewport.width,
        type: 'desktop_nav_hidden',
        severity: 'high',
        title: `Primary navigation hidden behind hamburger menu on ${viewport.name.toLowerCase()} (${viewport.width}px)`,
        description:
          `At the ${viewport.width}px ${viewport.name.toLowerCase()} viewport, the site uses a hamburger/toggle menu with only ${desktopNavData.visibleNavLinks} visible navigation link(s) in the header. The remaining ${desktopNavData.totalNavLinks} link(s) are hidden behind the toggle. ` +
          `For mainstream commercial, institutional, and public-facing sites, this hides key pathways, delays orientation, and weakens first-impression clarity. ` +
          `Visible links: ${desktopNavData.visibleLinkTexts.join(', ') || 'none detected'}.`,
        recommendation:
          'Display primary navigation links directly in the desktop header bar. Reserve hamburger menus for mobile viewports (< 768px). ' +
          'Show key sections (e.g., spaces, services, pricing, contact, booking) as visible top-level links so users can scan the full offer immediately.',
        evidence: `Hamburger toggle detected; ${desktopNavData.visibleNavLinks} of ${desktopNavData.totalNavLinks} nav links visible at ${viewport.width}px`,
      })
    }
  }

  // ── 8. Check line length (readability) ──
  if (viewport.isMobile) {
    const lineLengthData = await page.evaluate((vw: number) => {
      const textElements = document.querySelectorAll('p, li, td, th, blockquote')
      const tooLong: Array<{ tag: string; chars: number; text: string }> = []

      for (const el of textElements) {
        // Skip decorative / aria-hidden subtrees (illustrative UI mockups).
        if (el.closest('[aria-hidden="true"],[data-audit-ignore="true"]')) continue
        const rect = (el as HTMLElement).getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0 || rect.top > 3000) continue

        const text = (el as HTMLElement).innerText?.trim()
        if (!text || text.length < 20) continue

        // Estimate characters per line: measure element width vs avg char width
        const style = window.getComputedStyle(el)
        const fontSize = parseFloat(style.fontSize)
        // Average char width ≈ 0.5 × font-size for most fonts
        const avgCharWidth = fontSize * 0.5
        const charsPerLine = Math.round(rect.width / avgCharWidth)

        // > 75 chars per line on mobile is a readability problem
        if (charsPerLine > 75) {
          tooLong.push({
            tag: el.tagName.toLowerCase(),
            chars: charsPerLine,
            text: text.slice(0, 50),
          })
          if (tooLong.length >= 5) break
        }
      }

      return { tooLong }
    }, viewport.width)

    if (lineLengthData.tooLong.length >= 2) {
      const examples = lineLengthData.tooLong
        .slice(0, 3)
        .map((t) => `<${t.tag}> ~${t.chars} chars/line`)
        .join('; ')

      issues.push({
        viewport: viewport.name,
        width: viewport.width,
        type: 'line_length_too_long',
        severity: 'medium',
        title: `Text lines exceed 75 characters on ${viewport.name.toLowerCase()} — reduced readability`,
        description:
          `${lineLengthData.tooLong.length} text blocks have lines exceeding 75 characters at the ${viewport.width}px viewport. Optimal mobile line length is 45-75 characters for comfortable reading. Elements: ${examples}.`,
        recommendation:
          'Add horizontal padding to text containers on mobile (at least 16px on each side). Use max-width on paragraph elements or adjust font size so lines stay within 45-75 characters.',
        evidence: examples,
      })
    }
  }

  // ── 9. Check content density / spacing ──
  if (viewport.isMobile) {
    const densityData = await page.evaluate(() => {
      const contentBlocks = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, ul, ol, table, form, section > div')
      let cramped = 0
      let checked = 0
      const crampedExamples: Array<{ tag: string; marginBottom: string }> = []

      for (const el of contentBlocks) {
        // Skip decorative / aria-hidden subtrees (illustrative UI mockups).
        if (el.closest('[aria-hidden="true"],[data-audit-ignore="true"]')) continue
        const rect = (el as HTMLElement).getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0 || rect.top > 3000) continue

        const text = (el as HTMLElement).innerText?.trim()
        if (!text || text.length < 10) continue

        checked++
        const style = window.getComputedStyle(el)
        const marginBottom = parseFloat(style.marginBottom)
        const paddingBottom = parseFloat(style.paddingBottom)
        const totalSpacing = marginBottom + paddingBottom

        // Less than 8px spacing between content blocks is cramped on mobile
        if (totalSpacing < 8) {
          cramped++
          if (crampedExamples.length < 5) {
            crampedExamples.push({
              tag: el.tagName.toLowerCase(),
              marginBottom: `${Math.round(totalSpacing)}px`,
            })
          }
        }
      }

      return { cramped, checked, crampedExamples }
    })

    const crampedRatio = densityData.checked > 0 ? densityData.cramped / densityData.checked : 0
    if (crampedRatio > 0.4 && densityData.cramped >= 4) {
      const examples = densityData.crampedExamples
        .slice(0, 3)
        .map((e) => `<${e.tag}> (spacing: ${e.marginBottom})`)
        .join('; ')

      issues.push({
        viewport: viewport.name,
        width: viewport.width,
        type: 'content_too_dense',
        severity: 'medium',
        title: `Content blocks are tightly packed on ${viewport.name.toLowerCase()} — poor visual breathing room`,
        description:
          `${densityData.cramped} of ${densityData.checked} content blocks (${Math.round(crampedRatio * 100)}%) have less than 8px spacing between them at the ${viewport.width}px viewport. Dense layouts are harder to scan and read on small screens. Examples: ${examples}.`,
        recommendation:
          'Increase vertical spacing between content blocks on mobile. Use at least 16px margin-bottom on paragraphs and 24px between sections. Consider using CSS gap in flex/grid layouts.',
        evidence: examples,
      })
    }
  }

  // ── 10. Check body text readability (14px+ recommended on mobile) ──
  if (viewport.isMobile) {
    const readabilityData = await page.evaluate(() => {
      const MIN_COMFORTABLE = 14 // px — comfortable reading on mobile
      const bodyElements = document.querySelectorAll('p, li, td, th, blockquote, label')
      const tooSmall: Array<{ tag: string; fontSize: string; text: string }> = []
      const checked = new Set<Element>()

      for (const el of bodyElements) {
        if (checked.has(el)) continue
        // Skip decorative / aria-hidden subtrees (illustrative UI mockups).
        if (el.closest('[aria-hidden="true"],[data-audit-ignore="true"]')) continue
        const rect = (el as HTMLElement).getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0 || rect.top > 3000) continue

        const text = (el as HTMLElement).innerText?.trim()
        if (!text || text.length < 10) continue

        // Skip children if parent already flagged
        if (el.children.length > 0) continue
        checked.add(el)

        const style = window.getComputedStyle(el)
        const fontSize = parseFloat(style.fontSize)

        // Between 12-14px: technically readable but not comfortable
        if (fontSize >= 12 && fontSize < MIN_COMFORTABLE) {
          tooSmall.push({
            tag: el.tagName.toLowerCase(),
            fontSize: style.fontSize,
            text: text.slice(0, 40),
          })
          if (tooSmall.length >= 8) break
        }
      }

      return { tooSmall }
    })

    if (readabilityData.tooSmall.length >= 4) {
      const examples = readabilityData.tooSmall
        .slice(0, 3)
        .map((t) => `<${t.tag}> "${t.text}" at ${t.fontSize}`)
        .join('; ')

      issues.push({
        viewport: viewport.name,
        width: viewport.width,
        type: 'poor_readability',
        severity: 'low',
        title: `Body text below 14px on ${viewport.name.toLowerCase()} — uncomfortable reading size`,
        description:
          `${readabilityData.tooSmall.length} body text elements render between 12-14px at the ${viewport.width}px viewport. While technically above the 12px minimum, body text below 14px causes eye strain on mobile devices. Examples: ${examples}.`,
        recommendation:
          'Set mobile body text to at least 16px (the browser default) for comfortable reading. Use responsive font sizes: font-size: clamp(16px, 4vw, 18px) adapts cleanly across mobile viewports.',
        evidence: examples,
      })
    }
  }

  return issues
}

/* ── Build summary for AI context ────────────────────────── */

function buildSummary(results: ResponsiveCheckResult[]): string {
  if (results.length === 0) return ''

  const lines: string[] = ['RESPONSIVE DESIGN CHECK — Browser-verified results:']

  for (const r of results) {
    if (r.viewportIssues.length === 0) {
      lines.push(`  ${r.url}: No responsive issues detected across all viewports.`)
    } else {
      lines.push(`  ${r.url}: ${r.viewportIssues.length} issue(s) detected:`)
      for (const issue of r.viewportIssues) {
        lines.push(`    - [${issue.severity.toUpperCase()}] ${issue.title}`)
      }
    }
    lines.push(`  Viewport meta tag: ${r.hasMobileViewport ? 'present' : 'MISSING'}`)
  }

  lines.push('')
  lines.push('These findings are BROWSER-VERIFIED — they come from actual rendering at each viewport width, not text inference.')

  return lines.join('\n')
}

/* ── Convert issues to audit findings ────────────────────── */

function issuesToFindings(results: ResponsiveCheckResult[]): AnalysisFinding[] {
  const findings: AnalysisFinding[] = []
  const seenTypes = new Set<string>()

  for (const result of results) {
    for (const issue of result.viewportIssues) {
      // Deduplicate: same issue type at different viewports → keep the worst one
      const dedupeKey = `${issue.type}:${result.url}`
      if (seenTypes.has(dedupeKey)) continue
      seenTypes.add(dedupeKey)

      findings.push({
        severity: issue.severity,
        title: issue.title,
        description: issue.description,
        recommendation: issue.recommendation,
        // 2026-06-12: severity words removed from impact copy — a LOW
        // finding was displaying 'Medium — affects...' in Why it matters,
        // contradicting its own badge. Impact text describes consequences;
        // the severity badge grades them.
        estimatedImpact: issue.type === 'missing_viewport_meta'
          ? 'Without a viewport meta tag, the entire mobile experience is broken.'
          : issue.type === 'horizontal_overflow'
          ? 'Horizontal scrolling is the #1 mobile usability complaint.'
          : issue.type === 'touch_target_small'
          ? 'Users will struggle to tap buttons and links accurately.'
          : issue.type === 'desktop_nav_hidden'
          ? 'Hiding primary navigation on desktop reduces discoverability, delays orientation, and weakens first-impression clarity.'
          : 'Makes the site harder to read and use on mobile devices.',
        targetElement: issue.element || null,
        pageUrl: result.url,
      })
    }
  }

  return findings
}

/* ── Main entry point ────────────────────────────────────── */

/**
 * Run responsive design checks on a list of URLs using Puppeteer.
 *
 * @param urls - URLs to check (typically from the crawl step)
 * @param maxUrls - Max URLs to check (default: 3 for performance)
 * @param timeoutMs - Timeout per page per viewport (default: 15s)
 * @returns Check results + converted findings ready for DB insertion
 */
export async function checkResponsiveDesign(
  urls: string[],
  maxUrls: number = 3,
  timeoutMs: number = 15_000,
): Promise<{
  results: ResponsiveCheckResult[]
  findings: AnalysisFinding[]
  summary: string
}> {
  const urlsToCheck = urls.slice(0, maxUrls)

  let browser: Browser | null = null
  const results: ResponsiveCheckResult[] = []

  try {
    browser = await launchBrowser()

    for (const url of urlsToCheck) {
      const page = await browser.newPage()
      const pageIssues: ViewportIssue[] = []
      let hasMobileViewport = false

      try {
        for (const vp of VIEWPORTS) {
          await page.setViewport({
            width: vp.width,
            height: vp.height,
            isMobile: vp.isMobile,
            hasTouch: vp.hasTouch,
            deviceScaleFactor: vp.deviceScaleFactor,
          })

          try {
            await page.goto(url, {
              waitUntil: 'networkidle2',
              timeout: timeoutMs,
            })

            // Small delay for CSS transitions / JS layout adjustments
            await new Promise((r) => setTimeout(r, 500))

            const issues = await runChecks({ page, viewport: vp, url })
            pageIssues.push(...issues)

            // Check viewport meta once (on mobile viewport)
            if (vp.name === 'Mobile') {
              const meta = await page.evaluate(() => {
                const m = document.querySelector('meta[name="viewport"]')
                return m ? (m as HTMLMetaElement).content : null
              })
              hasMobileViewport = !!meta
            }
          } catch (err) {
            console.warn(`[responsive-checker] Failed to check ${url} at ${vp.width}px:`, err)
          }
        }
      } finally {
        await page.close().catch(() => {})
      }

      const result: ResponsiveCheckResult = {
        url,
        viewportIssues: pageIssues,
        hasMobileViewport,
        summary: '',
      }
      results.push(result)
    }
  } finally {
    if (browser) await browser.close().catch(() => {})
  }

  const summary = buildSummary(results)
  for (const r of results) {
    r.summary = summary
  }

  return {
    results,
    findings: issuesToFindings(results),
    summary,
  }
}
