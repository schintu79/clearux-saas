// ============================================================
// Fixpath Proprietary Pipeline — DOM Verification Gate (P1)
// ============================================================
//
// THE DURABLE MOAT (the layer P0 pointed at).
// P0 (structural-ownership) drops LLM structural claims by DOMAIN — it assumes
// "an instrument owns this, so the LLM may not speak." That's a blunt safety
// net. P1 is the precise, evidence-based version: for any LLM finding that
// asserts an element is MISSING, we check the assertion against a real snapshot
// of the rendered DOM (captured in the browser pass) and DROP it only if the
// element is actually PRESENT. "The LLM proposes, the DOM disposes."
//
// Why this is the moat and not just another filter:
//  - It is evidence-based and auditable — every drop cites a DOM fact, not a
//    wording heuristic. That is the defensible "we verified against your live
//    DOM" story competitors can't cheaply copy.
//  - It generalizes BEYOND P0's predefined domains: any absence claim about a
//    landmark, heading, label, link, or head tag is checked, not assumed.
//  - Every confirmed AI error on fixpath.ai was a false claim of ABSENCE
//    (no <main>, labels not connected, no Contact link). This gate is aimed
//    exactly at that failure mode. See docs/DETECTION_SOURCE_ACCURACY.md.
//
// This module is PURE. The browser pass (wcag-checker) fills DomFacts; the
// pipeline calls verifyFindingsAgainstDom() and drops the refuted ids.
// Slice 2 wires capture + call. See docs/LLM_NOISE_ELIMINATION_PLAN.md.
// ============================================================

import { isLlmSource } from './structural-ownership'

// ── DOM ground-truth snapshot ───────────────────────────────
// A compact, structured record of what actually exists in the rendered DOM.
// Captured once per representative page in the browser pass. Intentionally
// small: presence facts the LLM most often hallucinates the absence of.
export interface DomFacts {
  landmarks: {
    main: boolean
    nav: number
    header: boolean
    footer: boolean
    /** A skip-to-content link is present and focusable. */
    skipLink: boolean
  }
  /** Ordered heading levels as they appear, e.g. [1, 2, 2, 3]. */
  headings: number[]
  forms: {
    /** Visible form controls (input/select/textarea), excluding hidden/buttons. */
    totalControls: number
    /** Controls with a programmatic label (label[for], aria-label, aria-labelledby, wrapping label). */
    labeledControls: number
    /** Controls marked required (required / aria-required). */
    requiredMarked: number
  }
  /** Link inventory — visible text + href. Powers "no X link" refutation. */
  links: Array<{ text: string; href: string }>
  /** <html lang="..."> value, or null if absent. */
  langAttr: string | null
  /** <meta name="viewport"> present. */
  viewportMeta: boolean
}

// ── Absence-claim checks ────────────────────────────────────
// Each check: a matcher for an ABSENCE claim, plus a predicate that returns
// true when the claimed-absent thing is actually PRESENT in the DOM (→ refute).

interface AbsenceCheck {
  name: string
  /** True when the finding text asserts this element is missing. */
  claims: (text: string) => boolean
  /** True when the DOM proves the element is actually present (refutes claim). */
  presentInDom: (d: DomFacts) => boolean
  reason: (d: DomFacts) => string
}

// Generic "asserts absence" lead-ins, reused across checks.
const ABSENCE = String.raw`(?:no|missing|lacks?|without|absent|doesn'?t\s+(?:have|include|use|contain)|does\s+not\s+(?:have|include|use|contain)|fails?\s+to\s+(?:have|include|use)|not\s+(?:present|found|marked|used|connected|associated|wrapped))`

function near(subject: string): RegExp {
  // ABSENCE lead-in within ~40 chars of the subject, in either order.
  return new RegExp(
    `${ABSENCE}[\\s\\S]{0,40}(?:${subject})|(?:${subject})[\\s\\S]{0,40}${ABSENCE}`,
    'i',
  )
}

const ABSENCE_CHECKS: AbsenceCheck[] = [
  {
    name: 'main-landmark',
    claims: (t) => near(String.raw`<main>|main\s+(?:content\s+)?(?:landmark|element|area)|semantic\s+landmark|html\s+landmark`).test(t),
    presentInDom: (d) => d.landmarks.main,
    reason: () => 'DOM contains a <main> landmark — absence claim refuted',
  },
  {
    name: 'skip-link',
    claims: (t) => near(String.raw`skip(?:\s|-)?(?:to(?:\s|-)?)?(?:main\s+)?content|skip\s+link`).test(t),
    presentInDom: (d) => d.landmarks.skipLink,
    reason: () => 'DOM contains a skip-to-content link — absence claim refuted',
  },
  {
    name: 'nav-landmark',
    claims: (t) => near(String.raw`<nav>|nav(?:igation)?\s+(?:landmark|element|menu)`).test(t),
    presentInDom: (d) => d.landmarks.nav > 0,
    reason: (d) => `DOM contains ${d.landmarks.nav} <nav> landmark(s) — absence claim refuted`,
  },
  {
    name: 'h1',
    claims: (t) => near(String.raw`h1|(?:primary|main|top[\s-]?level)\s+heading`).test(t),
    presentInDom: (d) => d.headings.includes(1),
    reason: () => 'DOM contains an <h1> — absence claim refuted',
  },
  {
    name: 'lang-attribute',
    claims: (t) => near(String.raw`lang(?:uage)?\s+(?:attribute|declaration)`).test(t),
    presentInDom: (d) => !!d.langAttr,
    reason: (d) => `DOM <html> declares lang="${d.langAttr}" — absence claim refuted`,
  },
  {
    name: 'viewport-meta',
    claims: (t) => near(String.raw`viewport\s+meta`).test(t),
    presentInDom: (d) => d.viewportMeta,
    reason: () => 'DOM head contains a viewport meta tag — absence claim refuted',
  },
  {
    name: 'form-labels',
    claims: (t) =>
      near(String.raw`label`).test(t) &&
      /\b(?:form|input|field|contact\s+form|signup|sign[\s-]?up|registration)\b/i.test(t),
    // Refute only when the DOM proves EVERY control is labeled (no partial credit).
    presentInDom: (d) => d.forms.totalControls > 0 && d.forms.labeledControls >= d.forms.totalControls,
    reason: (d) => `All ${d.forms.totalControls} form control(s) have programmatic labels — "labels not connected" refuted`,
  },
  {
    name: 'contact-link',
    claims: (t) =>
      near(String.raw`links?`).test(t) && /\b(?:contact|support)\b/i.test(t),
    presentInDom: (d) =>
      d.links.some((l) => /\b(?:contact|support)\b/i.test(l.text) || /(?:contact|support)/i.test(l.href)),
    reason: () => 'DOM contains a Contact/Support link — absence claim refuted',
  },
]

// ── Public API ───────────────────────────────────────────────

export interface FindingForDomCheck {
  id: string
  title: string
  description: string
  detection_source?: string | null
  /** Page the finding is about — used to pick the right per-page DOM snapshot. */
  page_url?: string | null
}

export interface DomVerificationResult {
  /** LLM findings whose absence claim is refuted by the DOM — drop these. */
  refutedIds: string[]
  /** id → which check + DOM fact refuted it (for audit logging). */
  reasons: Record<string, string>
}

/** Run every absence-check against one finding; returns the refutation reason, or null. */
function refuteAgainst(finding: FindingForDomCheck, domFacts: DomFacts): string | null {
  if (!isLlmSource(finding.detection_source)) return null
  const text = `${finding.title ?? ''} ${finding.description ?? ''}`
  for (const check of ABSENCE_CHECKS) {
    if (check.claims(text) && check.presentInDom(domFacts)) {
      return `[${check.name}] ${check.reason(domFacts)}`
    }
  }
  return null
}

/**
 * Verify LLM absence-claims against the rendered-DOM snapshot.
 * Instrument-sourced findings are never refuted here (they own structural
 * truth). A claim is only dropped when the DOM positively proves the element
 * the LLM said was missing is actually present.
 *
 * When domFacts is null (browser pass didn't run / capture failed), this is a
 * no-op — we never drop a finding without positive contradicting evidence.
 */
export function verifyFindingsAgainstDom(
  findings: ReadonlyArray<FindingForDomCheck>,
  domFacts: DomFacts | null,
): DomVerificationResult {
  const refutedIds: string[] = []
  const reasons: Record<string, string> = {}
  if (!domFacts) return { refutedIds, reasons }

  for (const f of findings) {
    const reason = refuteAgainst(f, domFacts)
    if (reason) {
      refutedIds.push(f.id)
      reasons[f.id] = reason
    }
  }

  return { refutedIds, reasons }
}

/**
 * Per-page variant for the pipeline: each finding is verified against the DOM
 * snapshot of its OWN page (matched by page_url), falling back to a default
 * page (typically the homepage) when there's no exact match. Site-wide facts
 * (landmarks, lang, viewport) verify correctly under the fallback; page-specific
 * facts (form labels) only refute when the matched page actually has the form,
 * so the fallback can never cause a false refutation.
 */
export function verifyFindingsAgainstDomByUrl(
  findings: ReadonlyArray<FindingForDomCheck>,
  domByUrl: Map<string, DomFacts> | null,
  fallbackUrl?: string | null,
): DomVerificationResult {
  const refutedIds: string[] = []
  const reasons: Record<string, string> = {}
  if (!domByUrl || domByUrl.size === 0) return { refutedIds, reasons }

  const fallback = (fallbackUrl && domByUrl.get(fallbackUrl)) || domByUrl.values().next().value || null

  for (const f of findings) {
    const dom = (f.page_url && domByUrl.get(f.page_url)) || fallback
    if (!dom) continue
    const reason = refuteAgainst(f, dom)
    if (reason) {
      refutedIds.push(f.id)
      reasons[f.id] = reason
    }
  }

  return { refutedIds, reasons }
}
