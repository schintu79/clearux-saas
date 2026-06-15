import { hostOf, pagePathOf } from '../score-utils'

describe('hostOf', () => {
  it('returns hostname without www', () => {
    expect(hostOf('https://www.example.com/foo')).toBe('example.com')
    expect(hostOf('https://raseedinvest.com/en/signup')).toBe('raseedinvest.com')
  })
  it('returns null for empty/invalid', () => {
    expect(hostOf(null)).toBeNull()
    expect(hostOf(undefined)).toBeNull()
    expect(hostOf('not a url')).toBeNull()
  })
})

describe('pagePathOf', () => {
  it('returns host + path so the user knows the exact page', () => {
    expect(pagePathOf('https://raseedinvest.com/en/signup')).toBe('raseedinvest.com/en/signup')
    expect(pagePathOf('https://raseedinvest.com/en')).toBe('raseedinvest.com/en')
  })
  it('drops a bare root path and trailing slash', () => {
    expect(pagePathOf('https://example.com/')).toBe('example.com')
    expect(pagePathOf('https://example.com')).toBe('example.com')
    expect(pagePathOf('https://example.com/pricing/')).toBe('example.com/pricing')
  })
  it('strips leading www', () => {
    expect(pagePathOf('https://www.example.com/en/contact')).toBe('example.com/en/contact')
  })
  it('uses pathname only (query string is dropped)', () => {
    expect(pagePathOf('https://example.com/search?q=abc')).toBe('example.com/search')
  })
  it('returns null for empty/invalid input', () => {
    expect(pagePathOf(null)).toBeNull()
    expect(pagePathOf(undefined)).toBeNull()
    expect(pagePathOf('')).toBeNull()
    expect(pagePathOf('::::')).toBeNull()
  })
})
