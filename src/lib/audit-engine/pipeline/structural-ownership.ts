// ============================================================
// Fixpath Proprietary Pipeline — Structural Ownership Gate (P0)
// ============================================================
//
// THE PROBLEM THIS SOLVES (2026-06-13, Stefano — the accuracy moat):
// The LLM repeatedly asserts that STRUCTURAL elements are MISSING when
// they are present — "no <main>", "labels not connected", "footer has no
// Contact link". Hand-verified on fixpath.ai: 3 of 3 confirmed AI false
// positives were false claims of ABSENCE, every one in a domain a
// deterministic instrument (axe-core / WCAG checker / parser / responsive
// checker / crawler) already measures accurately. These false HIGHs were
// capping the score. See docs/DETECTION_SOURCE_ACCURACY.md.
//
// WHY THE OLD speculative-filter.ts COULDN'T FIX IT:
// That filter matches TEXT PATTERNS against ALL findings. So when a pattern
// for "form label" or "touch target" was added, it ALSO killed the
// legitimate axe/responsive findings on the same topic — which is exactly
// why those patterns carry "REMOVED (regression fix)" comments today. The
// filter could never tell the instrument's truth from the LLM's guess
// because it ignored WHO reported it.
//
// THE FIX — OWNERSHIP BY SOURCE, NOT BY WORDING:
// Deterministic checkers OWN structural truth. If a structural defect is
// real, the instrument catches it. An LLM-only structural claim is, by
// construction, either a duplicate of an instrument finding (already merged
// by dedup) or noise. So we drop structural claims that originate from an
// LLM source — and we NEVER touch findings from a deterministic source,
// so axe's real findings on the very same topics survive untouched.
//
// This is the engine half of "route landmark / label / link claims through
// deterministic detection, not the LLM." It is the immediate (P0) blocker;
// the durable layer (P1) verifies each surviving claim against the rendered
// DOM. See docs/LLM_NOISE_ELIMINATION_PLAN.md.
// ============================================================

// ── Source ownership ────────────────────────────────────────
// detection_source values that mean "an LLM concluded this" (interpretive).
// Mirrors trust-summary.ts mapVerificationMethod()'s llm bucket.
export const LLM_DETECTION_SOURCES: ReadonlySet<string> = new Set([
  'analyzer',
  'deep_analyzer',
  'brand_analyzer',
  'gap_fill',
])

/** A deterministic source owns structural truth — its findings are never gated here. */
export function isLlmSource(detectionSource: string | null | undefined): boolean {
  if (!detectionSource) return true // unattributed findings are treated as LLM (conservative)
  return LLM_DETECTION_SOURCES.has(detectionSource)
}

// ── Structural domains owned by deterministic instruments ───
// Each entry: the domain a real instrument authoritatively measures, plus a
// matcher tested against the finding's title + description. These run ONLY
// against LLM-sourced findings, so they can be as assertive as needed without
// endangering the instrument's own findings.
export interface StructuralDomain {
  domain: string
  owner: string // which deterministic check owns this truth
  pattern: RegExp
}

export const STRUCTURAL_OWNERSHIP: ReadonlyArray<StructuralDomain> = [
  // Landmarks: <main>, <nav>, header/footer regions, skip links — axe (region,
  // landmark-one-main, landmark-unique, bypass) + DOM parser own these.
  {
    domain: 'landmark',
    owner: 'axe',
    pattern: /<main>|<nav>|<header>|<footer>|main\s+(?:content\s+)?(?:area\s+)?(?:is\s+)?(?:not\s+)?(?:marked|wrapped)?\s*(?:with\s+)?(?:a\s+)?(?:proper\s+)?(?:html\s+|semantic\s+)?landmark|(?:semantic|html)\s+landmark|main\s+(?:landmark|element)|navigation\s+(?:menus?|elements?)\s+(?:are\s+)?not\s+labe|nav\s+elements?\b[\s\S]{0,60}aria-label|skip(?:\s|-)?(?:to(?:\s|-)?)?(?:main\s+)?content|skip\s+link/i,
  },
  // Form label association: <label for>, aria-labelledby — axe (label,
  // label-title-only, form-field-multiple-labels) owns this.
  {
    domain: 'form-label',
    owner: 'axe',
    pattern: /not\s+connected\s+to\s+(?:the\s+)?label|<label\s+for|aria-label(?:led)?by|connected\s+to\s+label\s+text|(?:form\s+)?(?:field|input)s?\b[\s\S]{0,60}\b(?:are\s+)?not\s+(?:connected|associated|labe)|(?:label|input)s?\s+(?:are\s+)?not\s+(?:connected|associated)\s+(?:to|with)/i,
  },
  // Colour contrast — axe (color-contrast) / WCAG 1.4.3 own this.
  {
    domain: 'contrast',
    owner: 'axe',
    pattern: /colou?r\s+contrast|contrast\s+ratio|(?:wcag\s*)?1\.4\.3/i,
  },
  // Touch / tap target size — responsive checker + axe (target-size) own this.
  {
    domain: 'target-size',
    owner: 'responsive_checker',
    pattern: /touch\s+target|tap\s+target|target\s+size|44\s*[x×]\s*44/i,
  },
  // Heading order / hierarchy — axe (heading-order, empty-heading) owns this.
  {
    domain: 'heading-order',
    owner: 'axe',
    pattern: /heading\s+(?:order|structure|hierarchy)|skips?\s+(?:heading\s+)?levels?|heading\s+levels?\s+(?:are\s+)?skipp|h[1-6]\s*(?:→|->|to)\s*h[1-6]/i,
  },
  // Image / SVG accessible name — axe (image-alt, svg-img-alt) owns this.
  {
    domain: 'alt-text',
    owner: 'axe',
    pattern: /\balt\s+(?:text|attribute)\b|images?\s+(?:are\s+)?(?:missing|without|lack(?:ing)?)\s+(?:an?\s+)?alt|svg\b[\s\S]{0,40}(?:has\s+no|missing|lacks?|without)\b[\s\S]{0,20}(?:title|accessible\s+name)|(?:no|missing)\s+accessible\s+name/i,
  },
  // Link presence (absence claims) — the crawler enumerates links
  // deterministically, so "there is no X link" is its truth, not the LLM's.
  {
    domain: 'link-presence',
    owner: 'crawler',
    pattern: /(?:footer|header|page|site|nav(?:igation)?)\b[\s\S]{0,40}(?:doesn'?t|does\s+not|do\s+not)\s+(?:include|have|contain|feature)\b[\s\S]{0,30}\blinks?\b|(?:no|missing|without)\s+(?:a\s+)?(?:direct\s+)?(?:contact|support|navigation|footer)\s+(?:or\s+\w+\s+)?links?\b|(?:footer|page)\b[\s\S]{0,30}(?:lacks?|missing)\b[\s\S]{0,30}\blinks?\b/i,
  },
  // Meta / head tags presence — head-tag parser owns this deterministically.
  {
    domain: 'meta-tags',
    owner: 'head_tag',
    pattern: /(?:missing|no|lacks?|absent)\s+(?:og|open\s*graph|twitter\s*card|canonical|meta|hreflang)\s+(?:tags?|url)|missing\s+(?:lang|language)\s+(?:attribute|declaration)/i,
  },
]

// ── Public API ───────────────────────────────────────────────

export interface FindingForOwnership {
  id: string
  title: string
  description: string
  detection_source?: string | null
}

export interface StructuralOwnershipResult {
  /** IDs to drop — LLM-sourced findings making a claim a deterministic instrument owns. */
  dropIds: string[]
  /** id → human-readable reason (which domain/owner), for audit logging. */
  reasons: Record<string, string>
}

/**
 * Identify LLM-sourced findings that trespass on a deterministic instrument's
 * domain. Deterministic-sourced findings are ALWAYS preserved — this gate only
 * ever removes interpretive (LLM) findings, so the instrument's own findings on
 * the same topic are never at risk.
 */
export function classifyStructuralOwnership(
  findings: ReadonlyArray<FindingForOwnership>,
): StructuralOwnershipResult {
  const dropIds: string[] = []
  const reasons: Record<string, string> = {}

  for (const f of findings) {
    // Deterministic source → it owns the truth, never gate it.
    if (!isLlmSource(f.detection_source)) continue

    const haystack = `${f.title ?? ''} ${f.description ?? ''}`
    for (const d of STRUCTURAL_OWNERSHIP) {
      if (d.pattern.test(haystack)) {
        dropIds.push(f.id)
        reasons[f.id] = `${d.domain} is owned by the ${d.owner} check — LLM structural claim dropped as noise`
        break
      }
    }
  }

  return { dropIds, reasons }
}
