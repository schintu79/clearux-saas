// ============================================================
// Fixpath — Precision Harness (P2)
// ============================================================
//
// Runs the live LLM-noise gates over a labeled truth-set and produces the
// numbers that make the moat provable:
//   • fpEliminationRate — share of confirmed false positives the gates remove.
//     This is the headline accuracy metric; target = 1.0.
//   • falseDropRate     — share of genuine findings wrongly removed. This is
//     the safety metric; it MUST stay 0. Removing real findings is worse than
//     leaving noise, because it silently lowers the score and hides problems.
//   • per-source breakdown — where precision lives and where it leaks.
//
// The gates exercised are exactly the ones that run in production
// (process-audit.ts gates 2d/2e/2f), so this harness measures the real system,
// not a model of it. The deploy-gate test asserts the two invariants above.
// ============================================================

import { classifyStructuralOwnership } from '../pipeline/structural-ownership'
import { verifyFindingsAgainstDomByUrl, type DomFacts } from '../pipeline/dom-verification'
import { identifyUngroundedFindings } from '../pipeline/evidence-binding'
import type { TruthSet, GroundTruth } from './truth-set'

export interface SourceStat {
  total: number
  truePositives: number
  falsePositives: number
  dropped: number
  /** Precision among findings the gates KEPT: kept-TP / (kept-TP + kept-FP). */
  keptPrecision: number
}

export interface PrecisionReport {
  name: string
  total: number
  falsePositives: number
  truePositives: number
  /** False positives removed by the gates. */
  fpEliminated: number
  fpEliminationRate: number
  /** True positives wrongly removed — must be 0. */
  trueDropped: number
  falseDropRate: number
  /** Ungrounded findings demoted (not dropped) by evidence-binding. */
  demoted: number
  bySource: Record<string, SourceStat>
  /** Per-case audit trail: what each drop/demote was and whether it was correct. */
  detail: Array<{ id: string; groundTruth: GroundTruth; action: 'kept' | 'dropped' | 'demoted'; by: string | null; correct: boolean }>
}

/**
 * Evaluate one truth-set against the production noise gates.
 */
export function evaluateTruthSet(ts: TruthSet): PrecisionReport {
  const cases = ts.cases
  const domByUrl = new Map<string, DomFacts>(Object.entries(ts.domByUrl))

  // Run the three gates exactly as the pipeline does.
  const ownership = classifyStructuralOwnership(cases)
  const dom = verifyFindingsAgainstDomByUrl(cases, domByUrl, ts.fallbackUrl)
  const binding = identifyUngroundedFindings(cases)

  const droppedBy = new Map<string, string>()
  for (const id of ownership.dropIds) droppedBy.set(id, ownership.reasons[id] || 'structural-ownership')
  for (const id of dom.refutedIds) if (!droppedBy.has(id)) droppedBy.set(id, dom.reasons[id] || 'dom-verification')
  const demotedSet = new Set(binding.ungroundedIds)

  const bySource: Record<string, SourceStat> = {}
  const ensure = (s: string): SourceStat =>
    (bySource[s] ??= { total: 0, truePositives: 0, falsePositives: 0, dropped: 0, keptPrecision: 0 })

  let fpEliminated = 0
  let trueDropped = 0
  let demoted = 0
  const detail: PrecisionReport['detail'] = []

  for (const c of cases) {
    const stat = ensure(c.detection_source)
    stat.total++
    if (c.groundTruth === 'false_positive') stat.falsePositives++
    else stat.truePositives++

    const dropReason = droppedBy.get(c.id)
    if (dropReason) {
      stat.dropped++
      if (c.groundTruth === 'false_positive') fpEliminated++
      else trueDropped++
      detail.push({ id: c.id, groundTruth: c.groundTruth, action: 'dropped', by: dropReason, correct: c.groundTruth === 'false_positive' })
    } else if (demotedSet.has(c.id)) {
      demoted++
      detail.push({ id: c.id, groundTruth: c.groundTruth, action: 'demoted', by: 'evidence-binding', correct: true })
    } else {
      detail.push({ id: c.id, groundTruth: c.groundTruth, action: 'kept', by: null, correct: c.groundTruth === 'true_positive' })
    }
  }

  // Per-source precision among KEPT findings (dropped ones removed from the pool).
  for (const c of cases) {
    if (droppedBy.has(c.id)) continue
    // kept (incl. demoted, which are still shown) — count toward precision
  }
  for (const s of Object.keys(bySource)) {
    const stat = bySource[s]
    const keptTp = cases.filter((c) => c.detection_source === s && c.groundTruth === 'true_positive' && !droppedBy.has(c.id)).length
    const keptFp = cases.filter((c) => c.detection_source === s && c.groundTruth === 'false_positive' && !droppedBy.has(c.id)).length
    stat.keptPrecision = keptTp + keptFp > 0 ? round(keptTp / (keptTp + keptFp)) : 1
  }

  const falsePositives = cases.filter((c) => c.groundTruth === 'false_positive').length
  const truePositives = cases.filter((c) => c.groundTruth === 'true_positive').length

  return {
    name: ts.name,
    total: cases.length,
    falsePositives,
    truePositives,
    fpEliminated,
    fpEliminationRate: falsePositives > 0 ? round(fpEliminated / falsePositives) : 1,
    trueDropped,
    falseDropRate: truePositives > 0 ? round(trueDropped / truePositives) : 0,
    demoted,
    bySource,
    detail,
  }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

/** One-line human summary, handy for logs / CI output. */
export function formatPrecisionReport(r: PrecisionReport): string {
  return `[${r.name}] ${r.total} cases · FP eliminated ${r.fpEliminated}/${r.falsePositives} (${Math.round(r.fpEliminationRate * 100)}%) · false-drop ${r.trueDropped}/${r.truePositives} (${Math.round(r.falseDropRate * 100)}%) · ${r.demoted} demoted`
}
