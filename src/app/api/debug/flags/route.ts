// ============================================================
// GET /api/debug/flags — operator feature-flag visibility
// ============================================================
// Returns the resolved (boolean) feature flags so we can confirm an env var
// actually bound after a deploy, instead of guessing. Flags are non-sensitive
// operator toggles (no secrets, no PII) — safe to expose. Cached off so it
// always reflects the running build's env.

import { NextResponse } from 'next/server'
import { getFeatureFlags } from '@/lib/feature-flags'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export function GET() {
  return NextResponse.json({
    flags: getFeatureFlags(),
    runtime: {
      // Presence-only — never echo the value, just whether it parsed to the
      // expected 'true'. Confirms the Value field (not the Note) was set.
      FEATURE_FIX_OUTCOMES_is_true: process.env.FEATURE_FIX_OUTCOMES === 'true',
      FEATURE_ANALYZE_FROM_CAPTURE_is_true: process.env.FEATURE_ANALYZE_FROM_CAPTURE === 'true',
    },
    at: new Date().toISOString(),
  })
}
