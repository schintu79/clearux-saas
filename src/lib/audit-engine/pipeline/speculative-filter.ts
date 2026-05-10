// ============================================================
// ClearUX Proprietary Pipeline — Speculative Finding Filter
// ============================================================
//
// PURPOSE:
// Despite detailed prompt instructions, AI models sometimes produce
// findings about things they cannot verify from extracted text content
// (CSS styles, HTML attributes, meta tags, JavaScript behavior).
// This module catches and removes those findings programmatically
// as a hard safety net — the last line of defense.
//
// HOW IT WORKS:
// Two detection strategies run in parallel:
//
// 1. SPECULATIVE LANGUAGE — scans title + description for phrases
//    that reveal the AI is guessing ("cannot verify", "not visible
//    in provided content", "without live testing"). These phrases
//    mean the AI has no evidence.
//
// 2. UNVERIFIABLE TOPICS — scans the title for subjects that are
//    structurally impossible to assess from text extraction:
//    focus indicators, lang attributes, OG tags, structured data,
//    form labels, touch targets, responsive design.
//
// WHEN TO IMPROVE THIS FILE:
// - If a speculative finding slips through → add the phrase pattern
// - If a valid finding gets filtered → check if the pattern is too broad
// - If a new unverifiable category appears → add a title pattern
// ============================================================

export interface FindingForFilter {
  id: string
  title: string
  description: string
}

// ── Speculative language patterns ────────────────────────────
// These phrases in title + description indicate the AI is admitting
// it has no evidence. Any finding containing these should be removed.

export const SPECULATIVE_LANGUAGE: RegExp[] = [
  /cannot\s+(be\s+)?verif/i,
  /could\s+not\s+(be\s+)?verif/i,
  /not\s+visible\s+in\s+(the\s+)?provided/i,
  /cannot\s+confirm/i,
  /not\s+(?:shown|included|visible)\s+in\s+(?:the\s+)?(?:provided|available|crawled)/i,
  /without\s+(?:live|interactive|visual)\s+testing/i,
  /cannot\s+(?:be\s+)?(?:tested|assessed|evaluated)\s+from/i,
  /unverified\s+without/i,
  /full\s+(?:wcag|accessibility)\s+audit\s+cannot/i,
  /no\s+(?:css|html|javascript|meta)\s+(?:data|content|code|source)\s+(?:visible|available|provided)/i,
  /(?:not|cannot)\s+(?:be\s+)?(?:determined|confirmed|assessed)\s+from\s+(?:text|crawled|extracted)/i,
  /(?:may|might)\s+(?:not\s+)?(?:have|be|include)/i,
  /potentially\s+(?:missing|lacking|absent)/i,
  /appears?\s+to\s+(?:lack|be\s+missing|not\s+have)/i,
]

// ── Unverifiable topic patterns ──────────────────────────────
// These topics in the TITLE indicate the finding is about something
// that cannot be assessed from text content alone (requires CSS,
// HTML source, JS runtime, or visual rendering).

export const UNVERIFIABLE_TOPICS: RegExp[] = [
  // CSS-dependent
  /missing\s+(?:focus|:focus)\s+(?:indicator|state|style|ring)/i,
  /(?:focus|keyboard)\s+(?:indicator|navigation|state).*(?:missing|absent|lack)/i,
  /touch\s+target\s+size/i,
  /color\s+contrast\s+(?:ratio|issue|fail)/i,
  /(?:font|text)\s+size\s+(?:too\s+)?(?:small|large)/i,
  /responsive\s+design.*(?:unverified|cannot|missing)/i,
  /(?:line[\s-]?height|letter[\s-]?spacing)\s+(?:issue|missing|incorrect)/i,

  // HTML attribute-dependent
  /missing\s+lang\s+attribute/i,
  /(?:html|root)\s+(?:element\s+)?lang/i,
  /(?:missing|lacks?)\s+(?:aria|autocomplete|htmlfor|for=)/i,
  /(?:missing|lacks?)\s+(?:form\s+)?(?:label|labeling|labelling)\s+(?:attribute|association)/i,
  /(?:missing|lacks?)\s+(?:input|form)\s+(?:attribute|type)/i,

  // Meta/head-dependent
  /missing\s+(?:og|open\s*graph|twitter\s*card|meta)\s+tags?/i,
  /missing\s+(?:json-?ld|schema\.?org|structured\s+data|breadcrumb\s*list\s*schema)/i,
  /missing\s+canonical\s+(?:url|tag)/i,
  /missing\s+(?:favicon|manifest)/i,

  // JavaScript-dependent
  /(?:missing|lacks?|no)\s+(?:form\s+)?(?:validation|error\s+(?:message|handling|feedback))/i,
  /(?:missing|lacks?|no)\s+(?:success|confirmation)\s+(?:state|message|feedback)/i,
  /(?:missing|lacks?|no)\s+(?:loading|spinner|skeleton)\s+(?:state|indicator)/i,
]

// ── Public API ───────────────────────────────────────────────

/**
 * Identify findings that are speculative or about unverifiable topics.
 * Returns the IDs of findings that should be removed.
 */
export function identifySpeculativeFindings(findings: FindingForFilter[]): string[] {
  const speculativeIds: string[] = []

  for (const finding of findings) {
    const combined = `${finding.title} ${finding.description}`

    const hasSpeculativeLanguage = SPECULATIVE_LANGUAGE.some((p) => p.test(combined))
    const hasUnverifiableTopic = UNVERIFIABLE_TOPICS.some((p) => p.test(finding.title))

    if (hasSpeculativeLanguage || hasUnverifiableTopic) {
      speculativeIds.push(finding.id)
    }
  }

  return speculativeIds
}
