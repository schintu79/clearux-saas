import {
  identifyUngroundedFindings,
  isGrounded,
  hasVerbatimQuote,
  hasSelector,
  type FindingForBinding,
} from '../pipeline/evidence-binding'

const base = (over: Partial<FindingForBinding>): FindingForBinding => ({
  id: 'x', title: '', description: '', detection_source: 'analyzer', ...over,
})

describe('hasVerbatimQuote', () => {
  it('detects single, double, and smart quotes of 8+ chars', () => {
    expect(hasVerbatimQuote("buttons say 'Get Started' on every page")).toBe(true)
    expect(hasVerbatimQuote('the hero reads "Find what hurts trust"')).toBe(true)
    expect(hasVerbatimQuote('“Noise is the norm” appears in the hero')).toBe(true)
  })
  it('ignores trivially short quotes', () => {
    expect(hasVerbatimQuote("it says 'OK' there")).toBe(false)
  })
})

describe('hasSelector', () => {
  it('accepts a concrete selector', () => {
    expect(hasSelector(base({ target_element: 'div.lg\\:hidden' }))).toBe(true)
    expect(hasSelector(base({ affected_selector: 'a.cta-primary' }))).toBe(true)
  })
  it('rejects empty and bare-tag locators', () => {
    expect(hasSelector(base({ target_element: '' }))).toBe(false)
    expect(hasSelector(base({ target_element: '<input>' }))).toBe(false)
  })
})

describe('identifyUngroundedFindings — enforces the /methodology promise', () => {
  it('demotes an LLM finding with no quote and no selector', () => {
    const f = base({ id: 'vague', title: 'Navigation labels are too vague', description: 'The labels do not clearly signal what users will find.' })
    expect(identifyUngroundedFindings([f]).ungroundedIds).toContain('vague')
  })

  it('keeps an LLM finding that cites a verbatim quote', () => {
    const f = base({ id: 'quoted', title: 'CTA text lacks clarity', description: "Primary buttons say 'Start Free Audit' without specifying the outcome." })
    expect(identifyUngroundedFindings([f]).ungroundedIds).toHaveLength(0)
  })

  it('keeps an LLM finding that names a concrete selector', () => {
    const f = base({ id: 'sel', title: 'Low contrast control', description: 'Muted text on paper.', target_element: 'span.text-m-muted' })
    expect(identifyUngroundedFindings([f]).ungroundedIds).toHaveLength(0)
  })

  it('keeps grounding supplied via the evidence field', () => {
    const f = base({ id: 'ev', title: 'Idiom-heavy messaging', description: 'Relies on idioms.', evidence: "Hero copy: 'Find what hurts trust. Fix what matters.'" })
    expect(identifyUngroundedFindings([f]).ungroundedIds).toHaveLength(0)
  })

  it('never demotes instrument-sourced findings (grounded by measurement)', () => {
    const axe = base({ id: 'axe', title: 'Contrast below AA', description: 'ratio 3.1:1', detection_source: 'axe' })
    const resp = base({ id: 'resp', title: '10 touch targets below 44px', description: 'measured', detection_source: 'responsive_checker' })
    expect(identifyUngroundedFindings([axe, resp]).ungroundedIds).toHaveLength(0)
  })

  it('attaches a reason for each demotion', () => {
    const f = base({ id: 'vague', title: 'Vague claim', description: 'no grounding here' })
    expect(identifyUngroundedFindings([f]).reasons['vague']).toMatch(/quote|selector/i)
  })
})

describe('isGrounded — composite', () => {
  it('is true when either quote or selector is present, false when neither', () => {
    expect(isGrounded(base({ description: "cites 'a real quote here'" }))).toBe(true)
    expect(isGrounded(base({ target_element: 'button.signup' }))).toBe(true)
    expect(isGrounded(base({ description: 'no grounding at all' }))).toBe(false)
  })
})
