import { isVisuallyHiddenInteractive, type InteractiveElementFacts } from '../responsive-checker'

function facts(overrides: Partial<InteractiveElementFacts> = {}): InteractiveElementFacts {
  return {
    tag: 'a',
    width: 45,
    height: 17,
    text: 'Product',
    clip: '',
    clipPath: '',
    position: 'static',
    left: 10,
    right: 55,
    viewportWidth: 375,
    href: '/product',
    ...overrides,
  }
}

describe('isVisuallyHiddenInteractive — never flag correct a11y affordances', () => {
  it('excludes the 1x1px skip link (the reported false positive)', () => {
    expect(isVisuallyHiddenInteractive(facts({
      width: 1, height: 1, text: 'Skip to main content', href: '#main', position: 'absolute',
    }))).toBe(true)
  })

  it('excludes a skip link by text+anchor even if it momentarily measures larger', () => {
    expect(isVisuallyHiddenInteractive(facts({
      width: 120, height: 20, text: 'Skip to content', href: '#content',
    }))).toBe(true)
  })

  it('excludes sr-only clip:rect(0,0,0,0) even when sized > 1px', () => {
    expect(isVisuallyHiddenInteractive(facts({ clip: 'rect(0px, 0px, 0px, 0px)', width: 10, height: 10 }))).toBe(true)
  })

  it('excludes sr-only via clip-path inset(50%)', () => {
    expect(isVisuallyHiddenInteractive(facts({ width: 10, height: 10, clipPath: 'inset(50%)' }))).toBe(true)
  })

  it('excludes elements pushed fully off-screen (left:-9999px pattern)', () => {
    expect(isVisuallyHiddenInteractive(facts({ position: 'absolute', left: -9999, right: -9899 }))).toBe(true)
  })

  it('STILL flags a genuinely small, visible nav link', () => {
    // 45x17 visible link is a real (debatable) touch-target concern — not hidden.
    expect(isVisuallyHiddenInteractive(facts({ width: 45, height: 17, text: 'Pricing', href: '/pricing' }))).toBe(false)
  })

  it('does not treat a normal in-page anchor as a skip link unless text says "skip"', () => {
    expect(isVisuallyHiddenInteractive(facts({ href: '#features', text: 'Features', width: 60, height: 20 }))).toBe(false)
  })
})
