import {
  scoringSeverityCounts,
  applyScoringSeverityCap,
  isVerifiedEvidence,
  type ScorableFinding,
} from '../severity-cap'

const verified = (severity: string, finding_type?: string): ScorableFinding => ({
  severity, confidence_level: 'deterministic', confidence_score: 1, finding_type,
})
const ai = (severity: string, finding_type?: string): ScorableFinding => ({
  severity, confidence_level: 'heuristic', confidence_score: 0.75, finding_type,
})

describe('isVerifiedEvidence', () => {
  it('only deterministic + adequate confidence is Verified', () => {
    expect(isVerifiedEvidence({ severity: 'high', confidence_level: 'deterministic', confidence_score: 1 })).toBe(true)
    expect(isVerifiedEvidence({ severity: 'high', confidence_level: 'heuristic', confidence_score: 0.9 })).toBe(false)
    expect(isVerifiedEvidence({ severity: 'high', confidence_level: 'deterministic', confidence_score: 0.2 })).toBe(false)
  })
})

describe('scoringSeverityCounts — Verified drives, AI capped at medium, strategic excluded', () => {
  it('keeps Verified severities, caps AI at medium', () => {
    const counts = scoringSeverityCounts([
      verified('high'),     // stays high
      ai('high'),           // → medium
      ai('critical'),       // → medium
      verified('high', 'strategic'), // excluded
      { severity: 'high', confidence_level: 'deterministic', confidence_score: 0.2 }, // low-conf → not verified → medium
    ])
    expect(counts).toEqual({ critical: 0, high: 1, medium: 3 })
  })

  it('a wall of AI highs can never trip the high cap', () => {
    const counts = scoringSeverityCounts([ai('high'), ai('high'), ai('high'), ai('critical')])
    expect(counts.high).toBe(0)
    expect(counts.critical).toBe(0)
    expect(counts.medium).toBe(4)
  })

  it('Verified criticals/highs still count fully', () => {
    expect(scoringSeverityCounts([verified('critical'), verified('high'), verified('high')]))
      .toEqual({ critical: 1, high: 2, medium: 0 })
  })
})

describe('applyScoringSeverityCap — the fixpath case', () => {
  it('4 Verified highs + 4 AI highs → capped by 4 highs (72), not 8 (65)', () => {
    const findings = [
      verified('high'), verified('high'), verified('high'), verified('high'),
      ai('high'), ai('high'), ai('high'), ai('high'),
    ]
    const { overall, capInfo } = applyScoringSeverityCap(95, findings)
    expect(overall).toBe(72)        // 3–5 highs → 72 (was 65 under the old all-in count)
    expect(capInfo.applied).toBe(true)
  })

  it('clears the cap entirely when only AI findings remain', () => {
    const { overall, capInfo } = applyScoringSeverityCap(88, [ai('high'), ai('high')])
    expect(capInfo.applied).toBe(false) // 2 AI highs → 2 medium → no high cap
    expect(overall).toBe(88)
  })
})
