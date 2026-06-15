// ============================================================
// Fixpath — Regression Alerts (Phase 2 #2)
// ============================================================
//
// Turns a re-audit into a monitoring signal: compare this run to the previous
// one and surface what got WORSE. Three alert classes (plan §4.2):
//   1. score_drop      — the overall Website Health Score fell by ≥ threshold.
//   2. new_high/critical — a high- or critical-severity issue appeared that
//      wasn't open last run.
//   3. ai_answer_flip  — a model that previously vouched for the brand stopped
//      (or started). "DeepSeek stopped calling you legitimate" is the most
//      viral alert in this market.
//
// PURE: callers map DB rows → the input shapes below and persist the returned
// alerts (notification row + email). No DB or SDK imports here, so it's fully
// unit-testable and reused by the monitoring runner and any manual re-audit.
// Only alerts on REGRESSIONS (worse), not improvements — improvements belong in
// the digest, not an interrupt-me alert.
// ============================================================

export type RegressionAlertType = 'score_drop' | 'new_critical' | 'new_high' | 'ai_answer_flip'

export interface AlertFinding {
  title: string
  severity: string
}

/** A model's verdict from a benchmark interrogation, reduced to a polarity. */
export interface BenchmarkVerdict {
  model: string
  /** true = the model spoke positively / vouched for the brand. */
  positive: boolean
}

export interface RegressionInput {
  /** Previous run's capped overall score, or null if this is the first run. */
  previousScore: number | null
  currentScore: number
  previousFindings: AlertFinding[]
  currentFindings: AlertFinding[]
  /** Per-model verdicts, if benchmark interrogations ran on both runs. */
  previousVerdicts?: BenchmarkVerdict[]
  currentVerdicts?: BenchmarkVerdict[]
}

export interface RegressionConfig {
  /** Minimum overall-score drop to alert on. Default 5. */
  scoreDropThreshold?: number
  /** Drop at/above this is escalated to critical. Default 15. */
  scoreDropCriticalThreshold?: number
}

export interface RegressionAlert {
  type: RegressionAlertType
  level: 'critical' | 'warning'
  title: string
  body: string
  meta: Record<string, unknown>
}

/** Normalize a finding title for cross-run matching (so re-worded duplicates
 *  aren't counted as "new"). */
function normTitle(t: string): string {
  return (t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

const SEV_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 }

export function detectRegressions(
  input: RegressionInput,
  config: RegressionConfig = {},
): RegressionAlert[] {
  const dropThreshold = config.scoreDropThreshold ?? 5
  const dropCritical = config.scoreDropCriticalThreshold ?? 15
  const alerts: RegressionAlert[] = []

  // 1. Score drop
  if (input.previousScore != null) {
    const drop = input.previousScore - input.currentScore
    if (drop >= dropThreshold) {
      alerts.push({
        type: 'score_drop',
        level: drop >= dropCritical ? 'critical' : 'warning',
        title: `Website Health Score dropped ${drop} points`,
        body: `Your score fell from ${input.previousScore} to ${input.currentScore} since the last audit.`,
        meta: { previousScore: input.previousScore, currentScore: input.currentScore, drop },
      })
    }
  }

  // 2. New high/critical findings (present now, not last run — matched by title)
  const prevTitles = new Set(input.previousFindings.map((f) => normTitle(f.title)))
  const newCritical: string[] = []
  const newHigh: string[] = []
  for (const f of input.currentFindings) {
    const rank = SEV_RANK[f.severity] ?? 1
    if (rank < SEV_RANK.high) continue
    if (prevTitles.has(normTitle(f.title))) continue
    if (rank === SEV_RANK.critical) newCritical.push(f.title)
    else newHigh.push(f.title)
  }
  if (newCritical.length > 0) {
    alerts.push({
      type: 'new_critical',
      level: 'critical',
      title: `${newCritical.length} new critical issue${newCritical.length > 1 ? 's' : ''}`,
      body: `New critical finding${newCritical.length > 1 ? 's' : ''} since the last audit: ${newCritical.slice(0, 3).join('; ')}${newCritical.length > 3 ? '…' : ''}.`,
      meta: { titles: newCritical },
    })
  }
  if (newHigh.length > 0) {
    alerts.push({
      type: 'new_high',
      level: 'warning',
      title: `${newHigh.length} new high-severity issue${newHigh.length > 1 ? 's' : ''}`,
      body: `New high-severity finding${newHigh.length > 1 ? 's' : ''} since the last audit: ${newHigh.slice(0, 3).join('; ')}${newHigh.length > 3 ? '…' : ''}.`,
      meta: { titles: newHigh },
    })
  }

  // 3. AI answer flips — a model that vouched for you now doesn't (the wedge)
  if (input.previousVerdicts && input.currentVerdicts) {
    const prevByModel = new Map(input.previousVerdicts.map((v) => [v.model, v.positive]))
    for (const cur of input.currentVerdicts) {
      const was = prevByModel.get(cur.model)
      if (was === undefined) continue
      if (was && !cur.positive) {
        alerts.push({
          type: 'ai_answer_flip',
          level: 'critical',
          title: `${cur.model} stopped vouching for your brand`,
          body: `${cur.model} previously answered positively about your brand and no longer does. This directly affects how AI assistants represent you.`,
          meta: { model: cur.model, from: 'positive', to: 'negative' },
        })
      }
    }
  }

  return alerts
}
