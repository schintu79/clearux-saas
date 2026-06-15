import { isLabelInstructionFinding, classifyInputRelevance } from '../input-relevance-gate'

describe('isLabelInstructionFinding', () => {
  it('matches label / instruction / form-field findings', () => {
    expect(isLabelInstructionFinding({ title: 'WCAG 3.3.2: Labels or Instructions' })).toBe(true)
    expect(isLabelInstructionFinding({ title: 'Form inputs lack associated <label> elements' })).toBe(true)
    expect(isLabelInstructionFinding({ title: 'Signup Form Missing Programmatic Label Association for Input Fields' })).toBe(true)
    expect(isLabelInstructionFinding({ title: 'Required Form Fields Not Indicated Before Submission' })).toBe(true)
  })
  it('does NOT match unrelated findings', () => {
    expect(isLabelInstructionFinding({ title: 'Hero headline lacks clarity for GCC audience' })).toBe(false)
    expect(isLabelInstructionFinding({ title: 'Missing meta description on /learn' })).toBe(false)
    expect(isLabelInstructionFinding({ title: 'Colour contrast ratio below 4.5:1' })).toBe(false)
  })
})

describe('classifyInputRelevance', () => {
  it('NEVER drops a DETERMINISTIC instrument label finding (instrument owns truth — transversal)', () => {
    // wcag_checker only flags ACTIONABLE unlabeled inputs; we do not second-guess
    // it by URL, on any site. A real unlabeled input on a content page is real.
    const res = classifyInputRelevance([
      { id: 'a', title: 'WCAG 3.3.2: Labels or Instructions', description: '', page_url: 'https://x.com/en', detection_source: 'wcag_checker' },
      { id: 'b', title: 'WCAG 3.3.2: Labels or Instructions', description: '', page_url: 'https://x.com/en', detection_source: 'axe' },
    ])
    expect(res.offRelevanceIds).toEqual([])
  })

  it('drops an LLM label GUESS on a non-input page (no instrument evidence)', () => {
    const res = classifyInputRelevance([
      { id: 'a', title: 'Form inputs lack associated <label> elements', description: '', page_url: 'https://x.com/en', detection_source: 'analyzer' },
    ])
    expect(res.offRelevanceIds).toEqual(['a'])
  })

  it('KEEPS LLM label findings on a genuine input page (no false suppression)', () => {
    const res = classifyInputRelevance([
      { id: 'b', title: 'Form inputs lack associated <label> elements', description: '', page_url: 'https://x.com/en/signup', detection_source: 'analyzer' },
      { id: 'c', title: 'Signup Form Missing Programmatic Label Association', description: '', page_url: 'https://x.com/en/login', detection_source: 'analyzer' },
    ])
    expect(res.offRelevanceIds).toEqual([])
  })

  it('does not touch non-label findings', () => {
    const res = classifyInputRelevance([
      { id: 'd', title: 'Hero headline lacks clarity', description: '', page_url: 'https://x.com/en', detection_source: 'analyzer' },
    ])
    expect(res.offRelevanceIds).toEqual([])
  })

  it('leaves findings with no page_url alone (cannot judge relevance)', () => {
    const res = classifyInputRelevance([
      { id: 'e', title: 'Form inputs lack associated label', description: '', page_url: null, detection_source: 'analyzer' },
    ])
    expect(res.offRelevanceIds).toEqual([])
  })

  it('end-to-end: keeps deterministic + input-page findings, drops only LLM guesses off input pages', () => {
    const res = classifyInputRelevance([
      { id: 'det-home', title: 'WCAG 3.3.2: Labels or Instructions', description: '', page_url: 'https://x.com/en', detection_source: 'wcag_checker' }, // kept (instrument)
      { id: 'llm-home', title: 'Form inputs lack associated <label> elements', description: '', page_url: 'https://x.com/en', detection_source: 'analyzer' }, // dropped (LLM guess off input page)
      { id: 'llm-signup', title: 'Form inputs lack associated <label> elements', description: '', page_url: 'https://x.com/en/signup', detection_source: 'analyzer' }, // kept (input page)
    ])
    expect(res.offRelevanceIds).toEqual(['llm-home'])
  })
})
