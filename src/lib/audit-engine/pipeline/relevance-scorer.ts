// ============================================================
// ClearUX Proprietary Pipeline — Relevance Scorer
// ============================================================
//
// PURPOSE:
// Score each finding against historical dismiss/accept patterns.
// Findings that users consistently dismiss get flagged as
// low-confidence, giving the pipeline data to either suppress
// them or mark them for review.
//
// HOW IT WORKS:
// 1. Normalize each finding title into a fingerprint (hash)
// 2. Look up the fingerprint in finding_patterns table
// 3. Calculate a relevance score based on:
//    - Dismiss rate (dismissed / total_shown)
//    - Sample size (more data = more confident)
//    - Severity alignment (does the AI severity match user actions?)
// 4. Return scored findings with confidence metadata
//
// DATA FLOW:
//   finding_patterns table ──→ relevance scores
//   (written by: dismiss feedback + post-audit recording)
//   (read by: this module during pipeline execution)
//
// WHEN TO IMPROVE THIS FILE:
// - If good findings are being flagged as low-confidence → adjust thresholds
// - If bad findings are still passing → lower the confidence floor
// - If a new signal becomes available (e.g., time-to-fix) → add it to scoring
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ───────────────────────────────────────────────────

export interface FindingForScoring {
  id: string
  title: string
  description: string
  severity: string
  confidence_level?: 'deterministic' | 'heuristic' | 'interpretive'
}

export interface ScoredFinding {
  id: string
  relevanceScore: number    // 0.0 - 1.0 (1.0 = highly relevant)
  confidence: number        // 0.0 - 1.0 (how much data backs this score)
  dismissRate: number       // 0.0 - 1.0 (historical dismiss rate)
  dataPoints: number        // how many observations
  flag: 'high' | 'medium' | 'low' | 'no_data'
}

// ── Configuration ───────────────────────────────────────────

export const RELEVANCE_CONFIG = {
  // Minimum observations before we trust the pattern
  MIN_DATA_POINTS: 5,

  // Dismiss rate thresholds
  HIGH_DISMISS_RATE: 0.70,    // 70%+ dismissed → low confidence
  MEDIUM_DISMISS_RATE: 0.50,  // 50-70% dismissed → medium confidence
  LOW_DISMISS_RATE: 0.30,     // <30% dismissed → high confidence

  // Minimum relevance score to keep a finding (below = auto-remove)
  AUTO_REMOVE_THRESHOLD: 0.15,

  // Weight for severity alignment in relevance calculation
  SEVERITY_WEIGHT: 0.2,

  // Confidence scaling — how quickly confidence ramps up with data
  CONFIDENCE_RAMP: 20,  // reaches ~90% confidence at 20 data points
}

// ── Title Fingerprinting ────────────────────────────────────
// Creates a stable hash from a finding title so we can match
// similar findings across audits. Strips noise words, normalizes
// synonyms, and creates a sorted-word signature.

const NOISE_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'can', 'shall', 'must',
  'for', 'and', 'but', 'or', 'nor', 'not', 'no', 'so', 'yet',
  'at', 'by', 'in', 'of', 'on', 'to', 'up', 'out', 'off',
  'with', 'from', 'into', 'over', 'after', 'before', 'between',
  'under', 'about', 'than', 'that', 'this', 'each', 'every',
  'all', 'both', 'few', 'more', 'most', 'some', 'any', 'such',
  'only', 'very', 'too', 'also', 'just',
])

export function createTitleFingerprint(title: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !NOISE_WORDS.has(w))
    .sort()

  return words.join('_')
}

// ── Scoring Logic ───────────────────────────────────────────

function calculateConfidence(dataPoints: number): number {
  // Sigmoid-like ramp: 0 data = 0 confidence, 20+ data ≈ 0.95
  return 1 - Math.exp(-dataPoints / RELEVANCE_CONFIG.CONFIDENCE_RAMP)
}

// Confidence level weights — deterministic findings get a boost,
// interpretive findings get a slight penalty in relevance scoring.
const EVIDENCE_CONFIDENCE_BOOST: Record<string, number> = {
  deterministic: 0.10,   // +10% relevance boost
  heuristic: 0.0,        // neutral
  interpretive: -0.05,   // -5% relevance penalty
}

function calculateRelevanceScore(
  dismissRate: number,
  fixRate: number,
  confidence: number,
  confidenceLevel?: string,
): number {
  // Base relevance: inverse of dismiss rate
  // High dismiss rate → low relevance
  const baseRelevance = 1 - dismissRate

  // Bonus for findings that actually get fixed (users find them actionable)
  const fixBonus = fixRate * 0.2

  // Weighted by confidence — low data = score stays neutral (0.5)
  const rawScore = baseRelevance + fixBonus
  const neutralScore = 0.5
  const weightedScore = neutralScore + (rawScore - neutralScore) * confidence

  // Apply evidence confidence boost/penalty
  const evidenceBoost = EVIDENCE_CONFIDENCE_BOOST[confidenceLevel ?? 'heuristic'] ?? 0

  return Math.max(0, Math.min(1, weightedScore + evidenceBoost))
}

function classifyRelevance(
  relevanceScore: number,
  dataPoints: number,
): 'high' | 'medium' | 'low' | 'no_data' {
  if (dataPoints < RELEVANCE_CONFIG.MIN_DATA_POINTS) return 'no_data'
  if (relevanceScore >= 0.7) return 'high'
  if (relevanceScore >= 0.4) return 'medium'
  return 'low'
}

// ── Public API ──────────────────────────────────────────────

/**
 * Score findings against historical patterns.
 * Returns scored findings with relevance metadata.
 * Findings below AUTO_REMOVE_THRESHOLD are flagged for removal.
 */
export async function scoreFindings(
  findings: FindingForScoring[],
  db: SupabaseClient,
): Promise<{ scored: ScoredFinding[]; removedIds: string[] }> {
  if (findings.length === 0) return { scored: [], removedIds: [] }

  // 1. Create fingerprints for all findings
  const fingerprints = findings.map(f => ({
    finding: f,
    hash: createTitleFingerprint(f.title),
  }))

  // 2. Batch-fetch patterns from DB
  const uniqueHashes = [...new Set(fingerprints.map(f => f.hash))].filter(h => h.length > 0)

  let patternMap = new Map<string, {
    total_shown: number
    total_dismissed: number
    total_fixed: number
    total_accepted: number
  }>()

  if (uniqueHashes.length > 0) {
    const { data: patterns } = await db
      .from('finding_patterns')
      .select('title_hash, total_shown, total_dismissed, total_fixed, total_accepted')
      .in('title_hash', uniqueHashes)

    if (patterns) {
      for (const p of patterns as any[]) {
        patternMap.set(p.title_hash, {
          total_shown: p.total_shown,
          total_dismissed: p.total_dismissed,
          total_fixed: p.total_fixed,
          total_accepted: p.total_accepted,
        })
      }
    }
  }

  // 3. Score each finding
  const scored: ScoredFinding[] = []
  const removedIds: string[] = []

  for (const { finding, hash } of fingerprints) {
    const pattern = patternMap.get(hash)

    if (!pattern || pattern.total_shown === 0) {
      // No historical data — neutral score
      scored.push({
        id: finding.id,
        relevanceScore: 0.5,
        confidence: 0,
        dismissRate: 0,
        dataPoints: 0,
        flag: 'no_data',
      })
      continue
    }

    const dismissRate = pattern.total_dismissed / pattern.total_shown
    const fixRate = pattern.total_fixed / pattern.total_shown
    const confidence = calculateConfidence(pattern.total_shown)
    const relevanceScore = calculateRelevanceScore(dismissRate, fixRate, confidence, finding.confidence_level)
    const flag = classifyRelevance(relevanceScore, pattern.total_shown)

    const scoredFinding: ScoredFinding = {
      id: finding.id,
      relevanceScore,
      confidence,
      dismissRate,
      dataPoints: pattern.total_shown,
      flag,
    }

    scored.push(scoredFinding)

    // Auto-remove findings with very low relevance AND high confidence
    if (
      relevanceScore < RELEVANCE_CONFIG.AUTO_REMOVE_THRESHOLD &&
      confidence > 0.8 &&
      pattern.total_shown >= RELEVANCE_CONFIG.MIN_DATA_POINTS * 2
    ) {
      removedIds.push(finding.id)
    }
  }

  return { scored, removedIds }
}

/**
 * Record a finding in the patterns table.
 * Called when a new finding is shown to the user (increments total_shown).
 */
export async function recordFindingShown(
  db: SupabaseClient,
  title: string,
  severity: string,
  topic?: string,
): Promise<void> {
  const hash = createTitleFingerprint(title)
  if (!hash) return

  const severityWeight: Record<string, number> = {
    critical: 4, high: 3, medium: 2, low: 1,
  }

  // Upsert: increment total_shown, update avg_severity
  const { data: existing } = await db
    .from('finding_patterns')
    .select('id, total_shown, avg_severity')
    .eq('title_hash', hash)
    .single()

  if (existing) {
    const ex = existing as any
    const newTotal = ex.total_shown + 1
    const newAvgSev = ((ex.avg_severity || severityWeight[severity] || 2) * ex.total_shown + (severityWeight[severity] || 2)) / newTotal
    await db
      .from('finding_patterns')
      .update({
        total_shown: newTotal,
        avg_severity: newAvgSev,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', ex.id)
  } else {
    const { error: uncheckedInsertErr1 } = await db
      .from('finding_patterns')
      .insert({
        title_hash: hash,
        canonical_title: title.substring(0, 200),
        topic: topic || null,
        total_shown: 1,
        total_dismissed: 0,
        total_fixed: 0,
        total_accepted: 0,
        avg_severity: severityWeight[severity] || 2,
      } as any)
    if (uncheckedInsertErr1) console.error(`[db] insert failed (finding_patterns): ${uncheckedInsertErr1.message}`)
  }
}

/**
 * Record a user action on a finding (dismiss, fix, accept).
 * Called from the findings API when a user takes action.
 */
export async function recordFindingAction(
  db: SupabaseClient,
  title: string,
  action: 'dismissed' | 'fixed' | 'accepted',
): Promise<void> {
  const hash = createTitleFingerprint(title)
  if (!hash) return

  const columnMap: Record<string, string> = {
    dismissed: 'total_dismissed',
    fixed: 'total_fixed',
    accepted: 'total_accepted',
  }

  const column = columnMap[action]
  if (!column) return

  const { data: existing } = await db
    .from('finding_patterns')
    .select(`id, ${column}`)
    .eq('title_hash', hash)
    .single()

  if (existing) {
    const ex = existing as any
    await db
      .from('finding_patterns')
      .update({
        [column]: (ex[column] || 0) + 1,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', ex.id)
  }
  // If no pattern exists yet, skip — it will be created on next audit
}
