// ============================================================
// ClearUX Proprietary Pipeline — Orchestrator
// ============================================================
//
// This is the entry point for the post-processing pipeline.
// It runs all proprietary processing steps on raw AI findings
// before they reach the user.
//
// ARCHITECTURE:
//
//   AI generates raw findings
//       ↓
//   ┌─────────────────────────────┐
//   │  1. DEDUP ENGINE            │  → Merge near-duplicate findings
//   │     pipeline/dedup.ts       │     (synonym matching + topic fingerprints)
//   │                             │
//   │  2. SPECULATIVE FILTER      │  → Remove findings the AI couldn't verify
//   │     pipeline/speculative-   │     (text-only constraint violations)
//   │     filter.ts               │
//   │                             │
//   │  3. PROMPT RULES            │  → Rules injected into AI prompts
//   │     pipeline/prompt-rules.ts│     (evidence gates, false-positive whitelist)
//   │                             │
//   │  (future steps here)        │
//   └─────────────────────────────┘
//       ↓
//   Clean findings shown to user
//
// WHEN TO ADD A NEW STEP:
// 1. Create a new file in this folder (e.g., severity-calibrator.ts)
// 2. Export a function that takes findings and returns IDs to modify/remove
// 3. Add it to the pipeline below
// 4. Add it to the exports at the bottom of this file
//
// FOLDER MAP:
//   pipeline/
//   ├── index.ts              ← You are here (orchestrator + exports)
//   ├── dedup.ts              ← Deduplication engine
//   ├── speculative-filter.ts ← Speculative finding removal
//   └── prompt-rules.ts       ← AI prompt quality rules (data)
//
// ============================================================

// Re-export everything for clean imports
export { identifyDuplicates, SYNONYM_GROUPS, TOPIC_PATTERNS, THRESHOLDS } from './dedup'
export type { FindingForDedup } from './dedup'

export { identifySpeculativeFindings, SPECULATIVE_LANGUAGE, UNVERIFIABLE_TOPICS } from './speculative-filter'
export type { FindingForFilter } from './speculative-filter'

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
} from './prompt-rules'
