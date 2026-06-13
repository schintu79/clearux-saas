// ============================================================
// Brand Consistency module tests (plan §10 V1)
// ============================================================
// Doctrine under test: only EVIDENCED mismatches; no speculation; own score
// that never implies the health score; quote-grounded voice findings only.

import {
  compareBrandConsistency,
  parseColor,
  colorDistance,
  DEFAULT_COLOR_TOLERANCE,
  type DeclaredBrand,
  type ObservedBrand,
} from '../brand-consistency'

describe('parseColor', () => {
  it('parses 6-digit hex, 3-digit hex, and rgb()', () => {
    expect(parseColor('#1a2b3c')).toEqual([26, 43, 60])
    expect(parseColor('#abc')).toEqual([170, 187, 204])
    expect(parseColor('rgb(255, 0, 128)')).toEqual([255, 0, 128])
    expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual([10, 20, 30])
  })
  it('returns null for garbage', () => {
    expect(parseColor('teal-ish')).toBeNull()
    expect(parseColor('')).toBeNull()
  })
})

describe('colorDistance', () => {
  it('is zero for identical colours and large for opposites', () => {
    expect(colorDistance([0, 0, 0], [0, 0, 0])).toBe(0)
    expect(colorDistance([0, 0, 0], [255, 255, 255])).toBeGreaterThan(DEFAULT_COLOR_TOLERANCE)
  })
})

describe('compareBrandConsistency — colours', () => {
  const declared: DeclaredBrand = { colors: ['#1a2b3c', '#ff0066'], voice: null, toneKeywords: [] }

  it('no mismatch when declared colours are present (within tolerance)', () => {
    const observed: ObservedBrand = { colors: ['rgb(26, 43, 60)', '#ff0166' /* ~1 off */, '#ffffff'] }
    const r = compareBrandConsistency(declared, observed)
    expect(r.attributesChecked).toContain('color')
    expect(r.mismatches.filter((m) => m.attribute === 'color')).toHaveLength(0)
    expect(r.score).toBe(100)
  })

  it('REGRESSION: flags a declared brand colour absent from the live site, with evidence', () => {
    const observed: ObservedBrand = { colors: ['#1a2b3c', '#ffffff', '#000000'] } // missing #ff0066
    const r = compareBrandConsistency(declared, observed)
    const colorMiss = r.mismatches.filter((m) => m.attribute === 'color')
    expect(colorMiss).toHaveLength(1)
    expect(colorMiss[0].evidence).toMatch(/#ff0066/i)
    expect(colorMiss[0].trustHarming).toBe(false) // brand fidelity, not user-trust
    expect(r.score).toBe(88) // one missing colour, -12
  })

  it('GROUPS multiple missing colours into ONE mismatch, but scores by magnitude', () => {
    const declared3: DeclaredBrand = { colors: ['#1a2b3c', '#ff0066', '#11 aa22'.replace(' ', '')], voice: null, toneKeywords: [] }
    const observed: ObservedBrand = { colors: ['#ffffff'] } // all three missing
    const r = compareBrandConsistency(declared3, observed)
    const colorMiss = r.mismatches.filter((m) => m.attribute === 'color')
    expect(colorMiss).toHaveLength(1) // grouped — one issue, not three
    expect(colorMiss[0].title).toMatch(/colours/i)
    expect(colorMiss[0].evidence).toMatch(/#1a2b3c/i)
    expect(colorMiss[0].evidence).toMatch(/#ff0066/i)
    expect(r.score).toBe(64) // 3 missing × -12 = -36 → magnitude still reflected
  })

  it('does NOT check colours when the site palette is unknown (no fabricated verdict)', () => {
    const r = compareBrandConsistency(declared, { colors: [] })
    expect(r.attributesChecked).not.toContain('color')
    expect(r.mismatches).toHaveLength(0)
    expect(r.score).toBe(100)
  })
})

describe('compareBrandConsistency — voice/tone (quote-grounded only)', () => {
  const declared: DeclaredBrand = {
    colors: [],
    voice: 'Professional, authoritative, reassuring',
    toneKeywords: ['expert', 'calm'],
  }

  it('emits a voice mismatch ONLY with a verbatim quote, and marks it trust-harming', () => {
    const observed: ObservedBrand = {
      colors: [],
      voiceContradictions: [
        { quote: 'lol just smash that buy button already 🤑', conflictsWith: 'brand voice (Professional, authoritative)', severity: 'high' },
      ],
    }
    const r = compareBrandConsistency(declared, observed)
    const voice = r.mismatches.filter((m) => m.attribute === 'voice')
    expect(voice).toHaveLength(1)
    expect(voice[0].evidence).toMatch(/smash that buy button/)
    expect(voice[0].trustHarming).toBe(true)
    expect(r.score).toBe(80) // -20 for one high-severity voice contradiction
  })

  it('GROUPS multiple voice contradictions into ONE mismatch, scored by magnitude', () => {
    const observed: ObservedBrand = {
      colors: [],
      voiceContradictions: [
        { quote: 'yeah whatever, just click it', conflictsWith: 'brand voice', severity: 'medium' },
        { quote: 'no cap this is fire', conflictsWith: 'brand voice', severity: 'medium' },
      ],
    }
    const r = compareBrandConsistency(declared, observed)
    const voice = r.mismatches.filter((m) => m.attribute === 'voice')
    expect(voice).toHaveLength(1) // grouped
    expect(voice[0].evidence).toMatch(/whatever/)
    expect(voice[0].evidence).toMatch(/no cap/)
    expect(r.score).toBe(76) // 2 × -12 medium
  })

  it('drops any voice contradiction that lacks a quote (no speculation)', () => {
    const observed: ObservedBrand = {
      colors: [],
      voiceContradictions: [{ quote: '   ', conflictsWith: 'brand voice' }],
    }
    const r = compareBrandConsistency(declared, observed)
    expect(r.mismatches.filter((m) => m.attribute === 'voice')).toHaveLength(0)
    expect(r.score).toBe(100)
  })

  it('skips the voice attribute entirely when no voice/tone is declared', () => {
    const r = compareBrandConsistency({ colors: [], voice: null, toneKeywords: [] }, { colors: [] })
    expect(r.attributesChecked).toHaveLength(0)
    expect(r.score).toBe(100)
  })
})

describe('compareBrandConsistency — score floor + composition', () => {
  it('never drops below 0 no matter how many missing colours, still ONE grouped mismatch', () => {
    const declared: DeclaredBrand = { colors: ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777', '#888888', '#999999', '#aaaaaa'], voice: null, toneKeywords: [] }
    const r = compareBrandConsistency(declared, { colors: ['#ffffff'] })
    expect(r.score).toBe(0) // 10 × -12 floored at 0
    expect(r.mismatches.filter((m) => m.attribute === 'color')).toHaveLength(1)
  })
})
