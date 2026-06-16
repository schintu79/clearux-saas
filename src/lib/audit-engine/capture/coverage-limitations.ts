// ============================================================
// Coverage limitations — derived from the capture, decided by the user
// ============================================================
// "No empty 'limited' labels." Every coverage gap (a page we couldn't fully
// see) is surfaced WITH its evidence so the user can inspect, re-check, and
// decide: dismiss it (transient/irrelevant) or promote it to a tracked finding.
// Their decision is remembered per WORKSPACE so the same limitation doesn't
// nag again on a deeper/future audit.
//
// Limitations are DERIVED from page_captures (Stage 1 evidence); the decision
// is a Compose-stage action. General + site-agnostic — every limitation kind,
// not just error bodies.
//
// Pure functions only — fully unit-tested.
// ============================================================

import { isUpstreamErrorBody } from '@/lib/audit-engine/error-body'

export type LimitationReason =
  | 'upstream_error'   // proxy/gateway error body returned instead of the page
  | 'unreachable'      // fetch failed entirely (no content)
  | 'partial_capture'  // captured, but incomplete evidence
  | 'thin_content'     // loaded, but almost no content (likely JS-gated / empty)

export type LimitationDecision = 'dismissed' | 'promoted'

/** A capture row, as limitation classification reads it. */
export interface CaptureForLimitation {
  page_url: string
  page_status?: string | null
  http_status?: number | null
  fetch_strategy?: string | null
  extracted_text?: string | null
  captured_at?: string | null
}

/** A persisted user decision (the workspace memory). */
export interface LimitationDecisionRecord {
  page_url: string
  reason: LimitationReason
  decision: LimitationDecision
  finding_id?: string | null
}

export interface Limitation {
  page_url: string
  reason: LimitationReason
  label: string
  detail: string
  evidence: {
    http_status: number | null
    fetch_strategy: string | null
    captured_at: string | null
    text_length: number
    text_excerpt: string
  }
  /** open until the user decides; then dismissed/promoted (from workspace memory). */
  status: 'open' | LimitationDecision
  finding_id: string | null
}

const THIN_CONTENT_MAX = 200

/** Classify a single capture into a limitation reason, or null if the page is fine. */
export function classifyLimitation(c: CaptureForLimitation): LimitationReason | null {
  if (!c || !c.page_url) return null
  const text = c.extracted_text || ''
  if (isUpstreamErrorBody(text)) return 'upstream_error'
  if (c.page_status === 'failed') return text.trim().length === 0 ? 'unreachable' : 'upstream_error'
  if (c.page_status === 'partial') return 'partial_capture'
  // Loaded "complete" but almost no content — likely JS-gated or an empty shell.
  if ((c.page_status == null || c.page_status === 'complete') && text.trim().length > 0 && text.trim().length < THIN_CONTENT_MAX) {
    return 'thin_content'
  }
  return null
}

const REASON_LABEL: Record<LimitationReason, string> = {
  upstream_error: 'Page returned a server/proxy error',
  unreachable: 'Page returned no content at all',
  partial_capture: 'Page captured only partially',
  thin_content: 'Only the page title loaded — its main content did not',
}

function reasonDetail(reason: LimitationReason, c: CaptureForLimitation): string {
  switch (reason) {
    case 'upstream_error':
      return `Why: instead of the page, the server returned a proxy/gateway error (e.g. "upstream connect error"), so there was nothing to analyze. This is the WHOLE page failing, not a section. If it is genuinely down this is an infrastructure issue to investigate — and on an important page (pricing, signup, a product page) that is severe. Re-check to confirm whether it is still failing or was transient.`
    case 'unreachable':
      return `Why: no content came back for this page at all — it likely failed to load, timed out, was blocked, or is rendered entirely by JavaScript the crawler could not execute. This is the WHOLE page, not a section. On an important page this is severe — verify it loads for real visitors. Re-check to see if it is reachable now.`
    case 'partial_capture':
      return `Why: only part of this page's content was captured, so analysis of it is incomplete. The visible parts may be fine; the missing section was not read.`
    case 'thin_content':
      return `Why: we captured this page's title but almost none of its body (${(c.extracted_text || '').trim().length} chars). This is most likely a SPECIFIC SECTION — the main content — that did not render (commonly JavaScript-gated), NOT the whole page. The page may look fine to visitors; we simply could not read its body, so any analysis of this page's content is unreliable. Re-check, or treat it as a rendering issue on that section.`
  }
}

function decisionKey(pageUrl: string, reason: LimitationReason): string {
  return `${pageUrl.replace(/\/+$/, '')}::${reason}`
}

/**
 * Derive coverage limitations from captures, applying the workspace decision
 * memory. By default dismissed limitations are EXCLUDED (so they don't nag on a
 * deeper audit); pass includeDecided to surface them too (e.g. an "X dismissed"
 * section).
 */
export function buildLimitations(
  captures: CaptureForLimitation[],
  decisions: LimitationDecisionRecord[] = [],
  opts: { includeDecided?: boolean } = {},
): Limitation[] {
  const decisionByKey = new Map<string, LimitationDecisionRecord>()
  for (const d of decisions) decisionByKey.set(decisionKey(d.page_url, d.reason), d)

  const out: Limitation[] = []
  for (const c of captures || []) {
    const reason = classifyLimitation(c)
    if (!reason) continue
    const decided = decisionByKey.get(decisionKey(c.page_url, reason))
    const status: Limitation['status'] = decided ? decided.decision : 'open'
    if (status === 'dismissed' && !opts.includeDecided) continue // memory: don't nag
    const text = (c.extracted_text || '').trim()
    out.push({
      page_url: c.page_url,
      reason,
      label: REASON_LABEL[reason],
      detail: reasonDetail(reason, c),
      evidence: {
        http_status: c.http_status ?? null,
        fetch_strategy: c.fetch_strategy ?? null,
        captured_at: c.captured_at ?? null,
        text_length: text.length,
        text_excerpt: text.slice(0, 300),
      },
      status,
      finding_id: decided?.finding_id ?? null,
    })
  }
  return out
}
