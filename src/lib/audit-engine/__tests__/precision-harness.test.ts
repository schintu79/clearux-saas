import { evaluateTruthSet, formatPrecisionReport } from '../eval/precision'
import { ALL_TRUTH_SETS, FIXPATH_RUN_1 } from '../eval/truth-set'

// ============================================================
// DEPLOY GATE: the noise gates must eliminate every confirmed false positive
// and must never drop a genuine finding. If either invariant breaks, this test
// fails and the change does not ship. This is what makes "most accurate audit"
// a measured, regression-proof claim rather than a vibe.
// ============================================================

describe('Precision harness — deploy gate', () => {
  for (const ts of ALL_TRUTH_SETS) {
    describe(ts.name, () => {
      const report = evaluateTruthSet(ts)

      it(`eliminates 100% of confirmed false positives — ${formatPrecisionReport(report)}`, () => {
        expect(report.fpEliminationRate).toBe(1)
        expect(report.fpEliminated).toBe(report.falsePositives)
      })

      it('never drops a true positive (false-drop rate = 0)', () => {
        expect(report.falseDropRate).toBe(0)
        expect(report.trueDropped).toBe(0)
      })

      it('never drops an instrument-sourced finding', () => {
        for (const [source, stat] of Object.entries(report.bySource)) {
          if (['axe', 'responsive_checker', 'wcag_checker', 'head_tag', 'structured_data', 'pagespeed_api', 'crawler'].includes(source)) {
            expect(stat.dropped).toBe(0)
          }
        }
      })
    })
  }
})

describe('Precision harness — fixpath run 1 specifics', () => {
  const report = evaluateTruthSet(FIXPATH_RUN_1)

  it('drops exactly the four known structural false positives', () => {
    const dropped = report.detail.filter((d) => d.action === 'dropped').map((d) => d.id).sort()
    expect(dropped).toEqual(['fp-contact-labels', 'fp-footer-link', 'fp-main-landmark', 'fp-nav-label'])
  })

  it('keeps both grounded interpretive content findings', () => {
    const kept = report.detail.filter((d) => d.action === 'kept').map((d) => d.id)
    expect(kept).toEqual(expect.arrayContaining(['tp-pricing-security', 'tp-free-tier']))
  })

  it('every drop was correct (no genuine finding removed)', () => {
    for (const d of report.detail.filter((x) => x.action === 'dropped')) {
      expect(d.correct).toBe(true)
    }
  })
})
