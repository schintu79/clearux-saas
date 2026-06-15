// ============================================================
// Fixpath Proprietary Pipeline — Speculative-UX Noise Gate
// ============================================================
//
// THE PROBLEM (2026-06-15, Stefano):
// The LLM invents "user confusion" findings about standard, self-evident UI
// with zero evidence of real ambiguity — e.g. "Homepage has two confusing CTAs
// with unclear purpose" about clearly-labelled distinct buttons ("Start Trading"
// vs "Explore Markets"). A call-to-action's job is to prompt action, not to
// pre-narrate what happens on click. Speculating that users "won't know which is
// primary" or "what happens when they click" is presumption, not observation.
//
// SCOPE & SAFETY (transversal — not tuned to any site):
//   - Only LLM-sourced findings are considered (no instrument emits this class).
//   - Only the speculative-clarity phrasing is matched: a CTA/button/link framed
//     as unclear in PURPOSE / DESTINATION / which-is-primary / what-happens.
//   - A GENUINE ambiguity finding survives: if the finding cites concrete
//     evidence of real conflict (identical/duplicate labels, a label that
//     misleads about its destination, same text on competing buttons), it is
//     KEPT. We drop the speculation, not the evidenced critique.
// ============================================================

import { isLlmSource } from '@/lib/audit-engine/pipeline/structural-ownership'

/** The speculative "this CTA is unclear / ambiguous in purpose or destination" class. */
const CTA_CLARITY_SPECULATION =
  /(call[\s-]?to[\s-]?action|\bctas?\b|button|link)[\s\S]{0,80}\b(unclear|ambiguous|confusing|not\s+clear|don'?t\s+know|won'?t\s+know|uncertain)\b[\s\S]{0,80}\b(purpose|what\s+(?:happens|each\s+does|it\s+does|will\s+happen)|where\s+(?:each|it|they)\s+(?:leads?|links?|go(?:es)?|directs?|takes?)|which\s+(?:is|one\s+is)\b[\s\S]{0,20}\bprimary|next\s+step|destination|leads?\s+where)/i

/** Same class, phrased the other way round ("unclear … which CTA …"). */
const CTA_CLARITY_SPECULATION_ALT =
  /\b(unclear|ambiguous|confusing|not\s+clear)\b[\s\S]{0,60}\b(call[\s-]?to[\s-]?action|\bctas?\b|button|primary\s+action)\b/i

/**
 * Concrete evidence of GENUINE CTA ambiguity — if present, the finding is a real
 * critique and is KEPT (we only drop unevidenced speculation). Intentionally
 * narrow: duplicate/identical labels, mismatched destination, competing same text.
 */
const GENUINE_AMBIGUITY_EVIDENCE =
  /\b(identical|duplicate|same)\b[\s\S]{0,40}\b(label|text|wording|copy)\b|both\s+(?:buttons?|ctas?|links?)\s+(?:are\s+)?labell?ed\s+(?:the\s+same|identically|"[^"]+"\s+and\s+"\1")|label\s+(?:does\s+not|doesn'?t)\s+match[\s\S]{0,30}\b(destination|where|target)|misleading\s+(?:label|link|button)\s+text/i

export interface FindingForSpeculation {
  id: string
  title: string
  description: string
  detection_source?: string | null
}

export interface SpeculativeUxResult {
  dropIds: string[]
  reasons: Record<string, string>
}

/** True when the finding is speculative CTA-clarity noise (matches the class, no genuine-ambiguity evidence). */
export function isSpeculativeCtaClarity(f: { title?: string | null; description?: string | null }): boolean {
  const haystack = `${f.title ?? ''} ${f.description ?? ''}`
  const matchesClass = CTA_CLARITY_SPECULATION.test(haystack) || CTA_CLARITY_SPECULATION_ALT.test(haystack)
  if (!matchesClass) return false
  if (GENUINE_AMBIGUITY_EVIDENCE.test(haystack)) return false // real evidenced ambiguity — keep
  return true
}

/**
 * Drop LLM-sourced speculative CTA-clarity findings. Never touches deterministic
 * findings, and keeps any CTA finding that cites concrete evidence of genuine
 * ambiguity.
 */
export function classifySpeculativeUx(
  findings: ReadonlyArray<FindingForSpeculation>,
): SpeculativeUxResult {
  const dropIds: string[] = []
  const reasons: Record<string, string> = {}

  for (const f of findings) {
    if (!isLlmSource(f.detection_source)) continue // only the LLM speculates this
    if (!isSpeculativeCtaClarity(f)) continue
    dropIds.push(f.id)
    reasons[f.id] =
      `speculative CTA-clarity finding (unclear purpose/destination of a self-evident control, no evidence of genuine ambiguity) — a CTA prompts action, it need not pre-explain its destination`
  }

  return { dropIds, reasons }
}
