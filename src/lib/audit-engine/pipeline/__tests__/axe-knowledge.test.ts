import { enrichAxeFinding, AXE_RULE_KNOWLEDGE, principleImpact } from '../axe-knowledge'

describe('enrichAxeFinding — mapped rules are surgical', () => {
  it('button-name: names the element and gives an actionable, specific fix', () => {
    const e = enrichAxeFinding({
      ruleId: 'button-name', help: 'Buttons must have discernible text',
      description: 'Ensures buttons have discernible text', helpUrl: 'https://deque/button-name',
      criterion: '4.1.2', selector: '.btn-control', count: 1,
    })
    expect(e.what).toContain('`.btn-control`')
    expect(e.what).toMatch(/accessible name/i)
    expect(e.why).toMatch(/screen-reader|voice-control|can.?t use/i)
    expect(e.fix).toContain('`.btn-control`')
    expect(e.fix).toMatch(/aria-label/i)
    expect(e.fix).not.toMatch(/http/) // reference stays separate
    expect(e.reference).toBe('https://deque/button-name')
  })

  it('appends an affected-count note when multiple elements fail', () => {
    const e = enrichAxeFinding({
      ruleId: 'color-contrast', help: 'h', description: 'd', helpUrl: null,
      criterion: '1.4.3', selector: '.a', count: 9,
    })
    expect(e.what).toMatch(/9 elements on this page are affected/)
    expect(e.what).toContain('`.a`')
  })

  it('degrades gracefully when there is no selector', () => {
    const e = enrichAxeFinding({
      ruleId: 'document-title', help: 'h', description: 'd', helpUrl: null,
      criterion: '2.4.2', selector: null, count: 1,
    })
    expect(e.what).toMatch(/no <title>/i)
    expect(e.fix).toMatch(/descriptive.*<title>/i)
  })
})

describe('enrichAxeFinding — fallback for unmapped rules (works on every site)', () => {
  it('uses the rule help + element + principle-based why', () => {
    const e = enrichAxeFinding({
      ruleId: 'some-future-rule', help: 'Frobnicators must be labelled',
      description: 'Ensures frobnicators are labelled', helpUrl: 'https://deque/x',
      criterion: '2.1.1', selector: '.thing', count: 2,
    })
    expect(e.what).toContain('Frobnicators must be labelled')
    expect(e.what).toContain('`.thing`')
    expect(e.why).toMatch(/keyboard|operate/i) // 2.x → operable
    expect(e.fix).toContain('`.thing`')
    expect(e.reference).toBe('https://deque/x')
  })
})

describe('principleImpact', () => {
  it('maps each WCAG principle to a distinct impact', () => {
    expect(principleImpact('1.1.1')).toMatch(/perceive/i)
    expect(principleImpact('2.1.1')).toMatch(/keyboard|operate/i)
    expect(principleImpact('3.3.2')).toMatch(/misunderstand|errors/i)
    expect(principleImpact('4.1.2')).toMatch(/assistive technolog/i)
    expect(principleImpact(null)).toMatch(/assistive technology/i)
  })
})

describe('knowledge base integrity', () => {
  it('every entry has non-empty what/why/fix', () => {
    for (const k of Object.values(AXE_RULE_KNOWLEDGE)) {
      expect(k.what.trim().length).toBeGreaterThan(10)
      expect(k.why.trim().length).toBeGreaterThan(10)
      expect(k.fix.trim().length).toBeGreaterThan(10)
    }
  })
  it('covers the common high-impact rules', () => {
    for (const rule of ['button-name', 'link-name', 'color-contrast', 'image-alt', 'label', 'aria-required-children', 'html-has-lang', 'document-title']) {
      expect(AXE_RULE_KNOWLEDGE[rule]).toBeDefined()
    }
  })
})
