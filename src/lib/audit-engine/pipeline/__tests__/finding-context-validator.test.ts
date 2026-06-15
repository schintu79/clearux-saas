// ============================================================
// Page-level contextual finding validator — Phase 1 tests
// ============================================================
// Covers the raseedinvest false-positive classes with a STUBBED model caller
// (no network): stale headline, pricing fee boxes, FAQ title+answers, false
// desktop nav, readOnly/display-only inputs, the keep path (no false
// suppression), the deterministic prefilter (zero model calls), and the audit
// trail. Also pins the structural safety doctrine: verdicts can only weaken.

import {
  buildPageContextIndex,
  groupFindingsByPage,
  pageNeedsValidation,
  parseValidationVerdicts,
  applyVerdicts,
  isValidLowering,
  detectRegionCues,
  validateFindingsInPageContext,
  type ValidatorFinding,
  type ValidationVerdict,
  type ValidatorModelCaller,
} from '../finding-context-validator'
import type { SiteProfile } from '../../analyzer'
import type { DomFacts } from '../dom-verification'

/* ── Fixtures ─────────────────────────────────────────────── */

const PROFILE: SiteProfile = {
  industryVertical: 'FinTech / Investing',
  targetAudience: 'GCC retail investors',
  audienceSophistication: 'general',
  communicationStyle: 'clear, trustworthy',
  marketPosition: 'challenger',
  contextNotes: 'Regulated trading app for the GCC region.',
}

const STALE_HEADLINE = 'Trade 14,000+ US Stocks & ETFs — Built for the GCC'
const NEW_HEADLINE = 'Start Trading US Stocks from Just $1 — No Hidden Fees'

/** A re-audit preamble whose PREVIOUS FINDINGS quote the STALE headline, plus
 * fresh page bodies that use the NEW headline. */
function reauditPageContent(): string {
  const preamble =
    'SITE MAP — What exists across ALL crawled pages\n' +
    '  [1] https://raseedinvest.com/en\n\n' +
    `PREVIOUS FINDINGS (1 total):\n  [OPEN] "Homepage headline ${STALE_HEADLINE} doesn't lead with fees" (high)\n\n` +
    'RULES FOR RE-AUDIT:\n- [OPEN] findings: re-report if still present.\n'
  const home =
    `URL: https://raseedinvest.com/en\nTitle: Raseed\nH1: ${NEW_HEADLINE}\n` +
    `Meta Description: Invest from $1\nContent: ${NEW_HEADLINE}. Zero commission. $1 minimum. No hidden fees. Built for the GCC.`
  const pricing =
    `URL: https://raseedinvest.com/en/pricing\nTitle: Pricing\nH1: Trade smarter. Pay less.\n` +
    `Content: Trade smarter. Pay less. Commission: $0 on US stocks & ETFs. FX fee: 0.5% per conversion. Max fee cap: $3 per trade. No hidden charges.`
  const support =
    `URL: https://raseedinvest.com/en/support\nTitle: Support\nH1: Frequently Asked Questions\n` +
    `Content: Frequently Asked Questions. Q: How do I open an account? A: Tap Sign Up, enter your Emirates ID, upload proof of address, verification completes in 1-2 business days. Q: What are the fees? A: $0 commission; 0.5% FX; $3 max cap.`
  return `${preamble}\n\n${home}\n---\n${pricing}\n---\n${support}`
}

const fullDom = (over: Partial<DomFacts> = {}): DomFacts => ({
  landmarks: { main: true, nav: 1, header: true, footer: true, skipLink: true },
  headings: [1, 2, 2],
  forms: { totalControls: 2, labeledControls: 2, requiredMarked: 1 },
  links: [{ text: 'Pricing', href: '/en/pricing' }],
  langAttr: 'en',
  viewportMeta: true,
  ...over,
})

const f = (over: Partial<ValidatorFinding>): ValidatorFinding => ({
  id: 'f1',
  title: '',
  description: '',
  severity: 'high',
  page_url: 'https://raseedinvest.com/en',
  confidence_level: 'interpretive',
  detection_source: 'analyzer',
  ...over,
})

/** A model caller that returns canned verdicts keyed by finding id. */
function stubCaller(verdicts: Record<string, Partial<ValidationVerdict>>): ValidatorModelCaller {
  return async ({ user }) => {
    // Echo only ids that actually appear in the prompt (mimics a real model
    // judging the findings it was shown).
    const arr = Object.entries(verdicts)
      .filter(([id]) => user.includes(`id=${id}`))
      .map(([id, v]) => ({ id, verdict: v.verdict, reason: v.reason || 'stub', newSeverity: v.newSeverity }))
    return JSON.stringify(arr)
  }
}

/* ── isValidLowering ──────────────────────────────────────── */

describe('isValidLowering — only strict downgrades to known severities', () => {
  test('high→medium and critical→low are valid lowerings', () => {
    expect(isValidLowering('high', 'medium')).toBe(true)
    expect(isValidLowering('critical', 'low')).toBe(true)
  })
  test('raising or same-level is rejected', () => {
    expect(isValidLowering('medium', 'high')).toBe(false)
    expect(isValidLowering('high', 'high')).toBe(false)
    expect(isValidLowering('low', 'critical')).toBe(false)
  })
  test('unknown severities are rejected', () => {
    expect(isValidLowering('high', 'banana')).toBe(false)
    expect(isValidLowering('weird', 'low')).toBe(false)
  })
})

/* ── region cues ──────────────────────────────────────────── */

describe('detectRegionCues', () => {
  test('detects GCC and UAE cues from body text', () => {
    const cues = detectRegionCues('Built for the GCC. Enter your Emirates ID to verify.')
    expect(cues).toContain('GCC')
    expect(cues).toContain('UAE')
  })
})

/* ── buildPageContextIndex: stale baseline never current evidence ── */

describe('buildPageContextIndex — current bodies only, stale baseline excluded', () => {
  test('stale headline (only in PREVIOUS FINDINGS preamble) is NOT in any page context body', () => {
    const idx = buildPageContextIndex(reauditPageContent(), null, PROFILE)
    const home = idx.get('https://raseedinvest.com/en')
    expect(home).toBeDefined()
    // The current homepage uses the NEW headline...
    expect(home!.bodyText).toContain(NEW_HEADLINE)
    // ...and the stale baseline headline must NOT appear as current evidence.
    expect(home!.bodyText).not.toContain(STALE_HEADLINE)
  })

  test('each crawled URL becomes its own page context with headings + region cues', () => {
    const idx = buildPageContextIndex(reauditPageContent(), null, PROFILE)
    expect([...idx.keys()].sort()).toEqual([
      'https://raseedinvest.com/en',
      'https://raseedinvest.com/en/pricing',
      'https://raseedinvest.com/en/support',
    ])
    const support = idx.get('https://raseedinvest.com/en/support')!
    expect(support.headings).toContain('Frequently Asked Questions')
    // FAQ answer text (not just the title) is in the page body context.
    expect(support.bodyText).toContain('upload proof of address')
    const home = idx.get('https://raseedinvest.com/en')!
    expect(home.regionCues).toContain('GCC')
  })

  test('attaches per-url DOM facts when provided', () => {
    const domByUrl = new Map<string, DomFacts>([['https://raseedinvest.com/en', fullDom()]])
    const idx = buildPageContextIndex(reauditPageContent(), domByUrl, PROFILE)
    expect(idx.get('https://raseedinvest.com/en')!.dom).not.toBeNull()
    expect(idx.get('https://raseedinvest.com/en/pricing')!.dom).toBeNull()
  })

  test('brand-style content with no URL: marker yields an empty index', () => {
    const idx = buildPageContextIndex('[Brand file]\nOur voice is bold.', null, PROFILE)
    expect(idx.size).toBe(0)
  })
})

/* ── prefilter ────────────────────────────────────────────── */

describe('pageNeedsValidation — skip all-verified-deterministic pages', () => {
  test('a page with only verified deterministic findings does NOT need validation', () => {
    const findings = [
      f({ id: 'd1', confidence_level: 'deterministic', detection_source: 'wcag' }),
      f({ id: 'd2', confidence_level: 'deterministic', detection_source: 'responsive' }),
    ]
    expect(pageNeedsValidation(findings)).toBe(false)
  })
  test('a page with any interpretive/heuristic finding DOES need validation', () => {
    const findings = [
      f({ id: 'd1', confidence_level: 'deterministic', detection_source: 'wcag' }),
      f({ id: 'a1', confidence_level: 'interpretive', detection_source: 'analyzer' }),
    ]
    expect(pageNeedsValidation(findings)).toBe(true)
  })
  test('empty page needs no validation', () => {
    expect(pageNeedsValidation([])).toBe(false)
  })
})

/* ── parse verdicts ───────────────────────────────────────── */

describe('parseValidationVerdicts — fail-safe parsing', () => {
  const findings = [f({ id: 'f1' }), f({ id: 'f2' })]
  test('parses well-formed verdicts restricted to known ids', () => {
    const raw = JSON.stringify([
      { id: 'f1', verdict: 'suppress', reason: 'answered' },
      { id: 'f2', verdict: 'keep', reason: 'real' },
      { id: 'unknown', verdict: 'suppress', reason: 'ignored' },
    ])
    const v = parseValidationVerdicts(raw, findings)
    expect(v.map((x) => x.id).sort()).toEqual(['f1', 'f2'])
  })
  test('malformed / non-array output yields no verdicts (→ findings default to keep)', () => {
    expect(parseValidationVerdicts('not json', findings)).toEqual([])
    expect(parseValidationVerdicts('{"id":"f1"}', findings)).toEqual([])
  })
  test('unknown verdict strings are dropped', () => {
    const raw = JSON.stringify([{ id: 'f1', verdict: 'delete-it-all', reason: 'x' }])
    expect(parseValidationVerdicts(raw, findings)).toEqual([])
  })
})

/* ── applyVerdicts: structural safety (never raise/invent) ── */

describe('applyVerdicts — subtractive/softening only', () => {
  test('a "lower" with a RAISED severity is refused — finding kept, never raised', () => {
    const findings = [f({ id: 'f1', severity: 'medium' })]
    const verdicts: ValidationVerdict[] = [{ id: 'f1', verdict: 'lower', reason: 'x', newSeverity: 'critical' }]
    const r = applyVerdicts(findings, verdicts)
    expect(r.severityUpdates).toEqual([])
    expect(r.auditTrail[0].action).toBe('kept')
  })
  test('a valid "lower" is applied with from/to in the trail', () => {
    const findings = [f({ id: 'f1', severity: 'high' })]
    const r = applyVerdicts(findings, [{ id: 'f1', verdict: 'lower', reason: 'partial', newSeverity: 'low' }])
    expect(r.severityUpdates).toEqual([{ id: 'f1', severity: 'low' }])
    expect(r.auditTrail[0]).toMatchObject({ action: 'lowered', fromSeverity: 'high', toSeverity: 'low' })
  })
  test('needs_evidence demotes confidence, never deletes', () => {
    const findings = [f({ id: 'f1' })]
    const r = applyVerdicts(findings, [{ id: 'f1', verdict: 'needs_evidence', reason: 'unconfirmed' }])
    expect(r.confidenceDemotions).toEqual(['f1'])
    expect(r.idsToSuppress).toEqual([])
    expect(r.auditTrail[0].action).toBe('demoted')
  })
  test('a finding with no verdict is kept (fail-safe, never suppressed)', () => {
    const findings = [f({ id: 'f1' })]
    const r = applyVerdicts(findings, [])
    expect(r.idsToSuppress).toEqual([])
    expect(r.auditTrail[0].action).toBe('kept')
  })
})

/* ── End-to-end: raseedinvest examples via the orchestrator ── */

describe('validateFindingsInPageContext — raseedinvest false-positive classes', () => {
  const baseArgs = () => ({
    pageContent: reauditPageContent(),
    domByUrl: new Map<string, DomFacts>([
      ['https://raseedinvest.com/en', fullDom()],
      ['https://raseedinvest.com/en/pricing', fullDom()],
    ]),
    profile: PROFILE,
  })

  test('stale headline finding is suppressed', async () => {
    const findings = [
      f({
        id: 'stale',
        page_url: 'https://raseedinvest.com/en',
        title: `Homepage headline "${STALE_HEADLINE}" doesn't lead with fees`,
        description: `The H1 reads "${STALE_HEADLINE}" and never mentions pricing.`,
      }),
    ]
    const out = await validateFindingsInPageContext({
      ...baseArgs(),
      findings,
      callModel: stubCaller({ stale: { verdict: 'suppress', reason: 'stale: H1 now leads with $1/no fees' } }),
    })
    expect(out.idsToSuppress).toContain('stale')
    expect(out.pagesValidated).toBe(1)
    expect(out.auditTrail.find((e) => e.id === 'stale')!.action).toBe('suppressed')
  })

  test('pricing "headline doesn\'t explain fees" is suppressed (fee boxes below answer it)', async () => {
    const findings = [
      f({
        id: 'pricing',
        page_url: 'https://raseedinvest.com/en/pricing',
        severity: 'medium',
        title: 'Pricing headline does not explain fees',
        description: 'The H1 "Trade smarter. Pay less." does not state the actual fees.',
      }),
    ]
    const out = await validateFindingsInPageContext({
      ...baseArgs(),
      findings,
      callModel: stubCaller({ pricing: { verdict: 'suppress', reason: 'fee boxes state $0/0.5%/$3 cap directly below' } }),
    })
    expect(out.idsToSuppress).toContain('pricing')
  })

  test('FAQ "generic reassurance" finding is suppressed (real answers present)', async () => {
    const findings = [
      f({
        id: 'faq',
        page_url: 'https://raseedinvest.com/en/support',
        title: 'FAQ answers are generic reassurance',
        description: 'The FAQ only says "we\'re here to help" instead of actionable steps.',
      }),
    ]
    const out = await validateFindingsInPageContext({
      ...baseArgs(),
      findings,
      callModel: stubCaller({ faq: { verdict: 'suppress', reason: 'answers include Emirates ID + proof of address steps' } }),
    })
    expect(out.idsToSuppress).toContain('faq')
  })

  test('false desktop-nav finding is routed for validation and suppressed', async () => {
    // A deterministic-but-conflicting finding (0 visible nav links) — even though
    // it is deterministic, it conflicts with DOM facts that show a real header,
    // so it is interpretive-confidence here and DOES get validated.
    const findings = [
      f({
        id: 'nav',
        page_url: 'https://raseedinvest.com/en',
        title: 'Primary navigation hidden behind hamburger on desktop (1440px)',
        description: 'At 1440px only 0 visible navigation links in the header.',
        detection_source: 'responsive',
        confidence_level: 'heuristic',
      }),
    ]
    expect(pageNeedsValidation(findings)).toBe(true) // heuristic → validated
    const out = await validateFindingsInPageContext({
      ...baseArgs(),
      findings,
      callModel: stubCaller({ nav: { verdict: 'suppress', reason: 'DOM shows header with nav links at 1440px' } }),
    })
    expect(out.idsToSuppress).toContain('nav')
  })

  test('readOnly/display-only input label finding is suppressed', async () => {
    const findings = [
      f({
        id: 'label',
        page_url: 'https://raseedinvest.com/en/pricing',
        title: 'Form inputs lack visible labels',
        description: 'Inputs have placeholder-only labels.',
        detection_source: 'wcag',
        confidence_level: 'heuristic',
      }),
    ]
    const out = await validateFindingsInPageContext({
      ...baseArgs(),
      findings,
      callModel: stubCaller({ label: { verdict: 'suppress', reason: 'fields are read-only/auto-populated, not user input' } }),
    })
    expect(out.idsToSuppress).toContain('label')
  })

  test('KEEP PATH: a genuinely unanswered finding survives unchanged', async () => {
    const findings = [
      f({
        id: 'real',
        page_url: 'https://raseedinvest.com/en',
        severity: 'high',
        title: 'No phone number anywhere on the homepage',
        description: 'Users cannot find a contact phone number.',
      }),
    ]
    const out = await validateFindingsInPageContext({
      ...baseArgs(),
      findings,
      callModel: stubCaller({ real: { verdict: 'keep', reason: 'no phone number in the body' } }),
    })
    expect(out.idsToSuppress).toEqual([])
    expect(out.severityUpdates).toEqual([])
    expect(out.confidenceDemotions).toEqual([])
    expect(out.auditTrail.find((e) => e.id === 'real')!.action).toBe('kept')
  })

  test('PREFILTER: an all-verified-deterministic page makes ZERO model calls', async () => {
    let calls = 0
    const counting: ValidatorModelCaller = async () => {
      calls++
      return '[]'
    }
    const findings = [
      f({ id: 'd1', page_url: 'https://raseedinvest.com/en', detection_source: 'wcag', confidence_level: 'deterministic' }),
      f({ id: 'd2', page_url: 'https://raseedinvest.com/en', detection_source: 'responsive', confidence_level: 'deterministic' }),
    ]
    const out = await validateFindingsInPageContext({ ...baseArgs(), findings, callModel: counting })
    expect(calls).toBe(0)
    expect(out.pagesValidated).toBe(0)
    expect(out.pagesSkipped).toBe(1)
    expect(out.idsToSuppress).toEqual([])
  })

  test('NO CALLER: pure pass-through (nothing suppressed)', async () => {
    const findings = [f({ id: 'x', title: 'anything', description: 'anything' })]
    const out = await validateFindingsInPageContext({ ...baseArgs(), findings, callModel: undefined })
    expect(out.idsToSuppress).toEqual([])
    expect(out.pagesValidated).toBe(0)
  })

  test('NON-FATAL: a throwing caller leaves that page\'s findings unchanged', async () => {
    const throwing: ValidatorModelCaller = async () => {
      throw new Error('model exploded')
    }
    const findings = [f({ id: 'x', page_url: 'https://raseedinvest.com/en', title: 't', description: 'd' })]
    const out = await validateFindingsInPageContext({ ...baseArgs(), findings, callModel: throwing })
    expect(out.idsToSuppress).toEqual([])
    expect(out.pagesValidated).toBe(1) // it was attempted...
    expect(out.auditTrail).toEqual([]) // ...but produced no dispositions
  })

  test('a page with no current body (url not crawled) is skipped, never suppressed', async () => {
    const findings = [f({ id: 'orphan', page_url: 'https://raseedinvest.com/ghost', title: 't', description: 'd' })]
    let calls = 0
    const counting: ValidatorModelCaller = async () => {
      calls++
      return '[]'
    }
    const out = await validateFindingsInPageContext({ ...baseArgs(), findings, callModel: counting })
    expect(calls).toBe(0)
    expect(out.idsToSuppress).toEqual([])
    expect(out.pagesSkipped).toBe(1)
  })

  test('AUDIT TRAIL: every validated finding gets a disposition entry', async () => {
    const findings = [
      f({ id: 'a', page_url: 'https://raseedinvest.com/en', title: 'A', description: 'a' }),
      f({ id: 'b', page_url: 'https://raseedinvest.com/en', title: 'B', description: 'b' }),
    ]
    const out = await validateFindingsInPageContext({
      ...baseArgs(),
      findings,
      callModel: stubCaller({ a: { verdict: 'suppress', reason: 'x' }, b: { verdict: 'keep', reason: 'y' } }),
    })
    expect(out.auditTrail.map((e) => e.id).sort()).toEqual(['a', 'b'])
  })
})

/* ── grouping ─────────────────────────────────────────────── */

describe('groupFindingsByPage', () => {
  test('groups by page_url; null url buckets under empty string', () => {
    const groups = groupFindingsByPage([
      f({ id: '1', page_url: 'https://a.com' }),
      f({ id: '2', page_url: 'https://a.com' }),
      f({ id: '3', page_url: null }),
    ])
    expect(groups.get('https://a.com')!.map((x) => x.id)).toEqual(['1', '2'])
    expect(groups.get('')!.map((x) => x.id)).toEqual(['3'])
  })
})
