// ============================================================
// Re-Audit Reconciliation Engine v2
// ============================================================
// Canonical issue family–based reconciliation.
// Implements the 6-phase algorithm from the Fixpath Audit Bible:
//
//   Phase 1 — Load prior context
//   Phase 2 — Generate raw detections (upstream)
//   Phase 3 — Normalize detections
//   Phase 4 — Match against existing issues
//   Phase 5 — Reconcile missing old issues
//   Phase 6 — Produce user-facing findings
//
// The old reconciliation.ts is preserved for backwards compat.
// This engine uses canonical issue keys as the primary identity.
//
// PROPRIETARY — do not distribute outside the Fixpath codebase.
// ============================================================

import type { AuditFinding } from '@/types/database'
import type {
  IssueFamily,
  NormalizedDetection,
  FindingStatusInAudit,
  IssueLifecycleState,
  LifecycleEventType,
  ReconciliationSummaryV2,
  IssueCategoryKey,
} from '@/types/canonical-issues'
import {
  normalizeDetection,
  buildCanonicalKey,
  extractIssueFamily,
  generateScopeSignature,
} from './canonical-identity'

/* ── Types ──────────────────────────────────────────────────── */

export interface ReconciliationContext {
  /** Current audit ID */
  currentAuditId: string
  /** Workspace ID */
  workspaceId: string
  /** Previous successful audit ID (null for first audit) */
  previousAuditId: string | null
  /** Site URL for scope resolution */
  siteUrl: string
  /** Whether this is a deep audit */
  isDeepAudit: boolean
  /** URLs actually crawled in this audit */
  crawledUrls: Set<string>
}

export interface PriorContext {
  /** All open issue families for this workspace */
  openIssueFamilies: IssueFamily[]
  /** Previous audit's findings (for matching) */
  previousFindings: AuditFinding[]
  /** User-confirmed fix statuses */
  userFixStatuses: Map<string, string>
}

export interface ReconciliationMatch {
  /** The normalized detection from current audit */
  detection: NormalizedDetection
  /** Matched issue family (null if new) */
  matchedFamily: IssueFamily | null
  /** Match confidence (0-1) */
  matchConfidence: number
  /** Match method used */
  matchMethod: 'exact_key' | 'category_family_scope' | 'semantic_similarity' | 'new'
  /** Finding status in this audit */
  statusInAudit: FindingStatusInAudit
  /** New lifecycle state for the issue family */
  newLifecycleState: IssueLifecycleState
  /** Lifecycle event to log */
  lifecycleEvent: LifecycleEventType
}

export interface UnmatchedIssue {
  /** The issue family that was not found in current audit */
  family: IssueFamily
  /** Reason for absence */
  resolution: 'fixed' | 'invalidated' | 'not_reverified'
  /** Whether the page was crawled */
  pageWasCrawled: boolean
}

export interface ReconciliationResult {
  /** Matched detections (existing + new issues) */
  matches: ReconciliationMatch[]
  /** Previously open issues not found in current audit */
  unmatchedOldIssues: UnmatchedIssue[]
  /** Summary for storing on the audit record */
  summary: ReconciliationSummaryV2
}

/* ── URL Normalization ───────────────────────────────────────── */

function normalizeUrl(url: string | null): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    return (u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '')).toLowerCase()
  } catch {
    return (url || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
  }
}

/* ── Title Similarity (Jaccard) ──────────────────────────────── */

function tokenize(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 2) // skip tiny words
  )
}

function jaccardSimilarity(a: string, b: string): number {
  const aTokens = tokenize(a)
  const bTokens = tokenize(b)
  if (aTokens.size === 0 && bTokens.size === 0) return 1
  const intersection = [...aTokens].filter(w => bTokens.has(w)).length
  const union = new Set([...aTokens, ...bTokens]).size
  return union > 0 ? intersection / union : 0
}

/* ── Phase 3: Normalize Detections ───────────────────────────── */

/**
 * Normalize an array of raw findings into NormalizedDetections.
 * This adds canonical keys, issue types, and score impacts.
 */
export function normalizeDetections(
  findings: AuditFinding[],
  siteUrl: string,
): NormalizedDetection[] {
  return findings.map(f => normalizeDetection(f, siteUrl))
}

/* ── Phase 4: Match Against Existing Issues ──────────────────── */

/**
 * Attempt to match a detection against existing issue families.
 * 4-step matching order per the spec:
 *   1. Exact canonical key match
 *   2. Same category + same issue family + overlapping scope
 *   3. Semantic/evidence similarity
 *   4. New issue (no match)
 */
function matchDetection(
  detection: NormalizedDetection,
  families: IssueFamily[],
  usedFamilyIds: Set<string>,
): { family: IssueFamily; confidence: number; method: ReconciliationMatch['matchMethod'] } | null {

  // Step 1: Exact canonical key match
  for (const family of families) {
    if (usedFamilyIds.has(family.id)) continue
    if (family.issue_key === detection.canonical_key) {
      return { family, confidence: 1.0, method: 'exact_key' }
    }
  }

  // Step 2: Same category + issue family key + overlapping scope
  for (const family of families) {
    if (usedFamilyIds.has(family.id)) continue

    // Parse the family's issue key: category.family.scope
    const parts = family.issue_key.split('.')
    if (parts.length < 2) continue

    const familyCat = parts[0]
    const familyKey = parts[1]
    const familyScope = parts.slice(2).join('.')

    const sameCat = familyCat === detection.category_key
    const sameFamily = familyKey === detection.issue_family_key

    if (sameCat && sameFamily) {
      // Check scope overlap
      const scopeOverlap = computeScopeOverlap(familyScope, detection.scope_signature)
      if (scopeOverlap > 0.3) {
        const confidence = 0.7 + scopeOverlap * 0.2
        return { family, confidence: Math.min(confidence, 0.95), method: 'category_family_scope' }
      }
    }
  }

  // Step 3: Semantic/evidence similarity (title + description)
  let bestSemantic: { family: IssueFamily; score: number } | null = null

  for (const family of families) {
    if (usedFamilyIds.has(family.id)) continue

    // Must be same category for semantic match
    const familyCat = family.issue_key.split('.')[0]
    if (familyCat !== detection.category_key) continue

    // Title similarity
    const titleSim = jaccardSimilarity(detection.title, family.title_canonical)

    // Description similarity (if available)
    const descSim = family.description_canonical
      ? jaccardSimilarity(detection.finding_text, family.description_canonical)
      : 0

    const combinedScore = titleSim * 0.6 + descSim * 0.4

    if (combinedScore >= 0.45 && (!bestSemantic || combinedScore > bestSemantic.score)) {
      bestSemantic = { family, score: combinedScore }
    }
  }

  if (bestSemantic) {
    return {
      family: bestSemantic.family,
      confidence: Math.min(0.85, 0.5 + bestSemantic.score * 0.4),
      method: 'semantic_similarity',
    }
  }

  // Step 4: No match found
  return null
}

/**
 * Compute overlap between two scope signatures.
 * Returns 0-1 where 1 = identical, 0.5 = one subsumes the other, 0 = unrelated.
 */
function computeScopeOverlap(scopeA: string, scopeB: string): number {
  if (scopeA === scopeB) return 1.0

  // Sitewide subsumes everything
  if (scopeA === 'sitewide' || scopeB === 'sitewide') return 0.6

  // Template matches are broader
  if (scopeA.includes('template') && scopeB.includes('template')) {
    return scopeA === scopeB ? 1.0 : 0.3
  }

  // Page-specific: check path overlap
  const pathA = scopeA.replace('page:', '')
  const pathB = scopeB.replace('page:', '')
  if (pathA === pathB) return 1.0
  if (pathA.startsWith(pathB) || pathB.startsWith(pathA)) return 0.5

  return 0
}

/* ── Phase 5: Reconcile Missing Old Issues ───────────────────── */

/**
 * For previously open issues not matched in the current audit,
 * determine whether they are fixed, invalidated, or not reverified.
 */
function reconcileUnmatched(
  family: IssueFamily,
  crawledUrls: Set<string>,
  userFixStatuses: Map<string, string>,
): UnmatchedIssue {
  // Check if user has marked this as fixed
  const userStatus = userFixStatuses.get(family.id)
  if (userStatus === 'validated_fixed' || userStatus === 'implemented') {
    return { family, resolution: 'fixed', pageWasCrawled: true }
  }

  // Check if the scope's page was crawled
  const normalizedCrawled = new Set([...crawledUrls].map(u => normalizeUrl(u)))
  const scope = family.scope_signature || ''

  let pageWasCrawled = false

  if (scope === 'sitewide' || scope === 'homepage') {
    // If we crawled anything, sitewide and homepage scopes are covered
    pageWasCrawled = normalizedCrawled.size > 0
  } else if (scope.startsWith('page:')) {
    const path = scope.replace('page:', '')
    pageWasCrawled = [...normalizedCrawled].some(u => u.includes(path))
  } else if (scope.includes('template')) {
    // Template scopes — consider covered if any template pages were crawled
    pageWasCrawled = normalizedCrawled.size >= 2
  } else {
    // Unknown scope — be conservative
    pageWasCrawled = normalizedCrawled.size > 0
  }

  if (pageWasCrawled) {
    return { family, resolution: 'fixed', pageWasCrawled: true }
  }

  return { family, resolution: 'not_reverified', pageWasCrawled: false }
}

/* ── Determine Finding Status in Audit ───────────────────────── */

function determineFindingStatus(
  matchedFamily: IssueFamily | null,
  detection: NormalizedDetection,
): { status: FindingStatusInAudit; lifecycleState: IssueLifecycleState; event: LifecycleEventType } {

  if (!matchedFamily) {
    return { status: 'new', lifecycleState: 'open', event: 'detected' }
  }

  const prevState = matchedFamily.current_lifecycle_state

  // Was previously resolved — it's a regression
  if (prevState === 'resolved' || prevState === 'invalidated') {
    return { status: 'regressed', lifecycleState: 'regressed', event: 'regressed' }
  }

  // Was previously merged — treat as still present under the merged target
  if (prevState === 'merged') {
    return { status: 'still_present', lifecycleState: 'open', event: 'matched' }
  }

  // Check if severity improved
  const prevSeverity = matchedFamily.default_severity
  const currSeverity = detection.severity
  const severityOrder = { critical: 3, high: 2, medium: 1, low: 0 }
  const prevRank = severityOrder[prevSeverity] ?? 1
  const currRank = severityOrder[currSeverity] ?? 1

  if (currRank < prevRank) {
    return { status: 'improved', lifecycleState: 'improved', event: 'improved' }
  }

  if (currRank > prevRank) {
    return { status: 'regressed', lifecycleState: 'regressed', event: 'regressed' }
  }

  // Same severity — still present
  return { status: 'still_present', lifecycleState: 'open', event: 'matched' }
}

/* ── Main Reconciliation ─────────────────────────────────────── */

/**
 * Run the full 6-phase reconciliation algorithm.
 *
 * Phase 1 (load prior context) is handled by the caller.
 * Phase 2 (generate raw detections) is handled by the pipeline.
 * This function covers Phases 3-6.
 */
export function reconcileV2(
  currentFindings: AuditFinding[],
  ctx: ReconciliationContext,
  prior: PriorContext,
): ReconciliationResult {
  // Phase 3: Normalize detections
  const detections = normalizeDetections(currentFindings, ctx.siteUrl)

  // Phase 4: Match against existing issues
  const usedFamilyIds = new Set<string>()
  const matches: ReconciliationMatch[] = []

  // Sort detections by score impact (highest first) to give best matches to most important issues
  const sortedDetections = [...detections].sort((a, b) => b.score_impact - a.score_impact)

  for (const detection of sortedDetections) {
    const match = matchDetection(detection, prior.openIssueFamilies, usedFamilyIds)

    if (match) {
      usedFamilyIds.add(match.family.id)
      const { status, lifecycleState, event } = determineFindingStatus(match.family, detection)

      matches.push({
        detection,
        matchedFamily: match.family,
        matchConfidence: match.confidence,
        matchMethod: match.method,
        statusInAudit: status,
        newLifecycleState: lifecycleState,
        lifecycleEvent: event,
      })
    } else {
      // Apply deep audit gate: new findings need stricter evidence on re-audits
      if (ctx.isDeepAudit && ctx.previousAuditId) {
        const passesDeepGate = detection.confidence >= 0.7 &&
          detection.issue_type !== 'nice_to_have' &&
          detection.issue_type !== 'recommendation'

        if (!passesDeepGate) {
          // Downgrade to recommendation instead of verified issue
          detection.issue_type = 'recommendation'
          detection.score_impact = detection.score_impact * 0.15
        }
      }

      matches.push({
        detection,
        matchedFamily: null,
        matchConfidence: 0,
        matchMethod: 'new',
        statusInAudit: 'new',
        newLifecycleState: 'open',
        lifecycleEvent: 'detected',
      })
    }
  }

  // Phase 5: Reconcile missing old issues
  const unmatchedOldIssues: UnmatchedIssue[] = []

  for (const family of prior.openIssueFamilies) {
    if (usedFamilyIds.has(family.id)) continue

    // Skip already resolved/archived families
    if (family.current_lifecycle_state === 'resolved' ||
        family.current_lifecycle_state === 'archived' ||
        family.current_lifecycle_state === 'invalidated') {
      continue
    }

    const unmatched = reconcileUnmatched(family, ctx.crawledUrls, prior.userFixStatuses)
    unmatchedOldIssues.push(unmatched)
  }

  // Phase 6: Build summary
  const summary: ReconciliationSummaryV2 = {
    matched_count: matches.filter(m => m.matchedFamily !== null).length,
    new_count: matches.filter(m => m.matchMethod === 'new').length,
    fixed_count: unmatchedOldIssues.filter(u => u.resolution === 'fixed').length,
    regressed_count: matches.filter(m => m.statusInAudit === 'regressed').length,
    still_present_count: matches.filter(m => m.statusInAudit === 'still_present').length,
    improved_count: matches.filter(m => m.statusInAudit === 'improved').length,
    not_reverified_count: unmatchedOldIssues.filter(u => u.resolution === 'not_reverified').length,
    previous_audit_id: ctx.previousAuditId,
    previous_open_issue_count: prior.openIssueFamilies.length,
    score_delta: null, // computed after scoring
  }

  return { matches, unmatchedOldIssues, summary }
}
