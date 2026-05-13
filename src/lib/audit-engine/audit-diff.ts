// ============================================================
// ClearUX Audit Engine — Re-Audit Diff Engine
// ============================================================
// Compares two audits of the same domain and produces a
// structured diff: fixed issues, new issues, score deltas,
// and per-category changes.
//
// PROPRIETARY — do not distribute outside the ClearUX codebase.
// ============================================================

import type { AuditFinding, Report } from '@/types/database'

/* ── Types ──────────────────────────────────────────────────── */

export interface FindingDiffItem {
  /** The finding from the current audit (null if it was fixed) */
  current: AuditFinding | null
  /** The matching finding from the previous audit (null if new) */
  previous: AuditFinding | null
  /** Diff status */
  diffStatus: 'fixed' | 'new' | 'persisted' | 'regressed' | 'improved'
}

export interface ScoreDelta {
  label: string
  previous: number | null
  current: number | null
  delta: number
}

export interface AuditDiff {
  /** Overall score change */
  overallDelta: ScoreDelta
  /** Per-pillar score changes */
  pillarDeltas: ScoreDelta[]
  /** AI visibility score change */
  aiVisibilityDelta: ScoreDelta | null
  /** Finding-level diffs */
  findings: FindingDiffItem[]
  /** Summary counts */
  summary: {
    fixed: number
    new: number
    persisted: number
    regressed: number
    improved: number
    previousTotal: number
    currentTotal: number
  }
}

/* ── Matching logic ────────────────────────────────────────── */

/**
 * Match findings between two audits using title similarity + category.
 * Returns pairs of (current, previous) with diff status.
 */
function matchFindings(
  currentFindings: AuditFinding[],
  previousFindings: AuditFinding[],
): FindingDiffItem[] {
  const results: FindingDiffItem[] = []
  const matchedPrevIds = new Set<string>()

  // For each current finding, try to find a match in previous
  for (const current of currentFindings) {
    let bestMatch: AuditFinding | null = null
    let bestScore = 0

    for (const prev of previousFindings) {
      if (matchedPrevIds.has(prev.id)) continue
      const score = similarityScore(current, prev)
      if (score > bestScore && score >= 0.6) {
        bestScore = score
        bestMatch = prev
      }
    }

    if (bestMatch) {
      matchedPrevIds.add(bestMatch.id)
      // Determine if severity changed
      const sevOrder = { critical: 4, high: 3, medium: 2, low: 1 }
      const prevSev = sevOrder[bestMatch.severity] || 0
      const currSev = sevOrder[current.severity] || 0
      const diffStatus = currSev > prevSev ? 'regressed' : currSev < prevSev ? 'improved' : 'persisted'
      results.push({ current, previous: bestMatch, diffStatus })
    } else {
      results.push({ current, previous: null, diffStatus: 'new' })
    }
  }

  // Previous findings not matched = fixed
  for (const prev of previousFindings) {
    if (!matchedPrevIds.has(prev.id)) {
      // Also check if the finding was explicitly marked as fixed
      const isFixed = prev.status === 'fixed' || prev.dismissed
      if (!isFixed) {
        results.push({ current: null, previous: prev, diffStatus: 'fixed' })
      }
    }
  }

  return results
}

/**
 * Compute similarity between two findings (0-1).
 * Uses title similarity + category match.
 */
function similarityScore(a: AuditFinding, b: AuditFinding): number {
  let score = 0

  // Category match (strong signal)
  if (a.category_index != null && b.category_index != null && a.category_index === b.category_index) {
    score += 0.3
  }

  // Title similarity (Jaccard on words)
  const aWords = new Set(normalize(a.title).split(/\s+/))
  const bWords = new Set(normalize(b.title).split(/\s+/))
  const intersection = [...aWords].filter(w => bWords.has(w)).length
  const union = new Set([...aWords, ...bWords]).size
  const jaccard = union > 0 ? intersection / union : 0
  score += jaccard * 0.5

  // Same page URL
  if (a.page_url && b.page_url) {
    try {
      const aPath = new URL(a.page_url).pathname
      const bPath = new URL(b.page_url).pathname
      if (aPath === bPath) score += 0.2
    } catch {
      if (a.page_url === b.page_url) score += 0.2
    }
  }

  return Math.min(1, score)
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
}

/* ── Main diff function ────────────────────────────────────── */

export function computeAuditDiff(
  currentReport: Report,
  previousReport: Report,
  currentFindings: AuditFinding[],
  previousFindings: AuditFinding[],
): AuditDiff {
  // Score deltas
  const overallDelta: ScoreDelta = {
    label: 'Overall score',
    previous: previousReport.overall_score,
    current: currentReport.overall_score,
    delta: (currentReport.overall_score ?? 0) - (previousReport.overall_score ?? 0),
  }

  const pillarDeltas: ScoreDelta[] = [
    { label: 'UX', previous: previousReport.ux_score, current: currentReport.ux_score, delta: (currentReport.ux_score ?? 0) - (previousReport.ux_score ?? 0) },
    { label: 'Conversion', previous: previousReport.conversion_score, current: currentReport.conversion_score, delta: (currentReport.conversion_score ?? 0) - (previousReport.conversion_score ?? 0) },
    { label: 'Mobile', previous: previousReport.mobile_score, current: currentReport.mobile_score, delta: (currentReport.mobile_score ?? 0) - (previousReport.mobile_score ?? 0) },
    { label: 'AI discoverability', previous: previousReport.ai_discoverability_score, current: currentReport.ai_discoverability_score, delta: (currentReport.ai_discoverability_score ?? 0) - (previousReport.ai_discoverability_score ?? 0) },
    { label: 'Content', previous: previousReport.content_score, current: currentReport.content_score, delta: (currentReport.content_score ?? 0) - (previousReport.content_score ?? 0) },
  ].filter(d => d.previous != null || d.current != null)

  // AI visibility delta
  const prevAiVis = (previousReport.ai_visibility_breakdown as any)?.overall ?? null
  const currAiVis = (currentReport.ai_visibility_breakdown as any)?.overall ?? null
  const aiVisibilityDelta = (prevAiVis != null || currAiVis != null) ? {
    label: 'AI visibility',
    previous: prevAiVis,
    current: currAiVis,
    delta: (currAiVis ?? 0) - (prevAiVis ?? 0),
  } : null

  // Finding diffs
  const findings = matchFindings(currentFindings, previousFindings)

  const summary = {
    fixed: findings.filter(f => f.diffStatus === 'fixed').length,
    new: findings.filter(f => f.diffStatus === 'new').length,
    persisted: findings.filter(f => f.diffStatus === 'persisted').length,
    regressed: findings.filter(f => f.diffStatus === 'regressed').length,
    improved: findings.filter(f => f.diffStatus === 'improved').length,
    previousTotal: previousFindings.length,
    currentTotal: currentFindings.length,
  }

  return {
    overallDelta,
    pillarDeltas,
    aiVisibilityDelta,
    findings,
    summary,
  }
}
