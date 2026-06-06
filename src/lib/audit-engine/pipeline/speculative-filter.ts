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
  /** Page URL the finding refers to — used to check if head tags are available */
  pageUrl?: string | null
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
  // REMOVED (regression fix): These patterns were far too broad and killed legitimate findings:
  // - "may/might have/be/include" matches virtually any hedged professional language
  // - "potentially missing" matches valid observations about absent features
  // - "appears to lack" matches valid evidence-based assessments
  // Only catch genuinely speculative AI admissions, not professional uncertainty language.
  /conduct\s+a\s+(?:css|accessibility|visual|manual)\s+audit/i,
  /(?:minor|low[\s-]severity)\s+(?:localization|internationalisation|internationalization)\s+(?:gap|issue)/i,
  /worth\s+noting\s+as\s+part\s+of/i,
  /not\s+fully\s+optimized?\s+for\s+international/i,
  // Auth-page false positives — findings about login/dashboard pages being broken
  /login\s+(?:page|screen|form)\s+(?:is\s+)?(?:shown|displayed|rendered)\s+instead/i,
  /(?:dashboard|app|admin)\s+(?:page\s+)?(?:shows?|displays?|renders?)\s+(?:a\s+)?login/i,
  /(?:requires?|needs?)\s+(?:authentication|login|sign[\s-]?in)\s+(?:to\s+)?(?:access|view)/i,
  /(?:redirects?|forwards?)\s+to\s+(?:a\s+)?(?:login|sign[\s-]?in|auth)/i,
  // REMOVED (regression fix): These hedging patterns removed findings that were honestly
  // stating their confidence level. Legitimate findings CAN acknowledge limits while still
  // being evidence-based. Only catch patterns where the AI literally has NO evidence.
  // Kept: the genuinely speculative admissions above (lines 43-54).
  // Removed: "unclear whether", "would need further analysis", "could be investigated",
  //          "based on limited content" — all of which match valid professional analysis.
]

// ── Unverifiable topic patterns ──────────────────────────────
// These topics in the TITLE indicate the finding is about something
// that cannot be assessed from text content alone (requires CSS,
// HTML source, JS runtime, or visual rendering).

export const UNVERIFIABLE_TOPICS: RegExp[] = [
  // CSS-dependent
  /missing\s+(?:focus|:focus)\s+(?:indicator|state|style|ring)/i,
  /(?:focus|keyboard)\s+(?:indicator|navigation|state).*(?:missing|absent|lack)/i,
  // REMOVED: touch target size IS a valid Inclusive Design concern (modules 8-11)
  // /touch\s+target\s+size/i,
  /color\s+contrast\s+(?:ratio|issue|fail)/i,
  /(?:font|text)\s+size\s+(?:too\s+)?(?:small|large)/i,
  // REMOVED: responsive design IS a valid Future Readiness concern (modules 12-15)
  // /responsive\s+design.*(?:unverified|cannot|missing)/i,
  /(?:line[\s-]?height|letter[\s-]?spacing)\s+(?:issue|missing|incorrect)/i,
  /(?:css|typography)\s+audit/i,
  /(?:font[\s-]?size|line[\s-]?height|line[\s-]?length|text[\s-]?size)\s+(?:below|above|not|does\s+not)/i,
  /(?:body|base)\s+(?:text|font)\s+(?:size|readability)/i,

  // HTML attribute-dependent (missing OR wrong lang — both unverifiable from text)
  /missing\s+lang\s+attribute/i,
  /(?:html|root)\s+(?:element\s+)?lang/i,
  /(?:does\s+not|doesn.t)\s+declare\s+(?:its\s+)?language/i,
  /lang\s+attribute\s+(?:missing|absent|not\s+set|not\s+declared)/i,
  /(?:missing|no|absent|lacks?)\s+(?:html\s+)?lang(?:uage)?\s+(?:attribute|declaration|tag)/i,
  /lang(?:uage)?\s+(?:attribute\s+)?(?:does\s+not|doesn.t|does\s*n.t)\s+match/i,
  /(?:incorrect|wrong|invalid|mismatched?)\s+(?:html\s+)?lang(?:uage)?\s+(?:attribute|value|tag|declaration)/i,
  /lang\s+(?:attribute\s+)?(?:should\s+be|set\s+to|is\s+not|mismatch)/i,
  /(?:html|page)\s+lang(?:uage)?\s+(?:is|set\s+to)\s+['"]?\w+['"]?\s+(?:but|instead\s+of|should)/i,
  /(?:missing|lacks?)\s+(?:aria|autocomplete|htmlfor|for=)/i,
  // REMOVED: form label/labeling IS a valid Inclusive Design concern (modules 8-11)
  // /(?:missing|lacks?)\s+(?:form\s+)?(?:label|labeling|labelling)\s+(?:attribute|association)/i,
  /(?:missing|lacks?)\s+(?:input|form)\s+(?:attribute|type)/i,
  /(?:missing|lacks?)\s+hreflang/i,

  // Meta/head-dependent
  /missing\s+(?:og|open\s*graph|twitter\s*card|meta)\s+tags?/i,
  // REMOVED: structured data/JSON-LD IS a valid SEO/Future Readiness concern (modules 12-15)
  // /missing\s+(?:json-?ld|schema\.?org|structured\s+data|breadcrumb\s*list\s*schema)/i,
  /missing\s+canonical\s+(?:url|tag)/i,
  /missing\s+(?:favicon|manifest)/i,

  // H1/heading — often JS-rendered and not captured by text extraction
  /(?:missing|lacks?|no|absent)\s+(?:h1|primary\s+heading|main\s+heading)\s+(?:tag|element|heading)/i,
  /(?:h1|primary\s+heading)\s+(?:tag\s+)?(?:is\s+)?(?:missing|absent|not\s+found|not\s+present)/i,
  /no\s+h1\s+(?:heading|tag|element)\s+(?:found|detected|present)/i,

  // Server-level files — REMOVED: crawler CAN verify robots.txt/sitemap.xml
  // via HTTP probing, so these are valid deterministic findings.
  // /missing\s+(?:robots\.?txt|sitemap\.?xml)/i,
  // /no\s+(?:robots\.?txt|sitemap\.?xml)\s+(?:found|detected|present|configured)/i,

  // JavaScript-dependent
  // REMOVED: form validation, success/confirmation, and loading states ARE valid findings
  // for Inclusive Design and Future Readiness modules (8-15)
  // /(?:missing|lacks?|no)\s+(?:form\s+)?(?:validation|error\s+(?:message|handling|feedback))/i,
  // /(?:missing|lacks?|no)\s+(?:success|confirmation)\s+(?:state|message|feedback)/i,
  // /(?:missing|lacks?|no)\s+(?:loading|spinner|skeleton)\s+(?:state|indicator)/i,

  // Auth-gated page false positives — login page misinterpreted as site content
  /(?:dashboard|admin|account|settings)\s+(?:page\s+)?(?:shows?|displays?|contains?)\s+(?:only\s+)?(?:a\s+)?(?:login|sign[\s-]?in)/i,
  /login\s+(?:page|form|screen)\s+(?:instead\s+of|rather\s+than|not)\s+(?:expected|actual)/i,

  // Extensionless URL 404 false positives — /path returns 404 but /path.html exists
  // This is normal static hosting behavior, not a real issue
  /(?:without|missing|no)\s+(?:\.html?\s+)?extension\s+(?:returns?|results?\s+in|gives?)\s+(?:a\s+)?404/i,
  /extensionless\s+(?:url|path|version)\s+(?:returns?|results?\s+in|gives?|is)\s+(?:a\s+)?(?:404|not\s+found)/i,
  /(?:url|path)\s+(?:without\s+)?(?:\.html?\s+)?(?:extension\s+)?(?:returns?|gives?)\s+(?:a\s+)?404.*(?:\.html?\s+(?:version|variant|page)\s+(?:exists?|works?|loads?))/i,
  /404\s+(?:error|not\s+found).*(?:while|but|whereas)\s+(?:the\s+)?(?:\.html?\s+)?(?:version|variant|page)\s+(?:exists?|works?|is\s+accessible)/i,
]

// ── Public API ───────────────────────────────────────────────

// Topics that become verifiable when head tag data is available in the page content.
// These are a subset of UNVERIFIABLE_TOPICS that get skipped when hasHeadTags is true.
const HEAD_TAG_VERIFIABLE: RegExp[] = [
  /missing\s+(?:og|open\s*graph|twitter\s*card|meta)\s+tags?/i,
  /missing\s+canonical\s+(?:url|tag)/i,
  /missing\s+lang\s+attribute/i,
  /(?:html|root)\s+(?:element\s+)?lang/i,
  /(?:does\s+not|doesn.t)\s+declare\s+(?:its\s+)?language/i,
  /lang\s+attribute\s+(?:missing|absent|not\s+set|not\s+declared)/i,
  /(?:missing|no|absent|lacks?)\s+(?:html\s+)?lang(?:uage)?\s+(?:attribute|declaration|tag)/i,
  /lang(?:uage)?\s+(?:attribute\s+)?(?:does\s+not|doesn.t|does\s*n.t)\s+match/i,
  /(?:incorrect|wrong|invalid|mismatched?)\s+(?:html\s+)?lang(?:uage)?\s+(?:attribute|value|tag|declaration)/i,
  /lang\s+(?:attribute\s+)?(?:should\s+be|set\s+to|is\s+not|mismatch)/i,
  /(?:html|page)\s+lang(?:uage)?\s+(?:is|set\s+to)\s+['"]?\w+['"]?\s+(?:but|instead\s+of|should)/i,
  /(?:missing|lacks?)\s+hreflang/i,
]

/**
 * Identify findings that are speculative or about unverifiable topics.
 * Returns the IDs of findings that should be removed.
 *
 * @param hasHeadTags - When true, head tag data was extracted from the page,
 *   so findings about OG tags, canonical URLs, lang attributes, etc. are now
 *   verifiable and should NOT be filtered.
 */
export function identifySpeculativeFindings(
  findings: FindingForFilter[],
  hasHeadTags: boolean = false,
): string[] {
  const speculativeIds: string[] = []

  for (const finding of findings) {
    const combined = `${finding.title} ${finding.description}`

    const hasSpeculativeLanguage = SPECULATIVE_LANGUAGE.some((p) => p.test(combined))

    // Check unverifiable topics, but skip head-tag-verifiable ones if head tags are available
    let hasUnverifiableTopic = false
    if (!hasHeadTags) {
      hasUnverifiableTopic = UNVERIFIABLE_TOPICS.some((p) => p.test(finding.title))
    } else {
      // Only check patterns that are NOT made verifiable by head tags
      hasUnverifiableTopic = UNVERIFIABLE_TOPICS.some((p) => {
        if (HEAD_TAG_VERIFIABLE.some((hv) => hv.source === p.source)) return false
        return p.test(finding.title)
      })
    }

    if (hasSpeculativeLanguage || hasUnverifiableTopic) {
      speculativeIds.push(finding.id)
    }
  }

  return speculativeIds
}
