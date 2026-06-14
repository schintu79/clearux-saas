import {
  classifyDismissalReason,
  aggregateDismissals,
  tierOf,
  type DismissalRow,
} from '../eval/dismissal-telemetry'

describe('classifyDismissalReason', () => {
  it('flags "this is wrong / already present" as inaccurate (precision signal)', () => {
    expect(classifyDismissalReason('This is wrong, the page already has a <main>')).toBe('inaccurate')
    expect(classifyDismissalReason('false positive')).toBe('inaccurate')
    expect(classifyDismissalReason('the form does have labels')).toBe('inaccurate')
  })
  it('separates "valid but deprioritized" from noise', () => {
    expect(classifyDismissalReason("won't fix right now")).toBe('wont_fix')
    expect(classifyDismissalReason('by design')).toBe('wont_fix')
    expect(classifyDismissalReason('not relevant to us')).toBe('not_relevant')
    expect(classifyDismissalReason('duplicate of another finding')).toBe('duplicate')
  })
  it('defaults to other for empty/unknown', () => {
    expect(classifyDismissalReason('')).toBe('other')
    expect(classifyDismissalReason(null)).toBe('other')
    expect(classifyDismissalReason('hmm')).toBe('other')
  })
})

describe('tierOf', () => {
  it('maps instruments to verified, everything else to ai_assessed', () => {
    expect(tierOf('axe')).toBe('verified')
    expect(tierOf('responsive_checker')).toBe('verified')
    expect(tierOf('analyzer')).toBe('ai_assessed')
    expect(tierOf('gap_fill')).toBe('ai_assessed')
    expect(tierOf(null)).toBe('ai_assessed')
  })
})

describe('aggregateDismissals', () => {
  const rows: DismissalRow[] = [
    // axe: 2 findings, 0 dismissed
    { detection_source: 'axe', dismissed: false },
    { detection_source: 'axe', dismissed: false },
    // analyzer: 4 findings, 3 dismissed (2 inaccurate, 1 won't-fix)
    { detection_source: 'analyzer', dismissed: true, dismissal_reason: 'this is wrong, main exists' },
    { detection_source: 'analyzer', dismissed: true, dismissal_reason: 'false positive' },
    { detection_source: 'analyzer', dismissed: true, dismissal_reason: "won't fix this quarter" },
    { detection_source: 'analyzer', dismissed: false },
  ]
  const t = aggregateDismissals(rows)

  it('computes honest per-source rates over total (not dismissed-only)', () => {
    const analyzer = t.bySource.find((s) => s.key === 'analyzer')!
    expect(analyzer.total).toBe(4)
    expect(analyzer.dismissed).toBe(3)
    expect(analyzer.inaccurate).toBe(2)
    expect(analyzer.dismissalRate).toBe(0.75)
    expect(analyzer.inaccurateRate).toBe(0.5) // 2 inaccurate / 4 total
  })

  it('keeps the instrument source clean (no dismissals)', () => {
    const axe = t.bySource.find((s) => s.key === 'axe')!
    expect(axe.dismissed).toBe(0)
    expect(axe.inaccurateRate).toBe(0)
  })

  it('splits by evidence tier (mirrors the accuracy ledger)', () => {
    const ai = t.byTier.find((s) => s.key === 'ai_assessed')!
    const verified = t.byTier.find((s) => s.key === 'verified')!
    expect(verified.inaccurate).toBe(0)
    expect(ai.inaccurate).toBe(2)
  })

  it('sorts sources by inaccurate rate (worst first)', () => {
    expect(t.bySource[0].key).toBe('analyzer')
  })

  it('counts reason buckets', () => {
    expect(t.buckets.inaccurate).toBe(2)
    expect(t.buckets.wont_fix).toBe(1)
  })

  it('handles an empty set', () => {
    const e = aggregateDismissals([])
    expect(e.overall.total).toBe(0)
    expect(e.overall.inaccurateRate).toBe(0)
  })
})
