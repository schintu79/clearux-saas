// ============================================================
// Module categorizer tests (2026-06-12)
// ============================================================
// REGRESSION (audit 3b69d832): 12 carried findings with NULL
// category_index were counted into module cards by Overview's keyword
// fallback but vanished from Find & Fix's strict index filter —
// "you report issues but not showing." One categorizer, one truth.

import { moduleIndexFor, keywordModuleIndexFor, correctedCategoryIndexFor, PHASE1_MODULES } from '../module-map'

describe('moduleIndexFor', () => {
  it('explicit category_index wins, mapped 4-categories-per-module', () => {
    expect(moduleIndexFor(0)).toBe(0)   // Foundation
    expect(moduleIndexFor(3)).toBe(0)
    expect(moduleIndexFor(4)).toBe(1)   // Human Experience
    expect(moduleIndexFor(11)).toBe(2)  // Inclusive Design (responsive findings)
    expect(moduleIndexFor(12)).toBe(3)  // Future Readiness (pagespeed cat)
    expect(moduleIndexFor(27)).toBe(6)  // Design Consistency
  })

  it('clamps out-of-range explicit indices instead of dropping the finding', () => {
    expect(moduleIndexFor(999)).toBe(PHASE1_MODULES.length - 1)
  })

  it('REGRESSION: NULL index + accessibility wording lands in Accessibility Readiness, not a hidden bucket', () => {
    const idx = moduleIndexFor(null, 'Accessibility issues with form labels', 'Inputs lack accessible names for screen readers.')
    expect(PHASE1_MODULES[idx]).toBe('Accessibility Readiness')
  })

  it('NULL index + seo wording lands in SEO Structure & Rules', () => {
    const idx = moduleIndexFor(null, 'Missing meta description hurts SEO structure', 'Pages lack descriptions in search results.')
    expect(PHASE1_MODULES[idx]).toBe('SEO Structure & Rules')
  })

  it('NULL index + no keyword match falls back to Foundation (same catch-all Overview always used)', () => {
    expect(moduleIndexFor(null, 'Broken contact form', 'The form returns an error on submit.')).toBe(0)
    expect(moduleIndexFor(undefined, '', '')).toBe(0)
  })

  it('INVARIANT: every finding gets a real module — no -1, nothing invisible', () => {
    const cases: Array<[number | null, string]> = [
      [null, 'random title with no module words'],
      [null, ''],
      [0, 'x'], [13, 'y'], [27, 'z'],
    ]
    for (const [idx, title] of cases) {
      const m = moduleIndexFor(idx, title, null)
      expect(m).toBeGreaterThanOrEqual(0)
      expect(m).toBeLessThan(PHASE1_MODULES.length)
    }
  })
})

describe('correctedCategoryIndexFor (topical miscategorization net, 2026-06-12)', () => {
  // REGRESSION fixture: real finding c173c16e (fixpath.ai) — born during
  // 'On-Page SEO Fundamentals' (cat 16) when the LLM drifted off-topic,
  // rendered under the SEO module on the Find page.
  const securityTitle = 'Security and data handling transparency is minimal for a tool handling website audits'
  const securityDesc = 'Fixpath is a tool that analyzes client websites, which means it may access sensitive data (page content, user behavior patterns, potentially PII in forms or analytics).'

  it('REGRESSION: security-transparency finding in an SEO category moves to Trust (cat 5)', () => {
    expect(correctedCategoryIndexFor(16, securityTitle, securityDesc)).toBe(5)
    expect(PHASE1_MODULES[moduleIndexFor(5)]).toBe('Human Experience')
  })

  it('applies across all four SEO categories (16-19)', () => {
    for (const idx of [16, 17, 18, 19]) {
      expect(correctedCategoryIndexFor(idx, securityTitle, securityDesc)).toBe(5)
    }
  })

  it('does NOT move genuine SEO findings, even ones mentioning security', () => {
    expect(correctedCategoryIndexFor(16, 'Missing meta description on key pages',
      'Pages lack meta descriptions, hurting search engine result display.')).toBeNull()
    // Both signals present → SEO signal vetoes the move (e.g. HTTPS-for-ranking findings)
    expect(correctedCategoryIndexFor(17, 'Security headers affect search ranking',
      'Search engines factor HTTPS and security posture into ranking; the sitemap also lists http URLs.')).toBeNull()
  })

  it('does not touch findings outside SEO categories or with NULL index', () => {
    expect(correctedCategoryIndexFor(5, securityTitle, securityDesc)).toBeNull()
    expect(correctedCategoryIndexFor(0, securityTitle, securityDesc)).toBeNull()
    expect(correctedCategoryIndexFor(null, securityTitle, securityDesc)).toBeNull()
    expect(correctedCategoryIndexFor(undefined, securityTitle, securityDesc)).toBeNull()
  })
})

describe('keywordModuleIndexFor (used by carry-forward healing)', () => {
  it('returns null when nothing matches — healing must never bake in a guess', () => {
    expect(keywordModuleIndexFor('Broken link on pricing page', 'Returns 404.')).toBeNull()
    expect(keywordModuleIndexFor(null, null)).toBeNull()
  })
  it('matches module words case-insensitively', () => {
    expect(keywordModuleIndexFor('DESIGN CONSISTENCY problems', 'Buttons differ across pages')).not.toBeNull()
  })
})
