import {
  definitionOfDoneFloor,
  buildComposePrompt,
  parseComposeVerdict,
  composeFindings,
  type FindingForCompose,
  type ComposeJudge,
} from '../compose'

describe('definitionOfDoneFloor', () => {
  it('drops findings with no actionable content', () => {
    expect(definitionOfDoneFloor({ id: 'a', title: '' })).toBe('no title')
    expect(definitionOfDoneFloor({ id: 'a', title: 'X', description: '', recommendation: '' }))
      .toContain('nothing actionable')
  })
  it('clears a finding with a description or recommendation', () => {
    expect(definitionOfDoneFloor({ id: 'a', title: 'X', description: 'real body' })).toBeNull()
    expect(definitionOfDoneFloor({ id: 'a', title: 'X', recommendation: 'do this' })).toBeNull()
  })
})

describe('buildComposePrompt', () => {
  it('includes the finding, the page content, and the KEEP/DROP/ADJUST contract', () => {
    const p = buildComposePrompt(
      { id: 'a', title: 'CTA unclear', description: 'd', page_url: 'https://x.com/en' },
      'real page content here',
    )
    expect(p).toContain('CTA unclear')
    expect(p).toContain('real page content here')
    expect(p).toMatch(/VERDICT:\s*KEEP \| DROP \| ADJUST/)
    expect(p).toContain('speculation')
  })
})

describe('parseComposeVerdict', () => {
  it('parses keep/drop/adjust + severity + reason', () => {
    expect(parseComposeVerdict('VERDICT: DROP\nSEVERITY: (same)\nREASON: pure speculation')).toEqual({ action: 'drop', severity: null, reason: 'pure speculation' })
    expect(parseComposeVerdict('VERDICT: ADJUST\nSEVERITY: low\nREASON: minor nit')).toEqual({ action: 'adjust', severity: 'low', reason: 'minor nit' })
    expect(parseComposeVerdict('VERDICT: KEEP\nREASON: real, evidenced').action).toBe('keep')
  })
  it('fail-safe: unparseable → keep', () => {
    expect(parseComposeVerdict('garbage').action).toBe('keep')
    expect(parseComposeVerdict('').action).toBe('keep')
  })
})

describe('composeFindings', () => {
  const content = { 'https://x.com/en': 'Start Trading. Explore Markets. Trusted by 121,951 traders.' }

  it('trusts instrument findings without judging them', async () => {
    const judge: ComposeJudge = async () => { throw new Error('judge should not be called') }
    const det: FindingForCompose = { id: 'd', title: 'WCAG 3.3.2', description: 'label', detection_source: 'wcag_checker', page_url: 'https://x.com/en' }
    const res = await composeFindings([det], content, judge)
    expect(res.keptIds).toEqual(['d'])
  })

  it('drops an LLM finding the judge rejects (the CTA-junk case)', async () => {
    const judge: ComposeJudge = async () => 'VERDICT: DROP\nREASON: speculation about user confusion, no concrete defect'
    const junk: FindingForCompose = { id: 'j', title: "Sign-up buttons don't clearly explain what happens next", description: 'unclear which is primary', detection_source: 'analyzer', page_url: 'https://x.com/en' }
    const res = await composeFindings([junk], content, judge)
    expect(res.droppedIds).toEqual(['j'])
    expect(res.reasons['j']).toContain('compose:')
  })

  it('keeps an LLM finding the judge accepts, and applies severity adjustments', async () => {
    const judge: ComposeJudge = async (p) =>
      p.includes('real contradiction')
        ? 'VERDICT: KEEP\nREASON: evidenced contradiction in pricing copy'
        : 'VERDICT: ADJUST\nSEVERITY: low\nREASON: subjective nit, not high'
    const keep: FindingForCompose = { id: 'k', title: 'Pricing copy contradicts fees', description: 'real contradiction', severity: 'high', detection_source: 'analyzer', page_url: 'https://x.com/en' }
    const adj: FindingForCompose = { id: 'a', title: 'Spacing could be tighter', description: 'minor', severity: 'high', detection_source: 'analyzer', page_url: 'https://x.com/en' }
    const res = await composeFindings([keep, adj], content, judge)
    expect(res.keptIds.sort()).toEqual(['a', 'k'])
    expect(res.adjusted['a']).toBe('low')
    expect(res.adjusted['k']).toBeUndefined()
  })

  it('fail-safe: a judge error keeps the finding (never silently deletes)', async () => {
    const judge: ComposeJudge = async () => { throw new Error('LLM down') }
    const f: FindingForCompose = { id: 'f', title: 'Some LLM finding', description: 'body', detection_source: 'analyzer', page_url: 'https://x.com/en' }
    const res = await composeFindings([f], content, judge)
    expect(res.keptIds).toEqual(['f'])
  })

  it('applies the deterministic floor before judging', async () => {
    const judge: ComposeJudge = async () => 'VERDICT: KEEP\nREASON: x'
    const empty: FindingForCompose = { id: 'e', title: 'Title only', description: '', recommendation: '', detection_source: 'analyzer' }
    const res = await composeFindings([empty], content, judge)
    expect(res.droppedIds).toEqual(['e'])
    expect(res.reasons['e']).toContain('definition-of-done')
  })
})
