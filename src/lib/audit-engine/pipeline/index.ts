// ============================================================
// ClearUX Proprietary Pipeline — Orchestrator
// ============================================================
//
// This is the entry point for the post-processing pipeline.
// It runs all proprietary processing steps on raw AI findings
// before they reach the user, AND feeds user actions back into
// the learning loop.
//
// ARCHITECTURE:
//
//   AI generates raw findings
//       ↓
//   ┌─────────────────────────────────────┐
//   │  1. DEDUP ENGINE                    │  → Merge near-duplicate findings
//   │     pipeline/dedup.ts               │     (synonym matching + topic fingerprints)
//   │                                     │
//   │  2. SPECULATIVE FILTER              │  → Remove findings the AI can't verify
//   │     pipeline/speculative-filter.ts   │     (text-only constraint violations)
//   │                                     │
//   │  3. PROMPT RULES                    │  → Rules injected into AI prompts
//   │     pipeline/prompt-rules.ts        │     (evidence gates, false-positive whitelist)
//   │                                     │
//   │  4. RELEVANCE SCORER                │  → Score findings by historical dismiss rate
//   │     pipeline/relevance-scorer.ts    │     (auto-remove consistently rejected findings)
//   │                                     │
//   │  5. SITE MEMORY                     │  → Per-domain intelligence injection
//   │     pipeline/site-memory.ts         │     (dismissed findings, user context, learned patterns)
//   │                                     │
//   │  6. PATTERN LEARNER                 │  → Detect recurring false positives
//   │     pipeline/pattern-learner.ts     │     (propose new filter rules from data)
//   │                                     │
//   │  7. GLOBAL QUALITY STATS            │  → Cross-user aggregate metrics
//   │     pipeline/quality-stats.ts       │     (FP rate per topic/severity/module)
//   └─────────────────────────────────────┘
//       ↓
//   Clean findings shown to user
//       ↓
//   User actions (dismiss/fix/accept)
//       ↓
//   ┌─────────────────────────────────────┐
//   │  FEEDBACK LOOP:                     │
//   │  - Record action in finding_patterns│
//   │  - Update global_quality_stats      │
//   │  - Run post-audit learning check    │
//   │  - Log rule proposals in changelog  │
//   └─────────────────────────────────────┘
//       ↓
//   Next audit uses improved pipeline
//
// FOLDER MAP:
//   pipeline/
//   ├── index.ts              ← You are here (orchestrator + exports)
//   ├── dedup.ts              ← Deduplication engine
//   ├── speculative-filter.ts ← Speculative finding removal
//   ├── prompt-rules.ts       ← AI prompt quality rules (data)
//   ├── relevance-scorer.ts   ← Historical relevance scoring
//   ├── site-memory.ts        ← Per-domain intelligence
//   ├── pattern-learner.ts    ← Automated rule learning
//   └── quality-stats.ts      ← Global quality metrics
//
// ============================================================

// ── Step 1: Deduplication ───────────────────────────────────
export { identifyDuplicates, identifyTemplateGroups, SYNONYM_GROUPS, TOPIC_PATTERNS, THRESHOLDS, CONFIDENCE_RANK } from './dedup'
export type { FindingForDedup, TemplateGroup } from './dedup'

// ── Step 2: Speculative Filter ──────────────────────────────
export { identifySpeculativeFindings, SPECULATIVE_LANGUAGE, UNVERIFIABLE_TOPICS } from './speculative-filter'
export type { FindingForFilter } from './speculative-filter'

// ── Step 3: Prompt Rules ────────────────────────────────────
export {
  composePromptRules,
  EVIDENCE_RULES,
  TEXT_ONLY_CONSTRAINTS,
  JS_CONTENT_AWARENESS,
  CONTEXT_AWARENESS,
  CROSS_PAGE_AWARENESS,
  DEMO_EXCLUSION,
  THIRD_PARTY_EXCLUSION,
  SUBJECTIVE_FILTER,
  FALSE_POSITIVE_WHITELIST,
  DUPLICATE_PREVENTION,
  QUALITY_SELF_CHECK,
  HIGH_VALUE_GUIDANCE,
  SITE_TYPE_SCOPE_FILTER,
  FINDING_TYPE_CLASSIFICATION,
} from './prompt-rules'

// ── Step 3b: Finding Classifier ─────────────────────────────
export {
  classifyFinding,
  classifyFindings,
  validateFixableRecommendation,
  isSimpleSite,
  filterSimpleSiteFindings,
} from './finding-classifier'
export type { ClassifiableFinding } from './finding-classifier'

// ── Step 4: Relevance Scorer ────────────────────────────────
export {
  scoreFindings,
  recordFindingShown,
  recordFindingAction as recordFindingActionInPatterns,
  createTitleFingerprint,
  RELEVANCE_CONFIG,
} from './relevance-scorer'
export type { FindingForScoring, ScoredFinding } from './relevance-scorer'

// ── Step 5: Site Memory ─────────────────────────────────────
export {
  loadSiteMemory,
  hasSiteMemory,
  SITE_MEMORY_CONFIG,
} from './site-memory'
export type { SiteMemory } from './site-memory'

// ── Step 6: Pattern Learner ─────────────────────────────────
export {
  runLearningCycle,
  postAuditLearn,
  getPendingProposals,
  LEARNER_CONFIG,
} from './pattern-learner'
export type { LearnedRule, LearningReport } from './pattern-learner'

// ── Step 8: Minimum Findings Check ──────────────────────────
export {
  identifyStarvedCategories,
  getModuleForCategory,
} from './minimum-findings'
export type { CategoryFindingCount } from './minimum-findings'

// ── Step 7b: Confidence Rules ───────────────────────────────
export {
  softenInterpretiveLanguage,
  identifyStaleFindings,
  CONFIDENCE_WEIGHT,
} from './confidence-rules'
export type { FindingForConfidenceCheck, LanguageFix, StaleResult } from './confidence-rules'

// ── Step 7: Global Quality Stats ────────────────────────────
export {
  recordAuditStats,
  recordFindingAction as recordFindingActionInStats,
  getQualitySnapshot,
  getWorstTopics,
} from './quality-stats'
export type { QualitySnapshot } from './quality-stats'

// ── Step 9: WCAG 2.1 AA Checker ────────────────────────────
export {
  checkWcagAutomated,
  buildWcagResults,
  parseHeuristicResponse,
  formatWcagForPrompt,
  buildHeuristicPrompt,
  WCAG_CRITERIA,
} from './wcag-checker'
export type {
  WcagPrinciple,
  WcagStatus,
  WcagCheckMethod,
  WcagCriterion,
  WcagCheckResult,
  WcagIssue,
  WcagPageResult,
  WcagFinding,
  WcagAuditResult,
} from './wcag-checker'

// ── Step 10: Canonical Issue Identity ──────────────────────
export {
  normalizeDetection,
  extractIssueFamily,
  generateScopeSignature,
  buildCanonicalKey,
  classifyIssueType,
  estimateBusinessRelevance,
  getScopeMultiplier,
  getConfidenceMultiplier,
  calculateScoreImpact,
} from './canonical-identity'

// ── Step 11: Reconciliation v2 (Canonical) ─────────────────
export {
  reconcileV2,
  normalizeDetections,
} from './reconciliation-v2'
export type {
  ReconciliationContext,
  PriorContext,
  ReconciliationMatch,
  UnmatchedIssue,
  ReconciliationResult,
} from './reconciliation-v2'

// ── Step 12: Scoring Engine ────────────────────────────────
export {
  computeScores,
  computeScoreDelta,
  validateScoreBehavior,
} from './scoring-engine'
export type {
  ScoringInput,
  ScoringResult,
} from './scoring-engine'

// ── Step 13: Reconciliation Persistence ────────────────────
export {
  loadPriorContext,
  persistIssueFamilies,
  updateFindingsWithReconciliation,
  writeLifecycleEvents,
  persistScoreSnapshots,
  updateAuditWithReconciliation,
  runFullReconciliation,
} from './reconciliation-persist'

// ── Step 14: Communication Layer ───────────────────────────
export {
  enrichWithCommunication,
  buildCommunicationForGenericFinding,
  buildCommunicationFromAnalysis,
  synthesizeCommunication,
} from './communication-layer'
export type { FindingWithCommunication, GenericFinding } from './communication-layer'

// ── Step 10-11 (Legacy): Original Reconciliation ───────────
export {
  reconcileFindings,
} from './reconciliation'
export type {
  ReconciliationStatus,
  ReconciliationItem,
  ReconciliationSummary,
  ReconciliationResult as LegacyReconciliationResult,
} from './reconciliation'

// ── Debug: Finding Lifecycle Trace ─────────────────────────
export {
  FindingTracer,
  createTracer,
} from './finding-trace'
export type {
  TraceAction,
  TraceEvent,
  FindingTrace,
} from './finding-trace'
