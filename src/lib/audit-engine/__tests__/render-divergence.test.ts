import {
  extractMarkdownH1,
  normalizeHeading,
  headingSimilarity,
  headingsMateriallyDiffer,
  rawHeadingAbsentFromRendered,
  shouldPreferRendered,
  looksClientHydrated,
  HEADING_DIVERGENCE_THRESHOLD,
} from '../render-divergence'

describe('looksClientHydrated', () => {
  it('detects Next.js / React / Nuxt / Angular / SvelteKit markers', () => {
    expect(looksClientHydrated('<div id="__next"></div><script>self.__next_f=[]</script>')).toBe(true)
    expect(looksClientHydrated('<script id="__NEXT_DATA__" type="application/json">{}</script>')).toBe(true)
    expect(looksClientHydrated('<div data-reactroot></div>')).toBe(true)
    expect(looksClientHydrated('<div id="__nuxt"></div>')).toBe(true)
    expect(looksClientHydrated('<app-root ng-version="17"></app-root>')).toBe(true)
  })
  it('does not flag plain static HTML', () => {
    expect(looksClientHydrated('<html><body><h1>Hello</h1><p>static site</p></body></html>')).toBe(false)
    expect(looksClientHydrated(null)).toBe(false)
  })
})

// The real raseedinvest.com divergence that triggered this work (2026-06-15):
const RAW_H1 = 'Trade 14,000+ US Stocks & ETFs — Built for the GCC'
const RENDERED_H1 = 'The First GCC Platform for Stocks, Options & Crypto'

describe('extractMarkdownH1', () => {
  it('returns the first H1 from markdown', () => {
    expect(extractMarkdownH1('Some intro\n\n# The First GCC Platform for Stocks, Options & Crypto\n\nbody'))
      .toBe('The First GCC Platform for Stocks, Options & Crypto')
  })
  it('ignores ## and deeper headings', () => {
    expect(extractMarkdownH1('## Subhead first\n\n# Real H1\n')).toBe('Real H1')
  })
  it('ignores # inside fenced code blocks', () => {
    expect(extractMarkdownH1('```\n# not a heading\n```\n# Actual Heading')).toBe('Actual Heading')
  })
  it('strips trailing closing hashes', () => {
    expect(extractMarkdownH1('# Heading ###')).toBe('Heading')
  })
  it('returns null when no H1 present', () => {
    expect(extractMarkdownH1('just text, no headings')).toBeNull()
    expect(extractMarkdownH1('')).toBeNull()
    expect(extractMarkdownH1(null)).toBeNull()
  })
})

describe('normalizeHeading', () => {
  it('lowercases and strips punctuation/emoji', () => {
    expect(normalizeHeading('Trade 14,000+ US Stocks & ETFs — Built!')).toBe('trade 14 000 us stocks etfs built')
  })
  it('returns empty string for null', () => {
    expect(normalizeHeading(null)).toBe('')
  })
})

describe('headingSimilarity', () => {
  it('is 1 for identical headings', () => {
    expect(headingSimilarity('Welcome to Acme', 'Welcome to Acme')).toBe(1)
  })
  it('is low for the real raseed divergence', () => {
    expect(headingSimilarity(RAW_H1, RENDERED_H1)).toBeLessThan(HEADING_DIVERGENCE_THRESHOLD)
  })
  it('stays high for trivial wording changes', () => {
    expect(headingSimilarity('Welcome to Acme', 'Welcome to Acme Inc.')).toBeGreaterThanOrEqual(HEADING_DIVERGENCE_THRESHOLD)
  })
})

// Realistic rendered content: contains the NEW hero + "14,000+" elsewhere, but
// NOT the old heading as a contiguous phrase.
const RENDERED_CONTENT =
  'Trusted by 121,951 of traders across the GCC. The First GCC Platform for Stocks, Options & Crypto. ' +
  'Trade 12,536+ US equities & ETFs alongside spot crypto in a single account — built for the GCC, settled around the clock. ' +
  'Access 14,000+ US-listed companies and funds. Start Trading. Explore Markets. Regulated DFSA & FSA.'

describe('rawHeadingAbsentFromRendered', () => {
  it('flags a stale heading that is absent from rendered content', () => {
    expect(rawHeadingAbsentFromRendered(RAW_H1, RENDERED_CONTENT)).toBe(true)
  })
  it('does NOT flag a heading that IS present in rendered content', () => {
    expect(rawHeadingAbsentFromRendered('The First GCC Platform for Stocks, Options & Crypto', RENDERED_CONTENT)).toBe(false)
  })
  it('is conservative with short headings or thin rendered content', () => {
    expect(rawHeadingAbsentFromRendered('Home', RENDERED_CONTENT)).toBe(false) // too short
    expect(rawHeadingAbsentFromRendered(RAW_H1, 'tiny')).toBe(false) // thin rendered
    expect(rawHeadingAbsentFromRendered(null, RENDERED_CONTENT)).toBe(false)
  })
})

describe('shouldPreferRendered', () => {
  it('prefers rendered for the real raseed page (H1 diverges AND raw heading absent)', () => {
    expect(shouldPreferRendered({ rawH1: RAW_H1, renderedH1: RENDERED_H1, renderedContent: RENDERED_CONTENT })).toBe(true)
  })
  it('prefers rendered when only the content-absence signal fires (no rendered H1)', () => {
    expect(shouldPreferRendered({ rawH1: RAW_H1, renderedH1: null, renderedContent: RENDERED_CONTENT })).toBe(true)
  })
  it('keeps raw (static site) when H1 matches and is present in content', () => {
    const h1 = 'Pricing Plans for Every Team'
    const content = 'Pricing Plans for Every Team. Choose a plan that scales with you. Starter, Pro, Enterprise.'
    expect(shouldPreferRendered({ rawH1: h1, renderedH1: h1, renderedContent: content })).toBe(false)
  })
})

describe('headingsMateriallyDiffer', () => {
  it('flags the real raseed stale-vs-rendered H1', () => {
    expect(headingsMateriallyDiffer(RAW_H1, RENDERED_H1)).toBe(true)
  })
  it('does NOT flag identical headings (static site — no regression)', () => {
    expect(headingsMateriallyDiffer('Pricing — Acme', 'Pricing — Acme')).toBe(false)
  })
  it('does NOT flag minor wording differences', () => {
    expect(headingsMateriallyDiffer('Welcome to Acme', 'Welcome to Acme Inc.')).toBe(false)
  })
  it('is conservative: returns false when either heading is missing', () => {
    expect(headingsMateriallyDiffer(null, RENDERED_H1)).toBe(false)
    expect(headingsMateriallyDiffer(RAW_H1, null)).toBe(false)
    expect(headingsMateriallyDiffer('', '')).toBe(false)
  })
})
