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
  }
}
