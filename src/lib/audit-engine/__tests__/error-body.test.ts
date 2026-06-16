import { isUpstreamErrorBody } from '../error-body'

describe('isUpstreamErrorBody', () => {
  it('flags the real raseed ar/options body', () => {
    expect(isUpstreamErrorBody('upstream connect error or disconnect/reset before headers. reset reason: connection termination')).toBe(true)
  })

  it('flags strong envoy/proxy signatures at any length', () => {
    expect(isUpstreamErrorBody('upstream connect error')).toBe(true)
    expect(isUpstreamErrorBody('no healthy upstream')).toBe(true)
    expect(isUpstreamErrorBody('upstream request timeout')).toBe(true)
  })

  it('flags short gateway-error stubs', () => {
    expect(isUpstreamErrorBody('502 Bad Gateway')).toBe(true)
    expect(isUpstreamErrorBody('503 Service Unavailable')).toBe(true)
    expect(isUpstreamErrorBody('504 Gateway Time-out')).toBe(true)
    expect(isUpstreamErrorBody('Service Temporarily Unavailable')).toBe(true)
  })

  it('does NOT flag a long, real page that merely mentions a gateway term', () => {
    const realPage =
      'Our Trading Platform Blog. '.repeat(60) +
      ' In this article we explain what a 502 bad gateway error means and how to fix it on your own server. ' +
      'Lorem ipsum dolor sit amet. '.repeat(60)
    expect(realPage.length).toBeGreaterThan(800)
    expect(isUpstreamErrorBody(realPage)).toBe(false)
  })

  it('does NOT flag normal content or empty input', () => {
    expect(isUpstreamErrorBody('Welcome to Raseed. Trade 14,000+ US Stocks & ETFs.')).toBe(false)
    expect(isUpstreamErrorBody('')).toBe(false)
    expect(isUpstreamErrorBody(null)).toBe(false)
    expect(isUpstreamErrorBody(undefined)).toBe(false)
  })
})
