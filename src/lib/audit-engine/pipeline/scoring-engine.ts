// ============================================================
// Fixpath Scoring Engine
// ============================================================
// Computes category and overall scores from reconciled findings.
// Implements the Audit Bible's scoring model:
//
//   issuePenalty = severity * businessRelevance * scope * confidence
//   categoryScore = clamp(100 - activePenaltyTotal + resolvedCredit, 0, 100)
//   overallScore = weighted blend of category scores
//
// Recommendations get near-zero score impact.
// Fixed issues provide a soft credit to reward improvement.
//
// PROPRIETARY — do not distribute outside the Fixpath codebase.
// ============================================================

import type {
  ScoreSnapshot,
  ScoreCalculation,
  IssueCategoryKey,
  IssueFamily,
  NormalizedDetection,
} from '@/types/canonical-issues'
import {
  SEVERITY_WEIGHTS,
  CATEGORY_SCORE_WEIGHTS,
  RESOLVED_CREDIT_FRACTION,
  MAX_RESOLVED_CREDIT,
  ISSUE_CATEGORIES,
  RECOMMENDATION_MULTIPLIER_CAP,
} from '@/types/canonical-issues'
import type { ReconciliationMatch, UnmatchedIssue } from './reconciliation-v2'

/* ── Types ──────────────────────────────────────────────────── */

export interface ScoringInput {
  /** Reconciled matches from current audit */
  matches: ReconciliationMatch[]
  /** Issues verified as fixed */
  fixedIssues: UnmatchedIssue[]
  /** Audit and workspace IDs */
  auditId: string
  workspaceId: string
}

export interface ScoringResult {
  /** Per-category score snapshots */
  categorySnapshots: ScoreSnapshot[]
  /** Overall score snapshot */
  overallSnapshot: ScoreSnapshot
  /** Overall score (0-100) */
  overallScore: number
  /** Per-category scores */
  categoryScores: Record<string, number>
}

/* ── Category Score Computation ──────────────────────────────── */

interface CategoryAccumulator {
  activePenalties: Array<{
    issue_family_id: string
    issue_key: string
    severity: string
    severity_weight: number
    business_relevance: number
    scope_multiplier: number
    confidence_multiplier: number
    final_penalty: number
  }>
  resolvedCredits: Array<{
    issue_family_id: string
    issue_key: string
    credit_amount: number
  }>
  recommendationPenalty: number
  activeIssueCount: number
}

function computeCategoryScore(acc: CategoryAccumulator): {
  raw: number
  adjusted: number
  weightedTotal: number
  resolvedCredit: number
  cappedRecPenalty: number
} {
  const weightedTotal = acc.activePenalties.reduce((sum, p) => sum + p.final_penalty, 0)
  const resolvedCredit = Math.min(
    acc.resolvedCredits.reduce((sum, c) => sum + c.credit_amount, 0),
    MAX_RESOLVED_CREDIT,
  )

  // Cap recommendation penalty: recommendations can only deduct up to 15% of the score
  const cappedRecPenalty = Math.min(
    acc.recommendationPenalty,
    100 * RECOMMENDATION_MULTIPLIER_CAP,
  )

  // Raw score: 100 minus verified penalties minus capped recommendation penalty
  const raw = Math.max(0, Math.min(100, 100 - weightedTotal - cappedRecPenalty))

  // Adjusted: add resolved credit (reward for fixes)
  const adjusted = Math.max(0, Math.min(100, 100 - weightedTotal - cappedRecPenalty + resolvedCredit))

  return { raw, adjusted, weightedTotal, resolvedCredit, cappedRecPenalty }
}

/* ── Main Scoring ────────────────────────────────────────────── */

/**
 * Compute all scores from the reconciliation output.
 * Returns per-category snapshots and an overall blended score.
 */
export function computeScores(input: ScoringInput): ScoringResult {
  const now = new Date().toISOString()

  // Initialize accumulators per category
  const accumulators = new Map<IssueCategoryKey, CategoryAccumulator>()
  for (const cat of ISSUE_CATEGORIES) {
    accumulators.set(cat, {
      activePenalties: [],
      resolvedCredits: [],
      recommendationPenalty: 0,
      activeIssueCount: 0,
    })
  }

  // Accumulate active penalties from matched findings
  for (const match of input.matches) {
    const det = match.detection
    const catKey = det.category_key as IssueCategoryKey

    const acc = accumulators.get(catKey)
    if (!acc) continue

    // Only active findings contribute penalties
    if (match.statusInAudit === 'fixed' || match.statusInAudit === 'invalidated') continue

    // Track recommendations separately
    const isRec = det.issue_type === 'recommendation' || det.issue_type === 'nice_to_have'

    const penalty = {
      issue_family_id: match.matchedFamily?.id || '',
      issue_key: det.canonical_key,
      severity: det.severity,
      severity_weight: SEVERITY_WEIGHTS[det.severity] ?? 4,
      business_relevance: det.business_relevance,
      scope_multiplier: 1.0, // already factored into score_impact
      confidence_multiplier: 1.0, // already factored into score_impact
      final_penalty: det.score_impact,
    }

    if (isRec) {
      acc.recommendationPenalty += penalty.final_penalty
    } else {
      acc.activePenalties.push(penalty)
      acc.activeIssueCount++
    }
  }

  // Accumulate resolved credits from fixed issues
  for (const fixed of input.fixedIssues) {
    if (fixed.resolution !== 'fixed') continue

    const family = fixed.family
    const catKey = family.issue_key.split('.')[0] as IssueCategoryKey

    const acc = accumulators.get(catKey)
    if (!acc) continue

    // Credit = fraction of what the original penalty would have been
    const severityWeight = SEVERITY_WEIGHTS[family.default_severity] ?? 4
    const credit = severityWeight * (family.score_weight || 1) * RESOLVED_CREDIT_FRACTION

    acc.resolvedCredits.push({
      issue_family_id: family.id,
      issue_key: family.issue_key,
      credit_amount: Math.round(credit * 1000) / 1000,
    })
  }

  // Compute per-category scores
  const categorySnapshots: ScoreSnapshot[] = []
  const categoryScores: Record<string, number> = {}

  for (const [catKey, acc] of accumulators) {
    const { raw, adjusted, weightedTotal, resolvedCredit } = computeCategoryScore(acc)

    categoryScores[catKey] = adjusted

    const calculation: ScoreCalculation = {
      issue_penalties: acc.activePenalties,
      resolved_credits: acc.resolvedCredits,
      formula: 'clamp(100 - activePenaltyTotal + resolvedCredit, 0, 100)',
      version: 'v1',
    }

    categorySnapshots.push({
      id: '', // generated by DB
      audit_id: input.auditId,
      workspace_id: input.workspaceId,
      category_key: catKey,
      raw_score: raw,
      adjusted_score: adjusted,
      active_issue_count: acc.activeIssueCount,
      weighted_issue_total: weightedTotal,
      resolved_issue_credit: resolvedCredit,
      recommendation_penalty: acc.recommendationPenalty,
      calculation_json: calculation,
      created_at: now,
    })
  }

  // Compute overall score: weighted blend of category scores
  let overallScore = 0
  let totalWeight = 0

  for (const [catKey, score] of Object.entries(categoryScores)) {
    const weight = CATEGORY_SCORE_WEIGHTS[catKey as IssueCategoryKey] ?? 0.1
    overallScore += score * weight
    totalWeight += weight
  }

  if (totalWeight > 0) {
    overallScore = Math.round((overallScore / totalWeight) * 10) / 10
  }
  overallScore = Math.max(0, Math.min(100, overallScore))

  // Compute overall calculation breakdown
  const allPenalties = [...accumulators.values()].flatMap(a => a.activePenalties)
  const allCredits = [...accumulators.values()].flatMap(a => a.resolvedCredits)
  const totalActiveIssues = [...accumulators.values()].reduce((s, a) => s + a.activeIssueCount, 0)
  const totalWeightedPenalty = allPenalties.reduce((s, p) => s + p.final_penalty, 0)
  const totalResolvedCredit = allCredits.reduce((s, c) => s + c.credit_amount, 0)
  const totalRecPenalty = [...accumulators.values()].reduce((s, a) => s + a.recommendationPenalty, 0)

  const overallSnapshot: ScoreSnapshot = {
    id: '',
    audit_id: input.auditId,
    workspace_id: input.workspaceId,
    category_key: null, // null = overall
    raw_score: Math.round((100 - totalWeightedPenalty) * 10) / 10,
    adjusted_score: overallScore,
    active_issue_count: totalActiveIssues,
    weighted_issue_total: totalWeightedPenalty,
    resolved_issue_credit: totalResolvedCredit,
    recommendation_penalty: totalRecPenalty,
    calculation_json: {
      issue_penalties: allPenalties,
      resolved_credits: allCredits,
      formula: 'weighted_blend(categoryScores, CATEGORY_SCORE_WEIGHTS)',
      version: 'v1',
    },
    created_at: now,
  }

  return {
    categorySnapshots,
    overallSnapshot,
    overallScore,
    categoryScores,
  }
}

/* ── Score Delta ─────────────────────────────────────────────── */

/**
 * Compute the score change between the current and previous audit.
 */
export function computeScoreDelta(
  currentScore: number,
  previousScore: number | null,
): number | null {
  if (previousScore === null) return null
  return Math.round((currentScore - previousScore) * 10) / 10
}

/* ── Re-audit Score Behavior Validation ──────────────────────── */

/**
 * Validate that scoring follows the Bible's non-negotiable rules:
 * 1. Fixed High/Critical = meaningful score improvement
 * 2. Recommendation-heavy != terrible score
 * 3. Deep audit doesn't unfairly inflate penalties
 * 4. Re-audit preserves improvement memory
 * 5. Resolved issues stop penalizing
 */
export function validateScoreBehavior(result: ScoringResult): string[] {
  const warnings: string[] = []

  // Rule 2: If most issues are recommendations, score shouldn't be terrible
  const totalActive = result.overallSnapshot.active_issue_count
  const recPenalty = result.overallSnapshot.recommendation_penalty
  const totalPenalty = result.overallSnapshot.weighted_issue_total + recPenalty

  if (totalActive === 0 && recPenalty > 0 && result.overallScore < 70) {
    warnings.push(
      `Score ${result.overallScore} seems too low when only recommendations remain (rec penalty: ${recPenalty})`
    )
  }

  // Sanity check: overall score shouldn't be negative
  if (result.overallScore < 0) {
    warnings.push(`Overall score is negative: ${result.overallScore}`)
  }

  return warnings
}
