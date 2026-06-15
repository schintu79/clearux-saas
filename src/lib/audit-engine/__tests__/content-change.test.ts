import { pageContentChanged, contentSignature, contentLengthBucket } from '../content-change'

describe('contentLengthBucket', () => {
  it('puts similar sizes in the same bucket and big jumps in different buckets', () => {
    expect(contentLengthBucket(1000)).toBe(contentLengthBucket(1050)) // ~5% apart
    expect(contentLengthBucket(1000)).not.toBe(contentLengthBucket(4000)) // 4x apart
    expect(contentLengthBucket(0)).toBe(0)
    expect(contentLengthBucket(null)).toBe(0)
  })
})

describe('pageContentChanged', () => {
  it('flags the real raseed case: H1 changed since last audit', () => {
    expect(pageContentChanged(
      { h1: 'Trade 14,000+ US Stocks & ETFs — Built for the GCC', title: 'Raseed', contentLength: 5000 },
      { h1: 'The First GCC Platform for Stocks, Options & Crypto', title: 'Raseed', contentLength: 5000 },
    )).toBe(true)
  })

  it('does NOT flag an unchanged page (carry-forward stays valid)', () => {
    const page = { h1: 'Pricing Plans', title: 'Pricing — Acme', metaDescription: 'Our plans', contentLength: 3200 }
    expect(pageContentChanged(page, { ...page })).toBe(false)
  })

  it('does NOT flag trivial content-size churn within a bucket', () => {
    expect(pageContentChanged(
      { h1: 'Pricing', title: 'Pricing', contentLength: 3000 },
      { h1: 'Pricing', title: 'Pricing', contentLength: 3120 },
    )).toBe(false)
  })

  it('flags a large content-size change even when headings match', () => {
    expect(pageContentChanged(
      { h1: 'Blog', title: 'Blog', contentLength: 1000 },
      { h1: 'Blog', title: 'Blog', contentLength: 9000 },
    )).toBe(true)
  })

  it('flags a changed meta description', () => {
    expect(pageContentChanged(
      { h1: 'X', title: 'X', metaDescription: 'old summary', contentLength: 2000 },
      { h1: 'X', title: 'X', metaDescription: 'completely new summary', contentLength: 2000 },
    )).toBe(true)
  })

  it('is conservative when a side is missing or both are empty', () => {
    expect(pageContentChanged(null, { h1: 'X' })).toBe(false)
    expect(pageContentChanged({ h1: 'X' }, null)).toBe(false)
    expect(pageContentChanged({}, {})).toBe(false)
  })

  it('produces a stable signature', () => {
    const p = { h1: 'A', title: 'B', metaDescription: 'C', contentLength: 1234 }
    expect(contentSignature(p)).toBe(contentSignature({ ...p }))
  })
})
