// ============================================================
// Trust-engine tests — severity caps + composition (Plan §0.2.1)
// ============================================================
// This chain decides every score a customer sees. It shipped
// fabricated 87s for three days in June 2026 because nothing
// tested it. Every threshold and invariant is pinned here.

import {
  applySeverityCap,
  applySeverityCapFromCounts,
  applyModuleSeverityCap,
  composeModuleScores,
  capSummarySentence,
} from '../severity-cap'

const f = (severity: string) => ({ severity })
const many = (severity: string, n: number) => Array.from({ length: n }, () => f(severity))

describe('applySeverityCap — overall thresholds (score model v2)', () => {
  it.each([
    // [critical, high, medium, expectedCap]
    [1, 0, 0, 55],
    [2, 9, 0, 55],   // critical dominates
    [0, 6, 0, 65],
    [0, 9, 0, 65],
    [0, 5, 0, 72],
    [0, 3, 0, 72],
    [0, 2, 0, 80],
    [0, 1, 0, 80],
    [0, 0, 6, 85],
    [0, 0, 12, 85],
  ])('critical=%i high=%i medium=%i caps a 97 at %i', (c, h, m, cap) => {
    const findings = [...many('critical', c), ...many('high', h), ...many('medium', m)]
    const { overall, capInfo } = applySeverityCap(97, findings)
    expect(overall).toBe(cap)
    expect(capInfo.applied).toBe(true)
    expect(capInfo.cap).toBe(cap)
    expect(capInfo.reason).toBeTruthy()
  })

  it('does not cap below the threshold (no inflation either)', () => {
    const { overall, capInfo } = applySeverityCap(50, many('high', 7))
    expect(overall).toBe(50) // already below cap 65 — untouched
    expect(capInfo.applied).toBe(false)
  })

  it('applies no cap for low-severity-only findings', () => {
    const { overall, capInfo } = applySeverityCap(97, many('low', 20))
    expect(overall).toBe(97)
    expect(capInfo.applied).toBe(false)
  })

  it('applies no cap below medium threshold', () => {
    const { overall, capInfo } = applySeverityCap(97, many('medium', 5))
    expect(overall).toBe(97)
    expect(capInfo.applied).toBe(false)
  })

  it('handles empty findings', () => {
    const { overall, capInfo } = applySeverityCap(97, [])
    expect(overall).toBe(97)
    expect(capInfo.applied).toBe(false)
  })

  it('count-based variant matches findings-based variant', () => {
    const findings = [...many('high', 4), ...many('medium', 2)]
    const a = applySeverityCap(95, findings)
    const b = applySeverityCapFromCounts(95, { critical: 0, high: 4, medium: 2 })
    expect(a.overall).toBe(b.overall)
    expect(a.capInfo.cap).toBe(b.capInfo.cap)
  })

  // REGRESSION (2026-06-10): qinacademy.com scored 87 with 7 open
  // high-severity issues. Under v2 it must cap at 65.
  it('REGRESSION qinacademy: 87 with 7 high + 8 medium + 1 low → 65', () => {
    const findings = [...many('high', 7), ...many('medium', 8), ...many('low', 1)]
    expect(applySeverityCap(87, findings).overall).toBe(65)
  })
})

describe('applyModuleSeverityCap — module-scale thresholds', () => {
  it.each([
    [1, 0, 0, 55],
    [0, 3, 0, 65],
    [0, 2, 0, 72],
    [0, 1, 0, 80],
    [0, 0, 3, 85],
  ])('critical=%i high=%i medium=%i caps a 97 module at %i', (c, h, m, cap) => {
    const findings = [...many('critical', c), ...many('high', h), ...many('medium', m)]
    expect(applyModuleSeverityCap(97, findings).overall).toBe(cap)
  })

  it('2 mediums do not cap a module', () => {
    expect(applyModuleSeverityCap(97, many('medium', 2)).overall).toBe(97)
  })
})

describe('composeModuleScores — own-cap model (forced-average scaling REMOVED 2026-06-12)', () => {
  const NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

  function build(scores: number[], findingCounts: number[], sev = 'high') {
    const modules = NAMES.slice(0, scores.length).map((name, i) => ({ name, score: scores[i] }))
    const byModule: Record<string, Array<{ severity: string }>> = {}
    NAMES.slice(0, scores.length).forEach((name, i) => {
      byModule[name] = many(sev, findingCounts[i])
    })
    return { modules, byModule }
  }

  // REGRESSION (2026-06-12, audit adac62e1): the forced-average step
  // crushed carriers to absurd values — Foundation displayed 30 while its
  // own card said "held down by 3 medium-severity issues" (own cap: 85).
  // A module's displayed score must NEVER be lower than its own severity
  // cap explanation justifies.
  it('REGRESSION fixpath: module with 3 mediums shows its own cap (85), never a scaled 30', () => {
    const modules = [
      { name: 'Foundation', score: 93 },
      { name: 'Human Experience', score: 87 },
      { name: 'Accessibility', score: 87 },
      { name: 'Future Readiness', score: 96 },
    ]
    const byModule = {
      Foundation: many('medium', 3),
      'Human Experience': [],
      Accessibility: many('critical', 7),
      'Future Readiness': [],
    }
    const composed = composeModuleScores(modules, byModule, 55, true)
    const byName = Object.fromEntries(composed.map((m) => [m.name, m.score]))
    expect(byName.Foundation).toBe(85)
    expect(byName.Accessibility).toBe(55)
    expect(byName['Human Experience']).toBe(87)
    expect(byName['Future Readiness']).toBe(96)
  })

  it('INVARIANT: every displayed module score equals applyModuleSeverityCap of its own raw score', () => {
    const { modules, byModule } = build([80, 96, 72, 90], [2, 0, 3, 1], 'high')
    const composed = composeModuleScores(modules, byModule, 55, true)
    for (let i = 0; i < modules.length; i++) {
      const expected = applyModuleSeverityCap(modules[i].score, byModule[NAMES[i]] || [])
      expect(composed[i].score).toBe(expected.overall)
      expect(composed[i].capInfo).toEqual(expected.capInfo)
    }
  })

  it('clean modules (zero findings) keep their exact score regardless of overall cap', () => {
    const { modules, byModule } = build([90, 90, 96], [3, 3, 0], 'high')
    const composed = composeModuleScores(modules, byModule, 60, true)
    expect(composed.find((m) => m.name === 'C')!.score).toBe(96)
  })

  it('overall cap params have NO effect on module scores (kept only for call-site compatibility)', () => {
    const { modules, byModule } = build([97, 80], [1, 2], 'high')
    const withCap = composeModuleScores(modules, byModule, 55, true)
    const withoutCap = composeModuleScores(modules, byModule, 90, false)
    expect(withCap.map((m) => m.score)).toEqual(withoutCap.map((m) => m.score))
  })

  it('preserves ordering among distinct post-cap scores', () => {
    const modules = [
      { name: 'A', score: 85 },
      { name: 'B', score: 70 },
      { name: 'C', score: 95 },
    ]
    const byModule = {
      A: many('high', 1),
      B: many('high', 1),
      C: many('medium', 3),
    }
    const composed = composeModuleScores(modules, byModule, 55, true)
    const byName = Object.fromEntries(composed.map((m) => [m.name, m.score]))
    expect(byName.C).toBeGreaterThan(byName.A)
    expect(byName.A).toBeGreaterThan(byName.B)
  })

  it('never produces negative scores', () => {
    const { modules, byModule } = build([10, 10, 10], [5, 5, 5], 'critical')
    const composed = composeModuleScores(modules, byModule, 1, true)
    for (const m of composed) expect(m.score).toBeGreaterThanOrEqual(0)
  })

  it('handles empty module list', () => {
    expect(composeModuleScores([], {}, 65, true)).toEqual([])
  })
})

describe('capSummarySentence', () => {
  it('explains an applied cap', () => {
    const { capInfo } = applySeverityCap(97, many('high', 7))
    expect(capSummarySentence(capInfo)).toContain('capped at 65/100')
    expect(capSummarySentence(capInfo)).toContain('7 open high-severity issues')
  })
  it('is empty when no cap applied', () => {
    const { capInfo } = applySeverityCap(97, [])
    expect(capSummarySentence(capInfo)).toBe('')
  })
})
