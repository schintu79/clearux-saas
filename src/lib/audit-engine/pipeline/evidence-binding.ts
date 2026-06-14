// ============================================================
// Fixpath Proprietary Pipeline — Evidence Binding (P1)
// ============================================================
//
// THE PROMISE THIS ENFORCES:
// /methodology tells customers that every AI-assessed finding is "grounded in
// quoted page evidence — it must cite what it saw." Today that's a prompt
// instruction, not a guarantee. Evidence binding makes it structural: an
// LLM-sourced finding that carries NO verbatim quote AND NO DOM selector is
// ungrounded — the model asserted into the void — so we demote it into the
// "Not enough evidence" tier rather than let it stand as a confident claim.
//
// HOW THE DEMOTION TAKES EFFECT:
// We don't clamp severity here. We lower the finding's confidence into the
// undetermined band; the severity≤evidence invariant (evidence-severity.ts,
// gate 4b) then caps it at LOW and keeps it off the score cap. One source of
// truth for the severity rule, no duplication. The finding stays VISIBLE
// (honesty valve) — flagged, never inflated, never deleted.
//
// Instrument findings (axe / responsive / parser) are grounded by measurement
// and are never touched here. This is the third P1 layer:
//   P0 structural-ownership (by domain) + DOM-verification (by evidence) +
//   evidence-binding (by grounding). See docs/LLM_NOISE_ELIMINATION_PLAN.md.
// ============================================================

import { isLlmSource } from './structural-ownership'

/** Confidence assigned to an ungrounded LLM finding — below the 0.3
 *  "undetermined" threshold mapEvidenceType uses, so it reads as
 *  "Not enough evidence" and gets severity-clamped to LOW downstream. */
export const UNGROUNDED_CONFIDENCE = 0.2

export interface FindingForBinding {
  id: string
  title: string
  description: string
  evidence?: string | null
  target_element?: string | null
  affected_selector?: string | null
  page_url?: string | null
  detection_source?: string | null
}

export interface EvidenceBindingResult {
  /** LLM findings lacking any grounding — demote to "Not enough evidence". */
  ungroundedIds: string[]
  reasons: Record<string, string>
}

// A verbatim quote: 8+ chars between matching straight or smart quotes.
const QUOTE_PATTERN =
  /[“”]([^“”]{8,})[“”]|[‘’]([^‘’]{8,})[‘’]|"([^"]{8,})"|'([^']{8,})'/

/** True if the text cites a verbatim quote (the model showing what it saw). */
export function hasVerbatimQuote(text: string): boolean {
  return QUOTE_PATTERN.test(text)
}

/** True if the finding points at a concrete DOM location. */
export function hasSelector(f: FindingForBinding): boolean {
  const sel = (f.target_element || f.affected_selector || '').trim()
  // A bare tag like "<input>" is not a real locator; require something more specific.
  return sel.length > 0 && !/^<\w+>$/.test(sel)
}

/** A finding is grounded if it quotes evidence OR names a DOM selector. */
export function isGrounded(f: FindingForBinding): boolean {
  if (hasSelector(f)) return true
  const text = `${f.title ?? ''} ${f.description ?? ''} ${f.evidence ?? ''}`
  return hasVerbatimQuote(text)
}

/**
 * Identify ungrounded LLM findings. Instrument-sourced findings are grounded by
 * measurement and skipped. Callers demote the returned ids (lower confidence to
 * UNGROUNDED_CONFIDENCE); the severity≤evidence invariant does the rest.
 */
export function identifyUngroundedFindings(
  findings: ReadonlyArray<FindingForBinding>,
): EvidenceBindingResult {
  const ungroundedIds: string[] = []
  const reasons: Record<string, string> = {}

  for (const f of findings) {
    if (!isLlmSource(f.detection_source)) continue
    if (isGrounded(f)) continue
    ungroundedIds.push(f.id)
    reasons[f.id] = 'No verbatim quote or DOM selector — demoted to "Not enough evidence"'
  }

  return { ungroundedIds, reasons }
}
