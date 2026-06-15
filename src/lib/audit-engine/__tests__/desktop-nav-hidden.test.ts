// ============================================================
// Desktop "nav hidden behind hamburger" false-positive guard
// ============================================================
// Regression guard for the raseedinvest 1440px false positive: a Verified
// finding claimed "At the 1440px desktop screen size, the site uses a
// hamburger/toggle menu with only 0 visible navigation link(s)". In reality
// the 1440px header is clearly visible with links; the hamburger only starts
// at 1024px. `shouldFlagDesktopNavHidden` now treats 0 visible links as a
// DETECTION FAILURE (never flagged) and ignores the legitimate <1280px band.

import {
  shouldFlagDesktopNavHidden,
  DESKTOP_NAV_MIN_WIDTH,
  type DesktopNavData,
} from '../responsive-checker'

/** A "real desktop nav hidden" data shape: hamburger visible, 1-2 links shown,
 * more links hidden behind it. */
function data(overrides: Partial<DesktopNavData> = {}): DesktopNavData {
  return {
    hasHamburger: true,
    hamburgerVisible: true,
    visibleNavLinks: 1,
    totalNavLinks: 6,
    ...overrides,
  }
}

describe('shouldFlagDesktopNavHidden — only fires on strong desktop evidence', () => {
  test('ZERO visible links is a detection failure, never flagged — the raseedinvest 1440px case', () => {
    // This is exactly the false positive: "0 visible navigation link(s)" at 1440px.
    // 0 visible links almost always means the detector missed the header, not that
    // a real header was hidden — so we must NOT emit a high-severity finding.
    expect(shouldFlagDesktopNavHidden(data({ visibleNavLinks: 0, totalNavLinks: 0 }), 1440)).toBe(false)
    expect(shouldFlagDesktopNavHidden(data({ visibleNavLinks: 0, totalNavLinks: 6 }), 1440)).toBe(false)
  })

  test('a genuinely hidden desktop nav (1 visible of many) at 1440px IS flagged', () => {
    expect(shouldFlagDesktopNavHidden(data({ visibleNavLinks: 1, totalNavLinks: 6 }), 1440)).toBe(true)
    expect(shouldFlagDesktopNavHidden(data({ visibleNavLinks: 2, totalNavLinks: 8 }), 1440)).toBe(true)
  })

  test('hamburger at the legitimate <1280px responsive band is not flagged', () => {
    // raseedinvest starts its hamburger at 1024px by design — a valid pattern.
    expect(shouldFlagDesktopNavHidden(data(), 1024)).toBe(false)
    expect(shouldFlagDesktopNavHidden(data(), 1279)).toBe(false)
    expect(DESKTOP_NAV_MIN_WIDTH).toBe(1280)
  })

  test('no hamburger, or hamburger not visible at this viewport, is not flagged', () => {
    expect(shouldFlagDesktopNavHidden(data({ hasHamburger: false }), 1440)).toBe(false)
    expect(shouldFlagDesktopNavHidden(data({ hamburgerVisible: false }), 1440)).toBe(false)
  })

  test('a full visible desktop bar (many links shown) is not flagged', () => {
    expect(shouldFlagDesktopNavHidden(data({ visibleNavLinks: 6, totalNavLinks: 6 }), 1440)).toBe(false)
  })

  test('no MORE links hidden than shown → nothing is actually hidden → not flagged', () => {
    expect(shouldFlagDesktopNavHidden(data({ visibleNavLinks: 2, totalNavLinks: 2 }), 1440)).toBe(false)
  })
})
