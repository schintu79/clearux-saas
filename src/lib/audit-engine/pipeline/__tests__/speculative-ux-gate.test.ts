import { isSpeculativeCtaClarity, classifySpeculativeUx } from '../speculative-ux-gate'

describe('isSpeculativeCtaClarity', () => {
  it('flags the real raseed noise finding', () => {
    expect(isSpeculativeCtaClarity({
      title: 'Homepage has two confusing call-to-action buttons with unclear purpose',
      description: "The homepage hero shows 'Start Trading' and 'Explore Markets' as two separate CTAs with no clear visual or textual distinction. It's unclear which is the primary action or where each leads.",
    })).toBe(true)
  })

  it('flags variants of the same speculation', () => {
    expect(isSpeculativeCtaClarity({ title: 'CTA ambiguity: unclear what happens when the user clicks', description: '' })).toBe(true)
    expect(isSpeculativeCtaClarity({ title: '', description: 'It is unclear which call-to-action is the primary action.' })).toBe(true)
    expect(isSpeculativeCtaClarity({ title: 'Hero button purpose is unclear — users won\'t know where it leads', description: '' })).toBe(true)
  })

  it('KEEPS a genuinely evidenced ambiguity (real critique, not speculation)', () => {
    expect(isSpeculativeCtaClarity({
      title: 'Two buttons share identical "Submit" label',
      description: 'Both buttons are labelled the same text "Submit", so the duplicate label is genuinely ambiguous.',
    })).toBe(false)
  })

  it('does NOT flag unrelated findings', () => {
    expect(isSpeculativeCtaClarity({ title: 'Missing meta description on /learn', description: '' })).toBe(false)
    expect(isSpeculativeCtaClarity({ title: 'Hero headline lacks clarity on core differentiator', description: 'The H1 does not state the value prop.' })).toBe(false)
    expect(isSpeculativeCtaClarity({ title: 'Primary CTA has low colour contrast (2.1:1)', description: '' })).toBe(false)
  })
})

describe('classifySpeculativeUx', () => {
  it('drops LLM CTA-clarity speculation, keeps everything else', () => {
    const res = classifySpeculativeUx([
      { id: 'noise', title: 'Two confusing call-to-action buttons with unclear purpose', description: 'unclear which is the primary action or where each leads', detection_source: 'analyzer' },
      { id: 'real', title: 'Buttons share identical label', description: 'both buttons labelled the same text', detection_source: 'analyzer' },
      { id: 'other', title: 'Missing alt text on hero image', description: '', detection_source: 'analyzer' },
    ])
    expect(res.dropIds).toEqual(['noise'])
  })

  it('never drops a deterministic instrument finding even if wording matches', () => {
    const res = classifySpeculativeUx([
      { id: 'det', title: 'Button unclear: target-size and which is primary', description: 'where does it lead', detection_source: 'responsive_checker' },
    ])
    expect(res.dropIds).toEqual([])
  })
})
