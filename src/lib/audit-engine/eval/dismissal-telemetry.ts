// ============================================================
// Fixpath — Dismissal Telemetry (P3, field precision signal)
// ============================================================
//
// The P2 truth-set measures precision in the LAB (hand-labeled cases). This
// measures it in the FIELD: real users dismissing findings on sites we've never
// seen. Together they tell us where the audit is noisy — lab and wild.
//
// THE KEY REFINEMENT: not every dismissal is a precision problem. "This finding
// is wrong / not true" is noise (a false positive we should have caught). "Valid,
// but we won't fix it / not a priority" is NOT noise — the finding was correct,
// the user just deprioritized it. Counting all dismissals as precision-loss
// overcounts and would punish accurate-but-unwelcome findings. So we classify the
// dismissal reason and track the INACCURATE rate separately from the raw rate.
//
// Output is bucketed by detection_source and by evidence tier (Verified vs
// AI-assessed), mirroring docs/DETECTION_SOURCE_ACCURACY.md — so a rising
// AI-assessed inaccurate-dismissal rate is an early warning the model is drifting
// noisy in production, before it ever shows up in the lab set.
// ============================================================

/** Why a user dismissed a finding — coarse buckets derived from the reason text. */
export type DismissalBucket = 'inaccurate' | 'wont_fix' | 'not_relevant' | 'duplicate' | 'other'

const INACCURATE = [
  /\b(?:wrong|incorrect|inaccurate|false|not\s+true|isn'?t\s+true|mistaken|error|bug)\b/i,
  /\b(?:already|is)\s+(?:present|there|done|fixed|implemented|labeled|labelled)\b/i,
  /\b(?:does|do)\s+have\b/i,
  /\bnot\s+(?:missing|an?\s+issue|a\s+problem)\b/i,
  /\bfalse\s+positive\b/i,
]
const WONT_FIX = [/\bwon'?t\s+fix\b/i, /\bby\s+design\b/i, /\bintentional\b/i, /\bwo?nt\s+change\b/i, /\baccept(?:ed|able)?\s+risk\b/i, /\blater\b/i, /\bbacklog\b/i, /\bdefer/i]
const NOT_RELEVANT = [/\bnot\s+relevant\b/i, /\bdoesn'?t\s+apply\b/i, /\bnot\s+applicable\b/i, /\bn\/?a\b/i, /\bout\s+of\s+scope\b/i, /\bdon'?t\s+care\b/i]
const DUPLICATE = [/\bduplicate\b/i, /\bsame\s+as\b/i, /\balready\s+report/i]

/** Classify a free-text dismissal reason into a bucket. Default 'other'. */
export function classifyDismissalReason(reason: string | null | undefined): DismissalBucket {
  const r = (reason || '').trim()
  if (!r) return 'other'
  if (INACCURATE.some((p) => p.test(r))) return 'inaccurate'
  if (DUPLICATE.some((p) => p.test(r))) return 'duplicate'
  if (NOT_RELEVANT.some((p) => p.test(r))) return 'not_relevant'
  if (WONT_FIX.some((p) => p.test(r))) return 'wont_fix'
  return 'other'
}

// ── Evidence tier (mirrors trust-summary / structural-ownership) ──
const INSTRUMENT_SOURCES = new Set([
  'axe', 'responsive_checker', 'wcag_checker', 'head_tag', 'structured_data', 'pagespeed_api', 'performance_checker', 'crawler',
])
export function tierOf(source: string | null | undefined): 'verified' | 'ai_assessed' {
  return source && INSTRUMENT_SOURCES.has(source) ? 'verified' : 'ai_assessed'
}

// ── Aggregation ─────────────────────────────────────────────

export interface DismissalRow {
  detection_source?: string | null
  category_index?: number | null
  dismissed?: boolean | null
  dismissal_reason?: string | null
}

export interface GroupStat {
  key: string
  total: number
  dismissed: number
  /** dismissals classified as "inaccurate" — the precision-relevant signal. */
  inaccurate: number
  /** dismissed / total */
  dismissalRate: number
  /** inaccurate / total — the noise rate that should track toward zero. */
  inaccurateRate: number
}

export interface DismissalTelemetry {
  overall: GroupStat
  bySource: GroupStat[]
  byTier: GroupStat[]
  buckets: Record<DismissalBucket, number>
}

function stat(key: string, total: number, dismissed: number, inaccurate: number): GroupStat {
  return {
    key,
    total,
    dismissed,
    inaccurate,
    dismissalRate: total > 0 ? round(dismissed / total) : 0,
    inaccurateRate: total > 0 ? round(inaccurate / total) : 0,
  }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

/**
 * Aggregate finding rows into dismissal telemetry. Pure — pass it the rows.
 * `total` is all findings seen for a source; `dismissed`/`inaccurate` are the
 * subsets, so the rates are honest denominators (not dismissed-only).
 */
export function aggregateDismissals(rows: ReadonlyArray<DismissalRow>): DismissalTelemetry {
  const bySource = new Map<string, { total: number; dismissed: number; inaccurate: number }>()
  const byTier = new Map<string, { total: number; dismissed: number; inaccurate: number }>()
  const buckets: Record<DismissalBucket, number> = { inaccurate: 0, wont_fix: 0, not_relevant: 0, duplicate: 0, other: 0 }
  let total = 0
  let dismissed = 0
  let inaccurate = 0

  for (const r of rows) {
    const source = r.detection_source || 'unknown'
    const tier = tierOf(r.detection_source)
    const s = bySource.get(source) ?? { total: 0, dismissed: 0, inaccurate: 0 }
    const t = byTier.get(tier) ?? { total: 0, dismissed: 0, inaccurate: 0 }
    s.total++; t.total++; total++

    if (r.dismissed) {
      const bucket = classifyDismissalReason(r.dismissal_reason)
      buckets[bucket]++
      s.dismissed++; t.dismissed++; dismissed++
      if (bucket === 'inaccurate') { s.inaccurate++; t.inaccurate++; inaccurate++ }
    }
    bySource.set(source, s)
    byTier.set(tier, t)
  }

  return {
    overall: stat('overall', total, dismissed, inaccurate),
    bySource: [...bySource.entries()]
      .map(([k, v]) => stat(k, v.total, v.dismissed, v.inaccurate))
      .sort((a, b) => b.inaccurateRate - a.inaccurateRate),
    byTier: [...byTier.entries()].map(([k, v]) => stat(k, v.total, v.dismissed, v.inaccurate)),
    buckets,
  }
}

// ── DB wrapper ──────────────────────────────────────────────

/**
 * Fetch dismissal telemetry from audit_findings. Optionally scope to a
 * workspace. No new table/migration — detection_source, dismissed and
 * dismissal_reason already live on the finding row. NOTE: audit_findings has no
 * workspace_id column, so workspace scoping resolves audit ids via the audits
 * table first (filtering findings on a non-existent column would silently fail).
 */
export async function getDismissalTelemetry(
  db: { from: (t: string) => any },
  opts: { workspaceId?: string | null; limit?: number } = {},
): Promise<DismissalTelemetry> {
  let auditIds: string[] | null = null
  if (opts.workspaceId) {
    const { data: audits, error: aErr } = await db
      .from('audits')
      .select('id')
      .eq('workspace_id', opts.workspaceId)
      .is('deleted_at', null)
    if (aErr) {
      console.error('[dismissal-telemetry] audits query failed:', aErr.message)
      return aggregateDismissals([])
    }
    auditIds = ((audits || []) as Array<{ id: string }>).map((a) => a.id)
    if (auditIds.length === 0) return aggregateDismissals([])
  }

  let q = db
    .from('audit_findings')
    .select('detection_source, category_index, dismissed, dismissal_reason')
    .limit(opts.limit ?? 5000)
  if (auditIds) q = q.in('audit_id', auditIds)
  const { data, error } = await q
  if (error) {
    console.error('[dismissal-telemetry] query failed:', error.message)
    return aggregateDismissals([])
  }
  return aggregateDismissals((data || []) as DismissalRow[])
}
