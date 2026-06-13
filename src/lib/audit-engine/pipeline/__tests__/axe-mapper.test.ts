// ============================================================
// axe-core mapper tests (Phase 1, item 1)
// ============================================================
// Doctrine under test: deterministic findings, WCAG-doctrine severity (no
// axe-minted 'critical'), real selectors + evidence, criterion parsed from
// tags, capped + sorted.

import {
  mapAxeViolationsToFindings,
  mapAxeImpact,
  wcagCriterionFromTags,
  type AxeViolation,
} from '../axe-mapper'

describe('mapAxeImpact', () => {
  it('never mints a Fixpath critical from an axe impact', () => {
    expect(mapAxeImpact('critical')).toBe('high')
    expect(mapAxeImpact('serious')).toBe('high')
    expect(mapAxeImpact('moderate')).toBe('medium')
    expect(mapAxeImpact('minor')).toBe('low')
    expect(mapAxeImpact(null)).toBe('low')
    expect(mapAxeImpact(undefined)).toBe('low')
  })
})

describe('wcagCriterionFromTags', () => {
  it('parses wcagNNN tags into dotted criteria', () => {
    expect(wcagCriterionFromTags(['cat.color', 'wcag2aa', 'wcag143'])).toBe('1.4.3')
    expect(wcagCriterionFromTags(['wcag111'])).toBe('1.1.1')
  })
  it('returns null when no wcag tag present', () => {
    expect(wcagCriterionFromTags(['cat.forms', 'best-practice'])).toBeNull()
    expect(wcagCriterionFromTags(undefined)).toBeNull()
  })
})

const violation = (over: Partial<AxeViolation>): AxeViolation => ({
  id: 'color-contrast',
  impact: 'serious',
  help: 'Elements must have sufficient colour contrast',
  description: 'Ensures the contrast between foreground and background meets WCAG AA.',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/color-contrast',
  tags: ['wcag2aa', 'wcag143'],
  nodes: [{ target: ['.hero > p'], html: '<p>hi</p>' }],
  ...over,
})

describe('mapAxeViolationsToFindings', () => {
  it('maps a violation to a deterministic, evidenced finding', () => {
    const [f] = mapAxeViolationsToFindings([violation({})], 'https://x.com/')
    expect(f.detectionSource).toBe('axe')
    expect(f.confidenceLevel).toBe('deterministic')
    expect(f.severity).toBe('high') // serious → high
    expect(f.categoryIndex).toBe(20) // Accessibility Readiness
    expect(f.title).toMatch(/^\[WCAG 1\.4\.3\]/)
    expect(f.targetElement).toBe('.hero > p')
    expect(f.evidence).toMatch(/1 element affected/)
    expect(f.evidence).toMatch(/\.hero > p/)
  })

  it('caps evidence selectors and reports the overflow count', () => {
    const nodes = Array.from({ length: 7 }, (_, i) => ({ target: [`.item-${i}`] }))
    const [f] = mapAxeViolationsToFindings([violation({ nodes })], 'https://x.com/', { maxNodesInEvidence: 3 })
    expect(f.evidence).toMatch(/7 elements affected/)
    expect(f.evidence).toMatch(/\+4 more/)
  })

  it('drops violations with no affected nodes (no evidence = no finding)', () => {
    expect(mapAxeViolationsToFindings([violation({ nodes: [] })], 'https://x.com/')).toHaveLength(0)
  })

  it('sorts highest-severity first and caps total findings', () => {
    const vs = [
      violation({ id: 'minor-rule', impact: 'minor', nodes: [{ target: ['.a'] }] }),
      violation({ id: 'serious-rule', impact: 'serious', nodes: [{ target: ['.b'] }] }),
      violation({ id: 'moderate-rule', impact: 'moderate', nodes: [{ target: ['.c'] }] }),
    ]
    const out = mapAxeViolationsToFindings(vs, 'https://x.com/', { maxFindings: 2 })
    expect(out).toHaveLength(2)
    expect(out[0].severity).toBe('high')   // serious first
    expect(out[1].severity).toBe('medium') // then moderate; minor dropped by cap
  })
})
