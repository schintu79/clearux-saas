// ============================================================
// Severity cap — score model v2 (2026-06-10)
// ============================================================
// Shared by the audit engine (analyzer.ts generateReport paths) AND the
// dashboard (overview recomputes the overall from live category data so
// fixes/dismissals move the score without a re-audit). Both sides MUST
// apply the same cap or they disagree — the first QIN v2 audit stored a
// capped 65 while the overview recomputed an uncapped 87.
//
// Rationale: the overall is the mean of 28 category scores where
// zero-finding categories score 95-99. That arithmetic could not drop
// below ~80 even with 7 open high-severity issues. The cap encodes the
// professional judgment the average can't express.
//
// This module must stay dependency-free (no SDK imports) — it is
// imported by client components.

export interface ScoreCapInfo {
  applied: boolean
  cap: number | null
  reason: string | null
}

export function applySeverityCap(
  overall: number,
  findings: Array<{ severity: string }>,
): { overall: number; capInfo: ScoreCapInfo } {
  let critical = 0, high = 0, medium = 0
  for (const f of findings) {
    if (f.severity === 'critical') critical++
    else if (f.severity === 'high') high++
    else if (f.severity === 'medium') medium++
  }
  return applySeverityCapFromCounts(overall, { critical, high, medium })
}

/**
 * Count-based variant — for callers that only have stored severity counts
 * (e.g. the score-trend API reading reports rows) or per-module subsets.
 */
export function applySeverityCapFromCounts(
  overall: number,
  { critical, high, medium }: { critical: number; high: number; medium: number },
): { overall: number; capInfo: ScoreCapInfo } {
  let cap: number | null = null
  let reason: string | null = null
  if (critical >= 1) { cap = 55; reason = `${critical} open critical issue${critical > 1 ? 's' : ''}` }
  else if (high >= 6) { cap = 65; reason = `${high} open high-severity issues` }
  else if (high >= 3) { cap = 72; reason = `${high} open high-severity issues` }
  else if (high >= 1) { cap = 80; reason = `${high} open high-severity issue${high > 1 ? 's' : ''}` }
  else if (medium >= 6) { cap = 85; reason = `${medium} open medium-severity issues` }

  if (cap != null && overall > cap) {
    return { overall: cap, capInfo: { applied: true, cap, reason } }
  }
  return { overall, capInfo: { applied: false, cap: null, reason: null } }
}

/**
 * Module-scale severity cap (2026-06-11). A module spans 4 of 28
 * categories — the site-wide thresholds (6 highs → 65) are far too
 * lenient at that scale, which let a module carrying 2 high-severity
 * issues display 80 beside a site verdict of 65. Thresholds here are
 * proportionate to a 4-category scope.
 */
export function applyModuleSeverityCap(
  score: number,
  findings: Array<{ severity: string }>,
): { overall: number; capInfo: ScoreCapInfo } {
  let critical = 0, high = 0, medium = 0
  for (const f of findings) {
    if (f.severity === 'critical') critical++
    else if (f.severity === 'high') high++
    else if (f.severity === 'medium') medium++
  }

  let cap: number | null = null
  let reason: string | null = null
  if (critical >= 1) { cap = 55; reason = `${critical} critical issue${critical > 1 ? 's' : ''}` }
  else if (high >= 3) { cap = 65; reason = `${high} high-severity issues` }
  else if (high === 2) { cap = 72; reason = '2 high-severity issues' }
  else if (high === 1) { cap = 80; reason = '1 high-severity issue' }
  else if (medium >= 3) { cap = 85; reason = `${medium} medium-severity issues` }

  if (cap != null && score > cap) {
    return { overall: cap, capInfo: { applied: true, cap, reason } }
  }
  return { overall: score, capInfo: { applied: false, cap: null, reason: null } }
}

/**
 * Compose display module scores — THE single chain every surface must
 * use so no two pages disagree on a module's number (the original bug:
 * Find showed 81 while Overview showed 48 for the same module).
 *
 * 2026-06-12 MODEL FIX: this used to ALSO scale issue-carrying modules
 * so the displayed module average equaled the capped overall. That
 * forced-average step was a spec bug: with 7 open criticals (overall
 * cap 55) and three clean modules in the 90s, carriers were crushed to
 * 19/23/30 while their own model said "3 mediums → cap 85" right on the
 * card. Indefensible math shown to customers.
 *
 * The rule now: every module shows its OWN severity-capped score —
 * traceable to its own findings, nothing else. The overall is a
 * worst-driven verdict (severity cap), NOT an average of the module
 * scores, and the UI says so explicitly. cappedOverall /
 * overallCapApplied params are kept so call sites don't churn.
 */
export interface DisplayModuleScore {
  name: string
  score: number
  capInfo: ScoreCapInfo
}

export function composeModuleScores(
  modules: Array<{ name: string; score: number }>,
  findingsByModule: Record<string, Array<{ severity: string }>>,
  _cappedOverall?: number,
  _overallCapApplied?: boolean,
): DisplayModuleScore[] {
  return modules.map((m) => {
    const capped = applyModuleSeverityCap(m.score, findingsByModule[m.name] || [])
    return { name: m.name, score: capped.overall, capInfo: capped.capInfo }
  })
}

/** Deterministic, user-facing sentence explaining an applied cap. */
export function capSummarySentence(capInfo: ScoreCapInfo): string {
  if (!capInfo.applied || !capInfo.reason) return ''
  return ` The overall score is currently capped at ${capInfo.cap}/100 by ${capInfo.reason} — resolving them unlocks the site's full score.`
}
