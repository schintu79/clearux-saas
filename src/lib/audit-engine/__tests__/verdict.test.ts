import { buildVerdictPrompt, parseVerdict, generateVerdict, type VerdictInput } from '../verdict'

const input: VerdictInput = {
  url: 'https://qinacademy.com',
  industry: 'Online education',
  audience: 'Adult learners',
  homepageContent: 'URL: https://qinacademy.com\nTitle: Qin Academy\nH1: Learn Chinese\nContent: We offer courses.',
  signals: { mobileIssues: 6, slowOnMobile: false, accessibilityIssues: 3, searchVisibilityIssues: 2, detectedValueProp: 'Learn Chinese online' },
}

describe('buildVerdictPrompt — enforces the rules that make the verdict useful', () => {
  const p = buildVerdictPrompt(input)

  it('grounds the verdict in the real page + industry', () => {
    expect(p).toContain('Online education')
    expect(p).toContain('https://qinacademy.com')
    expect(p).toContain('H1: Learn Chinese')
  })

  it('demands specificity with a concrete good/bad example (the footer-menu lesson)', () => {
    expect(p).toMatch(/BE SPECIFIC/i)
    expect(p).toMatch(/footer menu/i) // the exact-location example
    expect(p).toMatch(/never "the navigation"/i)
  })

  it('bans jargon so a non-technical owner understands it', () => {
    expect(p).toMatch(/BANNED words/i)
    expect(p).toMatch(/\bWCAG\b/)
    expect(p).toMatch(/\bviewport\b/)
  })

  it('translates measured signals into plain facts the verdict may cite', () => {
    expect(p).toMatch(/6 measured problem\(s\) using the site on a phone/)
    expect(p).toMatch(/3 problem\(s\) for people using screen readers/)
  })

  it('caps the output at 4 prioritized points and asks for a bottom line', () => {
    expect(p).toMatch(/Maximum 4 points/i)
    expect(p).toMatch(/bottomLine/)
  })
})

describe('parseVerdict — robust to messy model output', () => {
  const good = JSON.stringify({
    headline: 'Your site does not look like a serious Chinese school.',
    summary: 'It is below the standard for online language schools. A visitor cannot tell in five seconds what you teach or why you. Your courses are buried.',
    points: [
      { what: 'Visitors cannot find your courses', where: 'the footer menu', impact: 'they leave before seeing what you sell' },
      { what: 'The headline is generic', where: 'the top of the homepage', impact: 'no reason to choose you over a competitor' },
    ],
    bottomLine: 'Rewrite the homepage headline to say exactly who you teach and what result they get.',
    confidence: 'high',
  })

  it('parses clean JSON', () => {
    const v = parseVerdict(good)!
    expect(v.headline).toMatch(/serious Chinese school/)
    expect(v.points).toHaveLength(2)
    expect(v.points[0].where).toBe('the footer menu')
    expect(v.confidence).toBe('high')
  })

  it('parses JSON wrapped in ```json fences and prose', () => {
    const v = parseVerdict('Here is my verdict:\n```json\n' + good + '\n```\nHope that helps.')
    expect(v).not.toBeNull()
    expect(v!.points).toHaveLength(2)
  })

  it('returns null when there is no actual verdict (no headline/summary)', () => {
    expect(parseVerdict('{"points":[]}')).toBeNull()
    expect(parseVerdict('not json at all')).toBeNull()
    expect(parseVerdict('')).toBeNull()
  })

  it('caps points at 4 and defaults confidence to medium', () => {
    const many = JSON.stringify({
      headline: 'h', summary: 's',
      points: Array.from({ length: 9 }, (_, i) => ({ what: `p${i}`, where: 'x', impact: 'y' })),
      confidence: 'banana',
    })
    const v = parseVerdict(many)!
    expect(v.points).toHaveLength(4)
    expect(v.confidence).toBe('medium')
  })
})

describe('generateVerdict — non-fatal orchestrator', () => {
  it('returns a parsed verdict from an injected completer', async () => {
    const v = await generateVerdict(input, {
      complete: async () => JSON.stringify({ headline: 'h', summary: 's', points: [], bottomLine: 'b', confidence: 'medium' }),
    })
    expect(v?.headline).toBe('h')
  })

  it('never throws — a model error yields null', async () => {
    const v = await generateVerdict(input, { complete: async () => { throw new Error('model down') } })
    expect(v).toBeNull()
  })

  it('returns null without enough input to judge', async () => {
    const v = await generateVerdict({ ...input, homepageContent: '' }, { complete: async () => 'x' })
    expect(v).toBeNull()
  })
})
