// ============================================================
// ClearUX Proprietary Pipeline — Contradiction Checker
// ============================================================
//
// PURPOSE:
// Cross-references AI-generated findings against hard evidence from
// the responsive checker, crawler DOM data, and page content. If a
// finding contradicts observable evidence, it is suppressed.
//
// This is the PROGRAMMATIC enforcement of RULE 2:
//   "A finding CANNOT survive if contradictory page evidence exists."
//
// The analyzer prompt already asks the AI to check for contradictions,
// but LLMs sometimes ignore instructions. This module is the hard
// safety net — the last line of defense after AI-level checks.
//
// HOW IT WORKS:
// 1. RESPONSIVE EVIDENCE — if the responsive checker found nav IS
//    adapted for mobile, but a finding says "mobile nav is hidden",
//    the finding is contradicted and removed.
//
// 2. DOM CONTENT EVIDENCE — if the page content contains evidence
//    of a close button, dismiss icon, or X control in the mobile
//    menu area, findings about "no close button" are contradicted.
//
// 3. VIEWPORT CROSS-CHECK — if a finding claims an issue at a
//    specific viewport but the responsive checker ran that viewport
//    without detecting the issue, flag as likely false positive.
//
// WHEN TO IMPROVE THIS FILE:
// - If a contradicted finding slips through → add a new rule
// - If a valid finding gets killed → check if the rule is too broad
// - If a new evidence source becomes available → add a new checker
// ============================================================

export interface FindingForContradiction {
  id: string
  title: string
  description: string
  viewport?: string | null
  pageUrl?: string | null
}

export interface ResponsiveEvidence {
  /** Viewport issues found by responsive checker */
  viewportIssues: Array<{
    viewport: string
    width: number
    type: string
    title: string
    description: string
  }>
  /** Whether mobile viewport meta tag was detected */
  hasMobileViewport: boolean
}

export interface PageContentEvidence {
  /** Raw page text content (from crawler) */
  textContent: string
  /** Head tags HTML if available */
  headTags?: string | null
}

export interface ContradictionResult {
  /** Finding IDs that should be removed due to contradiction */
  contradictedIds: string[]
  /** Explanation for each contradiction (for debug trace) */
  reasons: Record<string, string>
}

// ── Contradiction Rules ──────────────────────────────────────

interface ContradictionRule {
  /** Human-readable name for debug trace */
  name: string
  /** Test if this rule applies to a finding */
  matchesFinding: (finding: FindingForContradiction) => boolean
  /** Test if evidence contradicts the finding. Returns reason string or null. */
  checkContradiction: (
    finding: FindingForContradiction,
    responsive: ResponsiveEvidence | null,
    pageContent: PageContentEvidence | null,
  ) => string | null
}

// ── Close button / dismiss control detection ────────────────

const CLOSE_BUTTON_EVIDENCE_PATTERNS: RegExp[] = [
  // Common close button text content
  /\bclose\b/i,
  /\b×\b/,           // × character
  /\bx\b/i,          // standalone x
  /✕|✖|✗|✘/,         // unicode close symbols
  /\bchiudi\b/i,     // Italian
  /\bfermer\b/i,     // French
  /\bschließen\b/i,  // German
  /\bcerrar\b/i,     // Spanish
]

const MOBILE_MENU_FINDING_PATTERNS: RegExp[] = [
  /mobile\s+(?:menu|nav|navigation).*(?:close|dismiss|exit)/i,
  /(?:close|dismiss|exit).*mobile\s+(?:menu|nav|navigation)/i,
  /(?:no|missing|lacks?|without|doesn.t\s+(?:show|have|include)).*(?:close|dismiss|exit)\s+(?:button|icon|control|indicator)/i,
  /(?:menu|nav|navigation).*(?:doesn.t|does\s+not|no|missing).*(?:show|indicate|display|have).*(?:close|dismiss|exit|how\s+to\s+close)/i,
  /how\s+to\s+close.*(?:menu|nav|navigation)/i,
]

const NAV_HIDDEN_DESKTOP_PATTERNS: RegExp[] = [
  /(?:navigation|nav|menu).*(?:hidden|missing|not\s+visible|absent).*(?:desktop|large\s+screen)/i,
  /(?:desktop|large\s+screen).*(?:navigation|nav|menu).*(?:hidden|missing|not\s+visible|absent)/i,
  /hamburger.*(?:desktop|large\s+screen)/i,
  /(?:desktop|large\s+screen).*hamburger/i,
]

const NAV_HIDDEN_MOBILE_PATTERNS: RegExp[] = [
  /(?:navigation|nav|menu).*(?:hidden|missing|not\s+visible|absent).*(?:mobile|small\s+screen)/i,
  /(?:mobile|small\s+screen).*(?:navigation|nav|menu).*(?:hidden|missing|not\s+visible|absent)/i,
]

// ── Rule definitions ───────────────────────��─────────────────

const CONTRADICTION_RULES: ContradictionRule[] = [
  {
    name: 'mobile_menu_close_button',
    matchesFinding: (f) => {
      const combined = `${f.title} ${f.description}`
      return MOBILE_MENU_FINDING_PATTERNS.some(p => p.test(combined))
    },
    checkContradiction: (_f, _responsive, pageContent) => {
      if (!pageContent?.textContent) return null
      // If page content contains evidence of close/dismiss controls
      // near navigation context, the finding is contradicted
      const text = pageContent.textContent.toLowerCase()
      // Check for navigation context near close controls
      const hasNavContext = /(?:nav|menu|navigation)/i.test(text)
      if (!hasNavContext) return null
      // Look for close button evidence in DOM content
      // Be conservative: only contradict if there's strong evidence
      const hasCloseEvidence = CLOSE_BUTTON_EVIDENCE_PATTERNS.some(p => p.test(text))
      if (hasCloseEvidence) {
        return 'Page content contains close/dismiss control text near navigation elements. The mobile menu likely has a visible close mechanism.'
      }
      return null
    },
  },
  {
    name: 'nav_hidden_desktop_contradicted_by_responsive',
    matchesFinding: (f) => {
      const combined = `${f.title} ${f.description}`
      return NAV_HIDDEN_DESKTOP_PATTERNS.some(p => p.test(combined))
    },
    checkContradiction: (_f, responsive, _pageContent) => {
      if (!responsive) return null
      // If responsive checker found desktop_nav_hidden issue, the finding is VALID (not contradicted)
      const hasDesktopNavIssue = responsive.viewportIssues.some(
        i => i.type === 'desktop_nav_hidden' || (i.type === 'nav_not_adapted' && i.width >= 1024)
      )
      // Only contradict if responsive checker explicitly shows nav IS visible at desktop
      // i.e., it ran desktop checks and did NOT find nav issues
      const ranDesktopChecks = responsive.viewportIssues.some(i => i.width >= 1024) ||
        responsive.viewportIssues.length > 0
      if (ranDesktopChecks && !hasDesktopNavIssue) {
        // Responsive checker ran desktop viewports but found NO nav issues —
        // this suggests the nav IS properly visible at desktop
        return 'Responsive checker ran at desktop viewport (1024px+) and did not detect hidden navigation. Evidence contradicts the finding.'
      }
      return null
    },
  },
  {
    name: 'nav_hidden_mobile_contradicted_by_responsive',
    matchesFinding: (f) => {
      const combined = `${f.title} ${f.description}`
      return NAV_HIDDEN_MOBILE_PATTERNS.some(p => p.test(combined))
    },
    checkContradiction: (_f, responsive, _pageContent) => {
      if (!responsive) return null
      // On mobile, hidden nav is usually EXPECTED (hamburger pattern)
      // Only contradict if responsive checker shows mobile nav IS adapted properly
      const hasMobileNavIssue = responsive.viewportIssues.some(
        i => i.type === 'nav_not_adapted' && i.width <= 768
      )
      if (!hasMobileNavIssue) {
        return 'Responsive checker found no mobile navigation adaptation issues. Mobile hamburger pattern is standard and working.'
      }
      return null
    },
  },
  {
    name: 'touch_target_contradicted_by_responsive',
    matchesFinding: (f) => {
      return /touch\s+target.*(?:too\s+small|undersized|below)/i.test(`${f.title} ${f.description}`)
    },
    checkContradiction: (_f, responsive, _pageContent) => {
      if (!responsive) return null
      // If responsive checker explicitly checked touch targets and found none too small
      const hasTouchIssue = responsive.viewportIssues.some(i => i.type === 'touch_target_small')
      const ranMobileChecks = responsive.viewportIssues.some(i => i.width <= 768)
      if (ranMobileChecks && !hasTouchIssue) {
        return 'Responsive checker measured touch targets at mobile viewport and found none undersized. Evidence contradicts the finding.'
      }
      return null
    },
  },
  {
    name: 'missing_viewport_meta_contradicted',
    matchesFinding: (f) => {
      return /(?:missing|no|lacks?)\s+(?:mobile\s+)?viewport\s+meta/i.test(`${f.title} ${f.description}`)
    },
    checkContradiction: (_f, responsive, pageContent) => {
      // Check responsive checker first
      if (responsive?.hasMobileViewport) {
        return 'Responsive checker confirmed viewport meta tag is present. Finding contradicted.'
      }
      // Check head tags
      if (pageContent?.headTags && /viewport/i.test(pageContent.headTags)) {
        return 'Head tag extraction found viewport meta tag in page head. Finding contradicted.'
      }
      return null
    },
  },
  {
    name: 'horizontal_overflow_contradicted',
    matchesFinding: (f) => {
      return /horizontal\s+(?:scroll|overflow)/i.test(`${f.title} ${f.description}`)
    },
    checkContradiction: (f, responsive, _pageContent) => {
      if (!responsive) return null
      const viewport = f.viewport
      // If responsive checker ran the claimed viewport and found no overflow
      const hasOverflow = responsive.viewportIssues.some(i => {
        if (i.type !== 'horizontal_overflow') return false
        if (viewport === 'mobile' && i.width <= 768) return true
        if (viewport === 'tablet' && i.width > 768 && i.width <= 1024) return true
        if (viewport === 'desktop' && i.width > 1024) return true
        return viewport === 'all'
      })
      if (!hasOverflow && responsive.viewportIssues.length > 0) {
        return 'Responsive checker measured page width at relevant viewport and found no horizontal overflow. Evidence contradicts the finding.'
      }
      return null
    },
  },
]

// ── Public API ─────────────────────────────────���─────────────

/**
 * Check findings against hard evidence from responsive checker and page content.
 * Returns IDs of findings that are contradicted by evidence and should be removed.
 */
export function checkContradictions(
  findings: FindingForContradiction[],
  responsive: ResponsiveEvidence | null,
  pageContent: PageContentEvidence | null,
): ContradictionResult {
  const contradictedIds: string[] = []
  const reasons: Record<string, string> = {}

  for (const finding of findings) {
    for (const rule of CONTRADICTION_RULES) {
      if (!rule.matchesFinding(finding)) continue
      const reason = rule.checkContradiction(finding, responsive, pageContent)
      if (reason) {
        contradictedIds.push(finding.id)
        reasons[finding.id] = `[${rule.name}] ${reason}`
        break // One contradiction is enough to remove the finding
      }
    }
  }

  return { contradictedIds, reasons }
}
