// ============================================================
// Trust-engine tests — interrogation metrics (Plan §0.2.2)
// ============================================================
// Single-source formulas behind AI Accuracy / Visibility /
// Sentiment on the intelligence page AND the overview card.

import {
  interrogationAccuracy,
  interrogationVisibility,
  interrogationSentiment,
  brandTokensFor,
} from '../interrogation-metrics'

const a = (accuracy: string | null, responseText: string | null = 'x'.repeat(60)) => ({
  accuracy,
  responseText,
})

describe('interrogationAccuracy', () => {
  it('weights Accurate=1, Partial=0.5, Inaccurate=0', () => {
    expect(interrogationAccuracy([a('Accurate'), a('Partial'), a('Inaccurate'), a('Accurate')]))
      .toBe(Math.round(((1 + 0.5 + 0 + 1) / 4) * 100)) // 63
  })
  it('is null with no graded answers (ungraded ≠ 0%)', () => {
    expect(interrogationAccuracy([a(null), a(null)])).toBeNull()
    expect(interrogationAccuracy([])).toBeNull()
  })
  it('ignores ungraded rows instead of counting them as failures', () => {
    expect(interrogationAccuracy([a('Accurate'), a(null)])).toBe(100)
  })
  it('is case-insensitive on grades', () => {
    expect(interrogationAccuracy([a('accurate'), a('PARTIAL')])).toBe(75)
  })
})

describe('brandTokensFor', () => {
  it('builds tokens from brand, domain, and domain stem', () => {
    expect(brandTokensFor('Fixpath', 'www.fixpath.ai')).toEqual(
      expect.arrayContaining(['fixpath', 'fixpath.ai']),
    )
  })
  it('drops short/empty tokens', () => {
    expect(brandTokensFor('', null)).toEqual([])
    // 'ab' (2 chars) and stem 'x' drop; 'x.io' (4 chars) survives
    expect(brandTokensFor('ab', 'x.io')).toEqual(['x.io'])
  })
})

describe('interrogationVisibility', () => {
  const tokens = brandTokensFor('Fixpath', 'fixpath.ai')
  const knows = a('Accurate', 'Fixpath is a website audit platform that helps teams find trust issues.')
  const refusal = a(null, "I don't have any information about fixpath.ai or what it offers to customers.")
  const unrelated = a(null, 'There are many website audit platforms available on the market today, with various features.')

  it('counts answers that mention the brand and are not refusals', () => {
    expect(interrogationVisibility([knows, knows], tokens)).toBe(100)
  })
  it('a brand mention inside a refusal does NOT count as visibility', () => {
    expect(interrogationVisibility([knows, refusal], tokens)).toBe(50)
  })
  it('answers that never mention the brand count against visibility', () => {
    expect(interrogationVisibility([knows, unrelated], tokens)).toBe(50)
  })
  it('null without brand tokens or answers', () => {
    expect(interrogationVisibility([knows], [])).toBeNull()
    expect(interrogationVisibility([], tokens)).toBeNull()
  })
  it('skips trivially short answers', () => {
    expect(interrogationVisibility([a(null, 'short')], tokens)).toBeNull()
  })
})

describe('interrogationSentiment', () => {
  it('requires >=3 tone markers — below that it refuses to invent a tone', () => {
    expect(interrogationSentiment([a(null, 'The platform is legitimate.')])).toBeNull()
    expect(interrogationSentiment([a(null, 'Some say it is legitimate, others urge caution.')])).toBeNull()
  })
  it('scores reassurance vs warning ratio', () => {
    const positive = a(null, 'It appears legitimate, regulated, and trusted by its users. Reliable option overall.')
    const negative = a(null, 'Several red flags: potential scam complaints, proceed with caution and avoid.')
    const posOnly = interrogationSentiment([positive])
    expect(posOnly).toBe(100)
    const mixed = interrogationSentiment([positive, negative])
    expect(mixed).toBeLessThan(60)
    expect(mixed).toBeGreaterThan(30)
  })
  it('null on empty input', () => {
    expect(interrogationSentiment([])).toBeNull()
  })
})
