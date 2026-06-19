import { isLikelyCSSSelector } from '../screenshots'

describe('isLikelyCSSSelector — accept real selectors, reject prose', () => {
  it('accepts generated selectors that contain the <a> anchor tag (the bug)', () => {
    expect(isLikelyCSSSelector('div > a:nth-of-type(2)')).toBe(true)
    expect(isLikelyCSSSelector('body > nav > a:nth-of-type(3)')).toBe(true)
    expect(isLikelyCSSSelector('a')).toBe(true)
  })

  it('accepts ids, classes, attributes, combinators', () => {
    expect(isLikelyCSSSelector('button#submit')).toBe(true)
    expect(isLikelyCSSSelector('.hero-cta')).toBe(true)
    expect(isLikelyCSSSelector('div.card:nth-of-type(1)')).toBe(true)
    expect(isLikelyCSSSelector('[role="button"]')).toBe(true)
  })

  it('rejects prose masquerading as a selector', () => {
    expect(isLikelyCSSSelector('the hero section on the homepage')).toBe(false)
    expect(isLikelyCSSSelector('a button with no label')).toBe(false) // multi-word prose, no CSS structure
    expect(isLikelyCSSSelector('')).toBe(false)
  })
})
