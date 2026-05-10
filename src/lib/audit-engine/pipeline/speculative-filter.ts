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
  /conduct\s+a\s+(?:css|accessibility|visual|manual)\s+audit/i,
  /(?:minor|low[\s-]severity)\s+(?:localization|internationalisation|internationalization)\s+(?:gap|issue)/i,
  /worth\s+noting\s+as\s+part\s+of/i,
  /not\s+fully\s+optimized?\s+for\s+international/i,
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
  /(?:css|typography)\s+audit/i,
  /(?:font[\s-]?size|line[\s-]?height|line[\s-]?length|text[\s-]?size)\s+(?:below|above|not|does\s+not)/i,
  /(?:body|base)\s+(?:text|font)\s+(?:size|readability)/i,

  // HTML attribute-dependent
  /missing\s+lang\s+attribute/i,
  /(?:html|root)\s+(?:element\s+)?lang/i,
  /(?:does\s+not|doesn.t)\s+declare\s+(?:its\s+)?language/i,
  /lang\s+attribute\s+(?:missing|absent|not\s+set|not\s+declared)/i,
  /(?:missing|no|absent|lacks?)\s+(?:html\s+)?lang(?:uage)?\s+(?:attribute|declaration|tag)/i,
  /(?:missing|lacks?)\s+(?:aria|autocomplete|htmlfor|for=)/i,
  /(?:missing|lacks?)\s+(?:form\s+)?(?:label|labeling|labelling)\s+(?:attribute|association)/i,
  /(?:missing|lacks?)\s+(?:input|form)\s+(?:attribute|type)/i,
  /(?:missing|lacks?)\s+hreflang/i,

  // Meta/head-dependent
  /missing\s+(?:og|open\s*graph|twitter\s*card|meta)\s+tags?/i,
  /missing\s+(?:json-?ld|schema\.?org|structured\s+data|breadcrumb\s*list\s*schema)/i,
  /missing\s+canonical\s+(?:url|tag)/i,
  /missing\s+(?:favicon|manifest)/i,

  // H1/heading — often JS-rendered and not captured by text extraction
  /(?:missing|lacks?|no|absent)\s+(?:h1|primary\s+heading|main\s+heading)\s+(?:tag|element|heading)/i,
  /(?:h1|primary\s+heading)\s+(?:tag\s+)?(?:is\s+)?(?:missing|absent|not\s+found|not\s+present)/i,
  /no\s+h1\s+(?:heading|tag|element)\s+(?:found|detected|present)/i,

  // Server-level files (cannot be verified from page text)
  /missing\s+(?:robots\.?txt|sitemap\.?xml)/i,
  /no\s+(?:robots\.?txt|sitemap\.?xml)\s+(?:found|detected|present|configured)/i,

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
