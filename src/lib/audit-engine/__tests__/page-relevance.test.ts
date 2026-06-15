import { isLikelyInputPage, isHomepageLike, prioritizePagesForChecks } from '../page-relevance'

describe('isLikelyInputPage', () => {
  it('matches genuine input/auth pages (incl. locale prefix)', () => {
    expect(isLikelyInputPage('https://raseedinvest.com/en/signup')).toBe(true)
    expect(isLikelyInputPage('https://raseedinvest.com/en/login')).toBe(true)
    expect(isLikelyInputPage('https://x.com/ar/register')).toBe(true)
    expect(isLikelyInputPage('https://x.com/contact')).toBe(true)
    expect(isLikelyInputPage('https://x.com/checkout')).toBe(true)
    expect(isLikelyInputPage('https://x.com/en/open-account')).toBe(true)
    expect(isLikelyInputPage('https://x.com/forgot-password')).toBe(true)
  })
  it('does NOT match content pages with only decorative/search inputs', () => {
    expect(isLikelyInputPage('https://raseedinvest.com/en')).toBe(false)
    expect(isLikelyInputPage('https://raseedinvest.com/en/pricing')).toBe(false)
    expect(isLikelyInputPage('https://x.com/en/blog/post-1')).toBe(false)
    expect(isLikelyInputPage('https://x.com/about')).toBe(false)
    expect(isLikelyInputPage('https://x.com/')).toBe(false)
  })
  it('handles null/garbage', () => {
    expect(isLikelyInputPage(null)).toBe(false)
    expect(isLikelyInputPage(undefined)).toBe(false)
  })
})

describe('prioritizePagesForChecks', () => {
  const urls = [
    'https://raseedinvest.com/en',
    'https://raseedinvest.com/ar',
    'https://raseedinvest.com/en/pricing',
    'https://raseedinvest.com/en/crypto',
    'https://raseedinvest.com/en/signup',
    'https://raseedinvest.com/en/support',
  ]

  it('includes the signup page within a tight budget of 3 (the core fix)', () => {
    const chosen = prioritizePagesForChecks(urls, 3)
    expect(chosen).toContain('https://raseedinvest.com/en/signup')
    expect(chosen.length).toBe(3)
  })
  it('puts a homepage (incl. locale root) first', () => {
    const chosen = prioritizePagesForChecks(urls, 3)
    expect(isHomepageLike(chosen[0])).toBe(true)
  })
  it('dedupes and respects the budget', () => {
    const duped = [...urls, 'https://raseedinvest.com/en/signup']
    const chosen = prioritizePagesForChecks(duped, 4)
    expect(new Set(chosen).size).toBe(chosen.length)
    expect(chosen.length).toBe(4)
  })
  it('returns empty for non-positive budget', () => {
    expect(prioritizePagesForChecks(urls, 0)).toEqual([])
  })
})

describe('isHomepageLike', () => {
  it('treats site root and locale roots as homepages', () => {
    expect(isHomepageLike('https://x.com/')).toBe(true)
    expect(isHomepageLike('https://x.com')).toBe(true)
    expect(isHomepageLike('https://raseedinvest.com/en')).toBe(true)
    expect(isHomepageLike('https://raseedinvest.com/ar')).toBe(true)
    expect(isHomepageLike('https://x.com/en-US')).toBe(true)
  })
  it('does not treat deeper pages as homepages', () => {
    expect(isHomepageLike('https://raseedinvest.com/en/pricing')).toBe(false)
    expect(isHomepageLike('https://x.com/about')).toBe(false) // non-locale single segment
  })
})
