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
  const flags = getFeatureFlags()
  // Plain text so it's readable by both a browser and simple fetchers (JSON
  // bodies don't always render). Presence-only on the raw env — never echo
  // the value, just whether it parsed to the expected 'true'.
  const lines = [
    `at=${new Date().toISOString()}`,
    ...Object.entries(flags).map(([k, v]) => `flag.${k}=${v}`),
    `env.FEATURE_FIX_OUTCOMES_is_true=${process.env.FEATURE_FIX_OUTCOMES === 'true'}`,
    `env.FEATURE_ANALYZE_FROM_CAPTURE_is_true=${process.env.FEATURE_ANALYZE_FROM_CAPTURE === 'true'}`,
  ]
  return new NextResponse(lines.join('\n') + '\n', {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
}
