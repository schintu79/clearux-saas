import { opportunitySeverity } from '../pagespeed'

// Regression guard for the 2026-06-14 score-stability fix: a PageSpeed
// opportunity (unused JS, render-blocking, redirects…) must never be high or
// critical, so PSI's run-to-run savings-estimate variance can't flip a finding
// into "high" and swing the score cap (it moved fixpath 72→65 with no change).

describe('opportunitySeverity — PSI opportunities are capped, never high', () => {
  it('never returns high/critical for ANY savings value', () => {
    for (const ms of [0, 100, 300, 301, 999, 1000, 1001, 50_000]) {
      expect(['low', 'medium']).toContain(opportunitySeverity(ms))
    }
  })

  it('large savings cap at medium (would previously have been high)', () => {
    expect(opportunitySeverity(5000)).toBe('medium')
    expect(opportunitySeverity(1001)).toBe('medium')
  })

  it('moderate savings → medium', () => {
    expect(opportunitySeverity(500)).toBe('medium')
  })

  it('negligible or unknown savings → low', () => {
    expect(opportunitySeverity(300)).toBe('low')
    expect(opportunitySeverity(0)).toBe('low')
    expect(opportunitySeverity(null)).toBe('low')
    expect(opportunitySeverity(undefined)).toBe('low')
  })
})
