// ============================================================
// Fixpath Proprietary Pipeline — Input-Relevance Gate
// ============================================================
//
// THE PROBLEM (2026-06-15, Stefano):
// axe / wcag_checker fire "WCAG 3.3.2: Labels or Instructions" (and similar
// form-label findings) on ANY <input> that lacks a programmatic label —
// including decorative search boxes, newsletter capture, and autofilled fields
// on content pages (home, pricing, blog). On raseedinvest.com a label finding
// landed on the /en HOMEPAGE, where there is no genuine user-entry form. A
// "missing label" complaint only makes sense where the user must actually type
// real data: signup, login, contact, checkout, etc.
//
// THE FIX — RELEVANCE BY PAGE PURPOSE:
// This gate is the mirror image of structural-ownership.ts. That gate trusts the
// instrument and drops LLM noise. This gate trusts the instrument's DETECTION
// but recognises that a label/instruction defect is only RELEVANT on a real
// input page. So a label/instruction finding on a non-input page (homepage or
// ordinary content page) is flagged as off-relevance.
//
// Conservative by design: only label/instruction-class findings are considered,
// and only when the page is NOT a plausible input page. Everything else is
// untouched. The page-purpose test (isLikelyInputPage) is intentionally broad
// (signup/login/contact/checkout/quote/apply/demo/…) to avoid suppressing a
// genuine form.
// ============================================================

import { isLikelyInputPage } from '@/lib/audit-engine/page-relevance'
import { isLlmSource } from '@/lib/audit-engine/pipeline/structural-ownership'

/**
 * Matches label / instruction / form-field findings — the class that is only
 * meaningful on a genuine input page. Tested against title + description.
 */
const LABEL_INSTRUCTION_PATTERN =
  /labels?\s+or\s+instructions?|wcag\s*3\.3\.2|(?:form\s+)?(?:input|field)s?\b[\s\S]{0,40}\blabel|label\b[\s\S]{0,40}\b(?:input|field|form)|programmatic\s+label|associated?\s+<?label|placeholder\s+(?:text\s+)?(?:as|instead\s+of)\s+(?:a\s+)?label|required\s+(?:form\s+)?fields?\s+(?:are\s+)?not\s+(?:indicated|marked)/i

export interface FindingForRelevance {
  id: string
  title: string
  description: string
  page_url?: string | null
  detection_source?: string | null
}

export interface InputRelevanceResult {
  /** IDs of label/instruction findings that landed on a non-input page. */
  offRelevanceIds: string[]
  /** id → human-readable reason, for audit logging. */
  reasons: Record<string, string>
}

/** True when a finding is in the label/instruction class this gate governs. */
export function isLabelInstructionFinding(f: { title?: string | null; description?: string | null }): boolean {
  const haystack = `${f.title ?? ''} ${f.description ?? ''}`
  return LABEL_INSTRUCTION_PATTERN.test(haystack)
}

/**
 * Flag LLM-sourced label/instruction findings that sit on a page that is not a
 * plausible user-entry page.
 *
 * TRANSVERSALITY (2026-06-15, Stefano): this gate must NOT assume a site's
 * structure. A deterministic instrument (axe / wcag_checker) only flags a label
 * issue on an ACTIONABLE control (see isNonActionableControl) — that is real,
 * evidence-bearing page context, so we NEVER drop it by URL. The URL is only a
 * weak prior, fit to suppress the LLM's *guesses* (which have no DOM evidence)
 * when they land off a plausible input page. The instrument owns the truth; the
 * LLM does not.
 *
 * A finding is flagged only when ALL hold:
 *   - it is LLM-sourced (interpretive, no instrument evidence), and
 *   - it is a label/instruction-class finding, and
 *   - its page_url is present AND not a plausible input page.
 */
export function classifyInputRelevance(
  findings: ReadonlyArray<FindingForRelevance>,
): InputRelevanceResult {
  const offRelevanceIds: string[] = []
  const reasons: Record<string, string> = {}

  for (const f of findings) {
    // Trust instruments. Only relevance-filter interpretive (LLM) findings —
    // never a deterministic instrument finding, regardless of page.
    if (!isLlmSource(f.detection_source)) continue
    if (!f.page_url) continue // unknown page — don't judge relevance
    if (!isLabelInstructionFinding(f)) continue
    if (isLikelyInputPage(f.page_url)) continue // plausible input page — keep

    offRelevanceIds.push(f.id)
    reasons[f.id] =
      `LLM label/instruction guess on a non-input page (${f.page_url}) — no instrument evidence and no plausible user-entry form; off-relevance`
  }

  return { offRelevanceIds, reasons }
}
