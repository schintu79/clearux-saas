import {
  detectReauditResolvedFixes,
  isReauditVerifiable,
  normalizeUrl,
  type PriorFinding,
  type FreshFinding,
} from '../reaudit-fix-detection'

const base = {
  workspaceId: 'ws1',
  userId: 'u1',
  verifiedAt: '2026-06-18T00:00:00.000Z',
  newAuditId: 'new-audit',
}

function prior(overrides: Partial<PriorFinding> = {}): PriorFinding {
  return {
    id: 'p1',
    audit_id: 'old-audit',
    page_url: 'https://www.fixpath.ai/',
    detection_source: 'axe',
    confidence_level: 'deterministic',
    status: 'open',
    dismissed: false,
    severity: 'high',
    title: '[WCAG 1.4.3] Elements must meet minimum color contrast ratio thresholds',
    target_element: '.btn',
    issue_family_id: 'fam1',
    created_at: '2026-06-17T00:00:00.000Z',
    ...overrides,
  }
}

function fresh(overrides: Partial<FreshFinding> = {}): FreshFinding {
  return {
    page_url: 'https://www.fixpath.ai/',
    detection_source: 'axe',
    title: '[WCAG 1.4.3] Elements must meet minimum color contrast ratio thresholds',
    target_element: '.btn',
    ...overrides,
  }
}

describe('normalizeUrl', () => {
  it('strips trailing slash and www so prior/fresh/coverage line up', () => {
    expect(normalizeUrl('https://www.fixpath.ai/')).toBe('https://fixpath.ai')
    expect(normalizeUrl('https://fixpath.ai')).toBe('https://fixpath.ai')
    expect(normalizeUrl('HTTPS://WWW.Fixpath.ai//')).toBe('https://fixpath.ai')
  })
})

describe('detectReauditResolvedFixes — happy path', () => {
  it('records verified_fixed when a prior open deterministic finding is gone on a covered page', () => {
    const out = detectReauditResolvedFixes({
      ...base,
      priorFindings: [prior()],
      freshFindings: [], // issue no longer present
      coveredPageUrls: ['https://fixpath.ai'],
    })
    expect(out).toHaveLength(1)
    expect(out[0].priorFindingId).toBe('p1')
    expect(out[0].row.outcome).toBe('verified_fixed')
    expect(out[0].row.recheck_method).toBe('reaudit_diff')
    expect(out[0].row.issue_family_id).toBe('fam1')
    expect(out[0].row.time_to_fix_seconds).toBeGreaterThan(0)
  })

  it('lines up despite www/trailing-slash differences between prior and coverage', () => {
    const out = detectReauditResolvedFixes({
      ...base,
      priorFindings: [prior({ page_url: 'https://www.fixpath.ai/' })],
      freshFindings: [],
      coveredPageUrls: ['https://fixpath.ai'], // different form, same page
    })
    expect(out).toHaveLength(1)
  })
})

describe('detectReauditResolvedFixes — never a false positive', () => {
  it('does NOT resolve when the issue is still present in the fresh audit', () => {
    const out = detectReauditResolvedFixes({
      ...base,
      priorFindings: [prior()],
      freshFindings: [fresh()], // same rule + selector still failing
      coveredPageUrls: ['https://fixpath.ai'],
    })
    expect(out).toHaveLength(0)
  })

  it('does NOT resolve when the page was not covered by the re-audit (coverage guard)', () => {
    const out = detectReauditResolvedFixes({
      ...base,
      priorFindings: [prior()],
      freshFindings: [],
      coveredPageUrls: [], // page never analyzed → inconclusive, not "gone"
    })
    expect(out).toHaveLength(0)
  })

  it('skips non-deterministic (AI) findings', () => {
    const out = detectReauditResolvedFixes({
      ...base,
      priorFindings: [prior({ confidence_level: 'heuristic' })],
      freshFindings: [],
      coveredPageUrls: ['https://fixpath.ai'],
    })
    expect(out).toHaveLength(0)
  })

  it('skips findings without a reliable rule identity (e.g. responsive_checker)', () => {
    const out = detectReauditResolvedFixes({
      ...base,
      priorFindings: [prior({ detection_source: 'responsive_checker', title: '3 elements exceed viewport' })],
      freshFindings: [],
      coveredPageUrls: ['https://fixpath.ai'],
    })
    expect(out).toHaveLength(0)
  })

  it('skips findings that are not open (already fixed/dismissed/deferred)', () => {
    expect(detectReauditResolvedFixes({
      ...base, priorFindings: [prior({ status: 'fixed' })], freshFindings: [], coveredPageUrls: ['https://fixpath.ai'],
    })).toHaveLength(0)
    expect(detectReauditResolvedFixes({
      ...base, priorFindings: [prior({ dismissed: true })], freshFindings: [], coveredPageUrls: ['https://fixpath.ai'],
    })).toHaveLength(0)
  })

  it('skips findings already recorded (dedup against a prior run / manual path)', () => {
    const out = detectReauditResolvedFixes({
      ...base,
      priorFindings: [prior()],
      freshFindings: [],
      coveredPageUrls: ['https://fixpath.ai'],
      alreadyRecordedFindingIds: ['p1'],
    })
    expect(out).toHaveLength(0)
  })

  it('a different element failing the same rule does NOT count as still-present', () => {
    // prior on .btn gone; fresh reports .header (same rule, different element) →
    // the .btn instance is genuinely gone → resolved.
    const out = detectReauditResolvedFixes({
      ...base,
      priorFindings: [prior({ target_element: '.btn' })],
      freshFindings: [fresh({ target_element: '.header' })],
      coveredPageUrls: ['https://fixpath.ai'],
    })
    expect(out).toHaveLength(1)
  })
})

describe('isReauditVerifiable', () => {
  it('is true only for open, non-dismissed, deterministic findings with a page + identity', () => {
    expect(isReauditVerifiable(prior())).toBe(true)
    expect(isReauditVerifiable(prior({ page_url: null }))).toBe(false)
    expect(isReauditVerifiable(prior({ confidence_level: 'deterministic', detection_source: 'pagespeed_api', title: 'Unused JavaScript loaded on page', target_element: null }))).toBe(true)
  })
})
