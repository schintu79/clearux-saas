// ============================================================
// Module categorizer tests (2026-06-12)
// ============================================================
// REGRESSION (audit 3b69d832): 12 carried findings with NULL
// category_index were counted into module cards by Overview's keyword
// fallback but vanished from Find & Fix's strict index filter —
// "you report issues but not showing." One categorizer, one truth.

import { moduleIndexFor, keywordModuleIndexFor, PHASE1_MODULES } from '../module-map'

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

describe('keywordModuleIndexFor (used by carry-forward healing)', () => {
  it('returns null when nothing matches — healing must never bake in a guess', () => {
    expect(keywordModuleIndexFor('Broken link on pricing page', 'Returns 404.')).toBeNull()
    expect(keywordModuleIndexFor(null, null)).toBeNull()
  })
  it('matches module words case-insensitively', () => {
    expect(keywordModuleIndexFor('DESIGN CONSISTENCY problems', 'Buttons differ across pages')).not.toBeNull()
  })
})
