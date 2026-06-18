/**
 * Feature Flags — Simple Environment-Based Feature Gates
 *
 * Uses environment variables for now (simplest for small teams).
 * Can be replaced with a DB-backed system or LaunchDarkly later.
 *
 * Convention: FEATURE_<FLAG_NAME> = 'true' to enable.
 */

export interface FeatureFlags {
  /** Enable browser render fallback for blocked/thin sites */
  protectedSiteMode: boolean
  /** Log detailed acquisition diagnostics to audit_logs */
  acquisitionDiagnostics: boolean
  /** Enable polite crawler behavior (rate limiting, backoff) */
  politeCrawler: boolean
  /**
   * Lean pipeline mode — disables expensive optional stages:
   *   - WCAG heuristic AI (automated checks still run)
   *   - Multi-model benchmark (Benchmark tab shows "not available")
   *   - Brand intelligence sentiment analysis
   *   - Human perception external API calls
   *
   * ON by default. Set FEATURE_LEAN_PIPELINE=false to re-enable all stages.
   * See docs/pipeline-v1.5-analysis.md for the full design rationale.
   */
  leanPipeline: boolean
  /**
   * Capture→Analyze→Compose Phase 1 — write immutable PageCapture artifacts in
   * SHADOW MODE alongside the current pipeline (paid audits only, enforced at
   * the call site). OFF by default: nothing is written, no behavior changes.
   * See docs/AUDIT_PIPELINE_ARCHITECTURE.md.
   */
  captureShadow: boolean
  /**
   * Phase 3 — fix-outcomes verification. When a deterministic finding is marked
   * fixed, a background job re-runs the instrument on its page and records a
   * fix_outcomes row (verified_fixed / not_fixed / inconclusive). OFF by default
   * (dark launch): no event fired, no job effect. See docs/FIX_OUTCOMES_ARCHITECTURE.md.
   */
  fixOutcomes: boolean
  /**
   * Capture→Analyze doctrine — when ON, the LLM analyzer's page-content input is
   * sourced from the immutable PageCapture (via captureToPageContent) instead of
   * the live crawl result, making analysis re-runnable without re-crawling.
   * Applied ONLY to the analyzer's text input, and ONLY when capture parity is
   * full (covers every live page); instrument/SEO checks are untouched. OFF by
   * default (dark launch): analyzer reads the live crawl exactly as before.
   * See docs/AUDIT_PIPELINE_ARCHITECTURE.md.
   */
  analyzeFromCapture: boolean
}

/**
 * Read feature flags from environment variables.
 * All flags default to false (safe — no behavior change).
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    protectedSiteMode: process.env.FEATURE_PROTECTED_SITE_MODE === 'true',
    acquisitionDiagnostics: process.env.FEATURE_ACQUISITION_DIAGNOSTICS === 'true',
    politeCrawler: process.env.FEATURE_POLITE_CRAWLER === 'true',
    leanPipeline: process.env.FEATURE_LEAN_PIPELINE !== 'false', // ON by default
    captureShadow: process.env.FEATURE_CAPTURE_SHADOW === 'true', // OFF by default
    fixOutcomes: process.env.FEATURE_FIX_OUTCOMES === 'true', // OFF by default
    analyzeFromCapture: process.env.FEATURE_ANALYZE_FROM_CAPTURE === 'true', // OFF by default
  }
}
