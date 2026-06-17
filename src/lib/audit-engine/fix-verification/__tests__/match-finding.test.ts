// ============================================================
// Phase 3 — fix verification core tests
// Doctrine under test: never a false "verified_fixed". Claim fixed only on a
// reliable identity + clean re-check; reopen only on a positive re-match;
// otherwise inconclusive.
// ============================================================

import {
  parseWcagCriterion,
  parseSchemaType,
  selectorsOverlap,
  matchKeys,
  hasReliableIdentity,
  classifyFixOutcome,
  originalMatchKey,
  buildFixOutcomeRow,
  type MatchKey,
} from '../match-finding'

describe('parsers', () => {
  it('parses a WCAG criterion from a finding title', () => {
    expect(parseWcagCriterion('[WCAG 1.4.3] Elements must meet minimum color contrast')).toBe('1.4.3')
    expect(parseWcagCriterion('WCAG 2.1.1: Keyboard')).toBe('2.1.1')
    expect(parseWcagCriterion('No criterion here')).toBeNull()
    expect(parseWcagCriterion(null)).toBeNull()
  })
  it('parses a schema.org type from a structured-data title', () => {
    expect(parseSchemaType('No Organization structured data found')).toBe('Organization')
    expect(parseSchemaType('Missing LocalBusiness markup')).toBe('LocalBusiness')
    expect(parseSchemaType('something else')).toBeNull()
  })
})

describe('selectorsOverlap', () => {
  it('matches equal/contained selectors, tolerant of whitespace/case', () => {
    expect(selectorsOverlap('.login > .account-btn', '.LOGIN  >  .account-btn')).toBe(true)
    expect(selectorsOverlap('.login > .account-btn > span', '.account-btn')).toBe(true)
    expect(selectorsOverlap('.btn-a', '.btn-b')).toBe(false)
    expect(selectorsOverlap(null, '.x')).toBe(false)
  })
})

const k = (over: Partial<MatchKey>): MatchKey => ({ source: 'axe', key: null, selector: null, metric: null, ...over })

describe('matchKeys', () => {
  it('matches same source + same rule id', () => {
    expect(matchKeys(k({ key: '1.4.3' }), k({ key: '1.4.3' }))).toBe(true)
  })
  it('does not match across different sources', () => {
    expect(matchKeys(k({ source: 'axe', key: '1.4.3' }), k({ source: 'wcag_checker', key: '1.4.3' }))).toBe(false)
  })
  it('requires selector overlap when both carry a selector', () => {
    expect(matchKeys(k({ key: '1.4.3', selector: '.a' }), k({ key: '1.4.3', selector: '.b' }))).toBe(false)
    expect(matchKeys(k({ key: '1.4.3', selector: '.a' }), k({ key: '1.4.3', selector: '.a' }))).toBe(true)
  })
  it('matches on rule id alone when only one side has a selector', () => {
    expect(matchKeys(k({ key: '1.4.3' }), k({ key: '1.4.3', selector: '.a' }))).toBe(true)
  })
  it('matches pagespeed by metric', () => {
    expect(matchKeys(k({ source: 'pagespeed_api', metric: 'lcp' }), k({ source: 'pagespeed_api', metric: 'lcp' }))).toBe(true)
  })
})

describe('classifyFixOutcome — the tri-state', () => {
  const orig = k({ source: 'axe', key: '1.4.3', selector: '.login > span' })

  it('verified_fixed: reliable id + clean re-check (no match)', () => {
    expect(classifyFixOutcome(orig, [k({ source: 'axe', key: '4.1.2', selector: '.btn' })], { instrumentRan: true }))
      .toBe('verified_fixed')
    expect(classifyFixOutcome(orig, [], { instrumentRan: true })).toBe('verified_fixed')
  })
  it('not_fixed: a fresh finding still matches', () => {
    expect(classifyFixOutcome(orig, [k({ source: 'axe', key: '1.4.3', selector: '.login > span' })], { instrumentRan: true }))
      .toBe('not_fixed')
  })
  it('inconclusive: instrument did not run', () => {
    expect(classifyFixOutcome(orig, [], { instrumentRan: false })).toBe('inconclusive')
  })
  it('inconclusive: original has no reliable identity (never falsely fixed or reopened)', () => {
    const unkeyed = k({ source: 'responsive_checker', key: null, metric: null })
    expect(classifyFixOutcome(unkeyed, [], { instrumentRan: true })).toBe('inconclusive')
  })
  it('selector change on the same rule reads as fixed (that specific element no longer fails)', () => {
    const fresh = [k({ source: 'axe', key: '1.4.3', selector: '.different-element' })]
    expect(classifyFixOutcome(orig, fresh, { instrumentRan: true })).toBe('verified_fixed')
  })
})

describe('originalMatchKey', () => {
  it('keys axe/wcag by criterion + selector', () => {
    expect(originalMatchKey({ detection_source: 'axe', title: '[WCAG 1.4.3] contrast', target_element: '.x' }))
      .toEqual({ source: 'axe', key: '1.4.3', selector: '.x', metric: null })
  })
  it('keys pagespeed by its (stable) title, keeps metric for context', () => {
    expect(originalMatchKey({ detection_source: 'pagespeed_api', performance_metric_type: 'tbt', title: 'Unused JavaScript loaded on page' }))
      .toEqual({ source: 'pagespeed_api', key: 'unused javascript loaded on page', selector: null, metric: 'tbt' })
  })
  it('keys structured-data by schema type', () => {
    expect(originalMatchKey({ detection_source: 'structured_data', title: 'No Organization structured data found' }))
      .toEqual({ source: 'structured_data', key: 'Organization', selector: null, metric: null })
  })
  it('leaves responsive unkeyed (→ inconclusive, never a false verdict)', () => {
    const mk = originalMatchKey({ detection_source: 'responsive_checker', title: '10 touch targets too small', target_element: null })
    expect(hasReliableIdentity(mk)).toBe(false)
  })
})

describe('buildFixOutcomeRow', () => {
  const finding = {
    id: 'f1', audit_id: 'a1', page_url: 'https://x.com/', detection_source: 'axe',
    severity: 'high', evidence: '9 elements affected', issue_family_id: 'fam1',
    created_at: '2026-06-10T00:00:00.000Z',
  }
  it('computes time-to-fix for a concluded outcome', () => {
    const row = buildFixOutcomeRow({
      finding, workspaceId: 'w1', userId: 'u1', outcome: 'verified_fixed',
      evidenceAfter: '0 contrast violations', markedFixedAt: '2026-06-12T00:00:00.000Z',
      verifiedAt: '2026-06-12T00:00:30.000Z',
    })
    expect(row.outcome).toBe('verified_fixed')
    expect(row.severity_before).toBe('high')
    expect(row.evidence_before).toBe('9 elements affected')
    expect(row.evidence_after).toBe('0 contrast violations')
    expect(row.time_to_fix_seconds).toBe(2 * 86400 + 30) // 2 days + 30s
    expect(row.recheck_method).toBe('single_page_instrument')
  })
  it('omits time-to-fix when inconclusive', () => {
    const row = buildFixOutcomeRow({
      finding, workspaceId: 'w1', userId: 'u1', outcome: 'inconclusive',
      evidenceAfter: null, markedFixedAt: '2026-06-12T00:00:00.000Z', verifiedAt: '2026-06-12T00:00:30.000Z',
    })
    expect(row.time_to_fix_seconds).toBeNull()
  })
  it('only writes contracted keys (no stray fields)', () => {
    const row = buildFixOutcomeRow({
      finding, workspaceId: 'w1', userId: 'u1', outcome: 'not_fixed',
      evidenceAfter: 'still 9 violations', markedFixedAt: null, verifiedAt: '2026-06-12T00:00:30.000Z',
    })
    expect(Object.keys(row).sort()).toEqual([
      'audit_id', 'detection_source', 'evidence_after', 'evidence_before', 'finding_id',
      'issue_family_id', 'marked_fixed_at', 'outcome', 'page_url', 'recheck_meta',
      'recheck_method', 'severity_before', 'time_to_fix_seconds', 'user_id', 'verified_at', 'workspace_id',
    ])
  })
})
