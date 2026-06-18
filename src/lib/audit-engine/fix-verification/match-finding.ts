// ============================================================
// Phase 3 — Fix verification: the pure matching core
// ============================================================
// Given the ORIGINAL deterministic finding and the findings a re-run of the
// same instrument produced on the same page, decide the outcome:
//   • verified_fixed — we can reliably identify the defect AND no fresh finding
//                      matches it → it's gone.
//   • not_fixed      — a fresh finding positively matches it → still present.
//   • inconclusive   — the instrument didn't run, or we can't reliably identify
//                      the original defect. We never guess: inconclusive is left
//                      as the user set it and reconciled on the next re-audit.
//
// Doctrine: a FALSE "verified_fixed" is the worst error (we'd claim a fix that
// didn't happen). So we only claim fixed on a reliable identity + a clean
// re-check, only reopen on a positive re-match, and otherwise stay inconclusive.
//
// Pure + dependency-free → fully unit-testable. The IO layer maps each
// instrument's raw output into MatchKey[] and calls classifyFixOutcome.
// ============================================================

export type FixOutcome = 'verified_fixed' | 'not_fixed' | 'inconclusive'

/** A normalized identity for a defect, comparable across original vs re-check. */
export interface MatchKey {
  /** detection_source: axe | wcag_checker | responsive_checker | pagespeed_api | structured_data */
  source: string
  /** Rule identity: WCAG criterion ("1.4.3"), axe rule id, schema type, check id. */
  key: string | null
  /** CSS/element selector, when the source carries one (axe/wcag). */
  selector: string | null
  /** Performance metric (lcp/cls/inp/ttfb/tbt) or diagnostic id, for pagespeed. */
  metric: string | null
}

/** Parse a WCAG criterion like "1.4.3" out of a finding title "[WCAG 1.4.3] …". */
export function parseWcagCriterion(title: string | null | undefined): string | null {
  if (!title) return null
  const m = title.match(/\bWCAG\s+(\d+\.\d+\.\d+)/i)
  return m ? m[1] : null
}

/** Parse a schema.org type ("Organization", "LocalBusiness") from a structured-data title. */
export function parseSchemaType(title: string | null | undefined): string | null {
  if (!title) return null
  const m = title.match(/\b(Organization|LocalBusiness|Product|Article|BreadcrumbList|FAQPage|Review|Recipe|Event|Person|WebSite)\b/)
  return m ? m[1] : null
}

/** Normalize a selector for tolerant comparison (whitespace, case). */
export function normalizeSelector(s: string | null | undefined): string {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Normalize a title for identity comparison (pagespeed diagnostics have stable
 *  titles, so the title is a precise per-diagnostic key — more precise than the
 *  shared CWV metric, which several diagnostics map to). */
export function normalizeTitle(s: string | null | undefined): string {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Two selectors "overlap" if equal or one contains the other (e.g. a re-check
 *  reports a broader/narrower path to the same element). */
export function selectorsOverlap(a: string | null, b: string | null): boolean {
  const na = normalizeSelector(a)
  const nb = normalizeSelector(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

/** Does a fresh re-check finding identify the SAME defect as the original? */
export function matchKeys(original: MatchKey, fresh: MatchKey): boolean {
  if (original.source !== fresh.source) return false
  const aId = original.key || original.metric
  const bId = fresh.key || fresh.metric
  if (!aId || !bId || aId !== bId) return false
  // Same rule identity. If BOTH carry a selector, require selector overlap so a
  // different element failing the same rule isn't mistaken for "still present".
  if (original.selector && fresh.selector) return selectorsOverlap(original.selector, fresh.selector)
  return true
}

/** Whether we can reliably identify the original defect at all. Without an id we
 *  cannot prove it gone (→ never "fixed") nor positively re-detect it (→ never
 *  "not_fixed"): the honest outcome is inconclusive. */
export function hasReliableIdentity(original: MatchKey): boolean {
  return !!(original.key || original.metric)
}

/** The tri-state decision. `instrumentRan` is false when the re-check errored or
 *  timed out (the page couldn't be measured) → inconclusive. */
export function classifyFixOutcome(
  original: MatchKey,
  fresh: ReadonlyArray<MatchKey>,
  opts: { instrumentRan: boolean },
): FixOutcome {
  if (!opts.instrumentRan) return 'inconclusive'
  if (!hasReliableIdentity(original)) return 'inconclusive'
  return fresh.some((f) => matchKeys(original, f)) ? 'not_fixed' : 'verified_fixed'
}

/** Build the MatchKey for the ORIGINAL finding from its stored row fields. */
export function originalMatchKey(finding: {
  detection_source?: string | null
  title?: string | null
  target_element?: string | null
  performance_metric_type?: string | null
}): MatchKey {
  const source = finding.detection_source || ''
  const selector = finding.target_element || null
  switch (source) {
    case 'axe':
    case 'wcag_checker':
      return { source, key: parseWcagCriterion(finding.title), selector, metric: null }
    case 'pagespeed_api':
      // Title is the precise per-diagnostic identity (stable strings); metric is
      // kept for context but several diagnostics share one metric.
      return { source, key: normalizeTitle(finding.title), selector: null, metric: finding.performance_metric_type || null }
    case 'structured_data':
      return { source, key: parseSchemaType(finding.title), selector: null, metric: null }
    default:
      // responsive_checker and anything else: no reliable key today → inconclusive.
      return { source, key: null, selector, metric: null }
  }
}

/* ── Outcome row assembly ─────────────────────────────────── */

export interface FixOutcomeRow {
  finding_id: string
  audit_id: string | null
  workspace_id: string | null
  user_id: string | null
  issue_family_id: string | null
  page_url: string
  detection_source: string | null
  outcome: FixOutcome
  severity_before: string | null
  evidence_before: string | null
  evidence_after: string | null
  marked_fixed_at: string | null
  verified_at: string
  time_to_fix_seconds: number | null
  recheck_method: string
  recheck_meta: Record<string, unknown> | null
}

export interface BuildOutcomeInput {
  finding: {
    id: string
    audit_id?: string | null
    page_url?: string | null
    detection_source?: string | null
    severity?: string | null
    evidence?: string | null
    issue_family_id?: string | null
    created_at?: string | null
  }
  workspaceId: string | null
  userId: string | null
  outcome: FixOutcome
  evidenceAfter: string | null
  markedFixedAt: string | null
  verifiedAt: string
  recheckMeta?: Record<string, unknown> | null
  /** How the outcome was reached. 'single_page_instrument' = on-demand re-check
   *  after a manual mark-fixed; 'reaudit_diff' = detected by a full re-audit no
   *  longer finding the issue. Defaults to single_page_instrument. */
  recheckMethod?: string
}

/** Pure assembly of a fix_outcomes row. time_to_fix is detection→verification,
 *  recorded only when we actually concluded (not inconclusive). */
export function buildFixOutcomeRow(input: BuildOutcomeInput): FixOutcomeRow {
  const { finding } = input
  let timeToFix: number | null = null
  if (input.outcome !== 'inconclusive' && finding.created_at) {
    const t0 = Date.parse(finding.created_at)
    const t1 = Date.parse(input.verifiedAt)
    if (Number.isFinite(t0) && Number.isFinite(t1) && t1 >= t0) {
      timeToFix = Math.floor((t1 - t0) / 1000)
    }
  }
  return {
    finding_id: finding.id,
    audit_id: finding.audit_id ?? null,
    workspace_id: input.workspaceId,
    user_id: input.userId,
    issue_family_id: finding.issue_family_id ?? null,
    page_url: finding.page_url || '',
    detection_source: finding.detection_source ?? null,
    outcome: input.outcome,
    severity_before: finding.severity ?? null,
    evidence_before: finding.evidence ?? null,
    evidence_after: input.evidenceAfter,
    marked_fixed_at: input.markedFixedAt,
    verified_at: input.verifiedAt,
    time_to_fix_seconds: timeToFix,
    recheck_method: input.recheckMethod ?? 'single_page_instrument',
    recheck_meta: input.recheckMeta ?? null,
  }
}
