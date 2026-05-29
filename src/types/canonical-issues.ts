// ============================================================
// Fixpath — Canonical Issue Types
// ============================================================
// Type definitions for the canonical issue family system.
// Implements the Fixpath Audit Bible: stable identities,
// reconciliation-first re-audits, lifecycle tracking,
// and explainable scoring.
// ============================================================

/* ── Issue Family Types ──────────────────────────────────────── */

export type IssueFamilyType =
  | 'verified_issue'
  | 'meaningful_weakness'
  | 'recommendation'
  | 'nice_to_have'

export type IssueLifecycleState =
  | 'open'
  | 'improved'
  | 'resolved'
  | 'regressed'
  | 'merged'
  | 'invalidated'
  | 'archived'

export type IssueFamilyFixStatus =
  | 'none'
  | 'suggested'
  | 'approved'
  | 'implemented'
  | 'pending_verification'
  | 'validated_fixed'

export type MatchingStrategy = 'canonical_key' | 'semantic' | 'evidence'

export interface IssueFamily {
  id: string
  workspace_id: string
  category_key: string
  issue_key: string
  issue_type: IssueFamilyType
  title_canonical: string
  description_canonical: string | null
  default_severity: 'critical' | 'high' | 'medium' | 'low'
  score_weight: number
  matching_strategy: MatchingStrategy
  scope_signature: string | null
  current_lifecycle_state: IssueLifecycleState
  fix_status: IssueFamilyFixStatus
  fix_source: string | null
  fix_updated_at: string | null
  first_seen_audit_id: string | null
  last_seen_audit_id: string | null
  times_seen: number
  created_at: string
  updated_at: string
}

/* ── Finding Status in Audit ─────────────────────────────────── */

export type FindingStatusInAudit =
  | 'new'
  | 'still_present'
  | 'improved'
  | 'fixed'
  | 'regressed'
  | 'duplicate'
  | 'superseded'
  | 'invalidated'

/* ── Audit Run Classification ────────────────────────────────── */

export type AuditRunType =
  | 'first_audit'
  | 'reaudit'
  | 'deep_audit'
  | 'post_fix_verification'

export type AuditTriggerSource =
  | 'manual'
  | 'scheduled'
  | 'post_fix'
  | 'api'
  | 'webhook'

/* ── Finding Evidence ────────────────────────────────────────── */

export type EvidenceType =
  | 'page'
  | 'dom_signal'
  | 'crawl_signal'
  | 'content_pattern'
  | 'screenshot'
  | 'metric'
  | 'ai_probe'

export interface FindingEvidence {
  id: string
  audit_finding_id: string
  evidence_type: EvidenceType
  page_url: string | null
  selector_or_location: string | null
  raw_value: string | null
  normalized_value: string | null
  snapshot_json: Record<string, unknown> | null
  created_at: string
}

/* ── Issue Lifecycle Events ──────────────────────────────────── */

export type LifecycleEventType =
  | 'detected'
  | 'matched'
  | 'improved'
  | 'fixed'
  | 'regressed'
  | 'merged'
  | 'invalidated'
  | 'reopened'
  | 'user_confirmed_fix'
  | 'severity_changed'

export interface IssueLifecycleEvent {
  id: string
  issue_family_id: string
  audit_id: string | null
  event_type: LifecycleEventType
  old_state: string | null
  new_state: string | null
  reason: string | null
  metadata_json: Record<string, unknown> | null
  created_at: string
}

/* ── Score Snapshots ─────────────────────────────────────────── */

export interface ScoreSnapshot {
  id: string
  audit_id: string
  workspace_id: string
  category_key: string | null  // null = overall
  raw_score: number | null
  adjusted_score: number | null
  active_issue_count: number
  weighted_issue_total: number
  resolved_issue_credit: number
  recommendation_penalty: number
  calculation_json: ScoreCalculation | null
  created_at: string
}

export interface ScoreCalculation {
  /** Individual issue penalties that sum to weighted_issue_total */
  issue_penalties: Array<{
    issue_family_id: string
    issue_key: string
    severity: string
    severity_weight: number
    business_relevance: number
    scope_multiplier: number
    confidence_multiplier: number
    final_penalty: number
  }>
  /** Resolved issues providing credit */
  resolved_credits: Array<{
    issue_family_id: string
    issue_key: string
    credit_amount: number
  }>
  /** Formula applied */
  formula: string
  /** Score model version */
  version: string
}

/* ── Reconciliation Summary (stored on audit) ────────────────── */

export interface ReconciliationSummaryV2 {
  /** Total findings matched to existing issue families */
  matched_count: number
  /** Total new issue families created */
  new_count: number
  /** Issues verified as fixed */
  fixed_count: number
  /** Issues that regressed */
  regressed_count: number
  /** Issues still present */
  still_present_count: number
  /** Issues improved but not fully fixed */
  improved_count: number
  /** Issues not reverified (page not crawled) */
  not_reverified_count: number
  /** Previous audit ID used for reconciliation */
  previous_audit_id: string | null
  /** Previous open issue count */
  previous_open_issue_count: number
  /** Score change */
  score_delta: number | null
}

/* ── Normalized Detection (intermediate pipeline object) ─────── */

export interface NormalizedDetection {
  /** Generated canonical issue key */
  canonical_key: string
  /** Category key (brand, content, trust, ux, technical, discoverability, accessibility) */
  category_key: string
  /** Issue family identifier (without category prefix and scope suffix) */
  issue_family_key: string
  /** Scope signature */
  scope_signature: string
  /** Issue type classification */
  issue_type: IssueFamilyType
  /** Severity */
  severity: 'critical' | 'high' | 'medium' | 'low'
  /** Confidence 0-1 */
  confidence: number
  /** Business relevance multiplier 0.75-1.5 */
  business_relevance: number
  /** Title for display */
  title: string
  /** Finding description text */
  finding_text: string
  /** Why this matters to the user */
  why_it_matters: string
  /** Evidence bundle */
  evidence: Array<{
    type: EvidenceType
    page_url?: string
    selector?: string
    raw_value?: string
    normalized_value?: string
  }>
  /** Fix recommendation */
  fix_recommendation: string
  /** Impact summary */
  impact_summary: string
  /** Pages affected */
  pages_affected: string[]
  /** Page count */
  page_count: number
  /** Template types affected */
  template_types: string[]
  /** Score impact (computed) */
  score_impact: number
  /** Original finding reference (for linking back) */
  source_finding_id?: string
  /** Original finding data (for DB writes) */
  source_finding?: Record<string, unknown>
}

/* ── Category Definitions ────────────────────────────────────── */

export const ISSUE_CATEGORIES = [
  'brand',
  'content',
  'trust',
  'ux',
  'technical',
  'discoverability',
  'accessibility',
] as const

export type IssueCategoryKey = typeof ISSUE_CATEGORIES[number]

/** Maps the 24 analyzer category indices to the 7 canonical issue categories */
export const CATEGORY_INDEX_TO_KEY: Record<number, IssueCategoryKey> = {
  // Foundation (0-3)
  0: 'ux',            // Visual Design & First Impression
  1: 'brand',         // Value Proposition & Messaging
  2: 'ux',            // Navigation & Information Architecture
  3: 'content',       // Content Quality & Readability
  // Human Experience (4-7)
  4: 'ux',            // Calls-to-Action & Conversion Path
  5: 'trust',         // Trust, Credibility & Social Proof
  6: 'ux',            // Ethical UX & Dark Pattern Detection
  7: 'ux',            // Emotional Design & Psychological Safety
  // Inclusive Design (8-11)
  8: 'accessibility', // Accessibility & WCAG
  9: 'accessibility', // Cognitive Accessibility
  10: 'ux',           // Digital Wellbeing
  11: 'ux',           // Mobile Experience
  // Future Readiness (12-15)
  12: 'technical',    // Performance
  13: 'discoverability', // AI Discoverability
  14: 'discoverability', // Agent Readiness
  15: 'content',      // Global Reach
  // SEO (16-19)
  16: 'technical',    // Technical SEO
  17: 'discoverability', // Structured Data
  18: 'discoverability', // Crawler Optimization
  19: 'discoverability', // Search Discoverability
  // Brand Consistency (20-23)
  20: 'brand',        // Identity Consistency
  21: 'brand',        // Messaging Consistency
  22: 'brand',        // Visual System
  23: 'brand',        // Tone of Voice
}

/* ── Scoring Constants ───────────────────────────────────────── */

export const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 20,
  high: 10,
  medium: 4,
  low: 1,
}

export const SCOPE_MULTIPLIERS = {
  single_page: 1.0,
  key_template: 1.25,
  sitewide: 1.5,
} as const

export const CONFIDENCE_MULTIPLIERS = {
  high: 1.0,      // confidence >= 0.8
  medium: 0.7,    // confidence >= 0.5
  low: 0.3,       // confidence < 0.5
} as const

export const RECOMMENDATION_MULTIPLIER_CAP = 0.15

/** Category weights for overall score blending */
export const CATEGORY_SCORE_WEIGHTS: Record<IssueCategoryKey, number> = {
  brand: 0.15,
  content: 0.15,
  trust: 0.15,
  ux: 0.20,
  technical: 0.15,
  discoverability: 0.10,
  accessibility: 0.10,
}

/** Resolved issue credit as fraction of original penalty (0.25 = 25% credit) */
export const RESOLVED_CREDIT_FRACTION = 0.25

/** Maximum total resolved credit per category */
export const MAX_RESOLVED_CREDIT = 15
