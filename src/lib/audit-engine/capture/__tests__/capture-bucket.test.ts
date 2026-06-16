import { captureToPageContent, analyzableCaptures, captureInputParity, urlsInPageContent, type CaptureBucketPage } from '../capture-bucket'

const pages: CaptureBucketPage[] = [
  {
    page_url: 'https://x.com/en',
    page_status: 'complete',
    title: 'Home | X',
    h1: 'The First GCC Platform',
    meta: { description: 'Trade with X' },
    extracted_text: 'Welcome to X. Start trading today.',
  },
  {
    page_url: 'https://x.com/en/pricing',
    page_status: 'complete',
    title: 'Pricing | X',
    h1: 'Simple pricing',
    meta: { description: 'Plans' },
    extracted_text: 'Starter, Pro, Enterprise.',
  },
]

describe('analyzableCaptures', () => {
  it('keeps complete/partial captures with text', () => {
    expect(analyzableCaptures(pages)).toHaveLength(2)
  })
  it('drops failed captures and empty text', () => {
    const mixed: CaptureBucketPage[] = [
      ...pages,
      { page_url: 'https://x.com/dead', page_status: 'failed', extracted_text: 'something' },
      { page_url: 'https://x.com/empty', page_status: 'complete', extracted_text: '   ' },
      { page_url: '', page_status: 'complete', extracted_text: 'x' },
    ]
    expect(analyzableCaptures(mixed).map((c) => c.page_url)).toEqual([
      'https://x.com/en',
      'https://x.com/en/pricing',
    ])
  })
})

describe('captureToPageContent', () => {
  it('reproduces the analyzer block format exactly', () => {
    const out = captureToPageContent([pages[0]])
    expect(out).toBe(
      'URL: https://x.com/en\n' +
        'Title: Home | X\n' +
        'H1: The First GCC Platform\n' +
        'Meta Description: Trade with X\n' +
        'Content:\nWelcome to X. Start trading today.\n',
    )
  })

  it('joins multiple pages with the \\n---\\n delimiter', () => {
    const out = captureToPageContent(pages)
    expect(out.split('\n---\n')).toHaveLength(2)
    expect(out).toContain('URL: https://x.com/en\n')
    expect(out).toContain('URL: https://x.com/en/pricing\n')
  })

  it('omits absent optional fields but always emits URL + Content', () => {
    const out = captureToPageContent([
      { page_url: 'https://x.com/min', page_status: 'complete', extracted_text: 'body only' },
    ])
    expect(out).toBe('URL: https://x.com/min\nContent:\nbody only\n')
  })

  it('produces empty string when nothing is analyzable', () => {
    expect(captureToPageContent([{ page_url: 'https://x.com/f', page_status: 'failed', extracted_text: 'x' }])).toBe('')
  })
})

describe('captureInputParity (Phase 2 shadow-compare)', () => {
  const live =
    'URL: https://x.com/en\nTitle: Home\nContent:\nbody\n\n---\n' +
    'URL: https://x.com/en/pricing\nTitle: Pricing\nContent:\nplans\n'

  it('reports full coverage when captures match the live pages', () => {
    const p = captureInputParity(live, pages)
    expect(p.liveUrls).toBe(2)
    expect(p.captureUrls).toBe(2)
    expect(p.coversAllLivePages).toBe(true)
    expect(p.missingFromCapture).toEqual([])
    expect(p.captureChars).toBeGreaterThan(0)
  })

  it('flags pages the capture is missing (trailing-slash tolerant)', () => {
    const p = captureInputParity(live, [pages[0]]) // only /en captured
    expect(p.coversAllLivePages).toBe(false)
    expect(p.missingFromCapture).toEqual(['https://x.com/en/pricing'])
  })

  it('urlsInPageContent extracts the URL lines', () => {
    expect(urlsInPageContent(live)).toEqual(['https://x.com/en', 'https://x.com/en/pricing'])
  })
})
