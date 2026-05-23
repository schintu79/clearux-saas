// ============================================================
// ClearUX Proprietary Pipeline — Confidence Rules
// ============================================================
//
// PURPOSE:
// Post-processing rules that enforce language and logic consistency
// based on the evidence contract (confidence_level, detection_source).
//
// THREE RESPONSIBILITIES:
//
// 1. LANGUAGE SOFTENER — Prevent interpretive findings from using
//    deterministic language ("is missing", "fails to", "does not").
//    Interpretive findings should sound like recommendations, not
//    verified failures.
//
// 2. STALE-RESULT CHECK — Detect findings carried forward from
//    previous audits (detection_source = 'gap_fill') that reference
//    page content no longer present in the latest crawl.
//
// 3. CONFIDENCE WEIGHT — Provide a numeric weight per confidence
//    level that downstream consumers (relevance scorer, UI) can
//    use to prioritize deterministic findings.
//
// WHEN TO IMPROVE THIS FILE:
// - If interpretive findings still sound too assertive → add patterns
// - If valid gap_fill findings are being flagged stale → refine checks
// - If confidence weights need rebalancing → adjust CONFIDENCE_WEIGHT
// ============================================================

// ── Types ───────────────────────────────────────────────────

export interface FindingForConfidenceCheck {
  id: string
  title: string
  description: string
  recommendation: string
  confidence_level: 'deterministic' | 'heuristic' | 'interpretive'
  detection_source: string
  page_url: string | null
}

export interface LanguageFix {
  id: string
  field: 'title' | 'description' | 'recommendation'
  original: string
  fixed: string
}

export interface StaleResult {
  id: string
  reason: string
}

// ── Confidence weights ──────────────────────────────────────
// Used by relevance scorer and UI to prioritize findings.
// Higher = more trustworthy.

export const CONFIDENCE_WEIGHT: Record<string, number> = {
  deterministic: 1.0,
  heuristic: 0.75,
  interpretive: 0.5,
}

// ── Language softener ───────────────────────────────────────
// Deterministic language that should be softened in interpretive
// findings. Each entry maps an assertive phrase to a hedged version.

const ASSERTIVE_TO_HEDGED: [RegExp, string][] = [
  // "is missing X" → "may benefit from X"
  [/\bis\s+missing\b/gi, 'may benefit from'],
  // "fails to X" → "could improve by X-ing"
  [/\bfails\s+to\b/gi, 'could improve by'],
  // "does not have" → "does not appear to have"
  [/\bdoes\s+not\s+have\b/gi, 'does not appear to have'],
  // "does not include" → "does not appear to include"
  [/\bdoes\s+not\s+include\b/gi, 'does not appear to include'],
  // "lacks" → "may lack"
  [/\blacks\b/gi, 'may lack'],
  // "no X found" → "X was not detected" (less absolute)
  [/\bno\s+(\w+)\s+found\b/gi, '$1 was not detected'],
  // "is broken" → "may not function as expected"
  [/\bis\s+broken\b/gi, 'may not function as expected'],
  // "is incorrect" → "may not be optimal"
  [/\bis\s+incorrect\b/gi, 'may not be optimal'],
  // "must be" → "should ideally be"
  [/\bmust\s+be\b/gi, 'should ideally be'],
  // "needs to be" → "would benefit from being"
  [/\bneeds\s+to\s+be\b/gi, 'would benefit from being'],
]

/**
 * Soften assertive language in interpretive findings.
 * Only modifies findings with confidence_level = 'interpretive'.
 * Returns a list of changes to apply (caller updates the DB).
 */
export function softenInterpretiveLanguage(
  findings: FindingForConfidenceCheck[],
): LanguageFix[] {
  const fixes: LanguageFix[] = []

  for (const finding of findings) {
    if (finding.confidence_level !== 'interpretive') continue

    for (const field of ['title', 'description', 'recommendation'] as const) {
      const original = finding[field]
      if (!original) continue

      let fixed = original
      for (const [pattern, replacement] of ASSERTIVE_TO_HEDGED) {
        fixed = fixed.replace(pattern, replacement)
      }

      if (fixed !== original) {
        fixes.push({ id: finding.id, field, original, fixed })
      }
    }
  }

  return fixes
}

// ── Stale-result check ──────────────────────────────────────
// Gap-fill findings are carried forward from previous audits.
// If the page content has changed significantly, these findings
// may no longer apply.

/**
 * Check gap-fill findings against current crawl content.
 * Returns IDs of findings that reference content no longer present.
 *
 * @param findings - Findings to check (only gap_fill are evaluated)
 * @param currentContent - The full crawled page content from the current audit
 * @param pageContents - Map of page_url → page content (for multi-page audits)
 */
export function identifyStaleFindings(
  findings: FindingForConfidenceCheck[],
  currentContent: string,
  pageContents?: Map<string, string>,
): StaleResult[] {
  const stale: StaleResult[] = []

  for (const finding of findings) {
    // Only check gap_fill findings — others are fresh from the current audit
    if (finding.detection_source !== 'gap_fill') continue

    // Extract quoted evidence from description (text between "..." or '...')
    const quotedEvidence = extractQuotedText(finding.description)
    if (quotedEvidence.length === 0) continue

    // Determine which content to check against
    let relevantContent = currentContent
    if (finding.page_url && pageContents?.has(finding.page_url)) {
      relevantContent = pageContents.get(finding.page_url)!
    }

    const contentLower = relevantContent.toLowerCase()

    // Check if any quoted evidence still exists in the current content
    const allStale = quotedEvidence.every(
      quote => !contentLower.includes(quote.toLowerCase())
    )

    if (allStale) {
      stale.push({
        id: finding.id,
        reason: `Finding references content no longer found in the latest crawl: "${quotedEvidence[0].substring(0, 60)}..."`,
      })
    }
  }

  return stale
}

/**
 * Extract quoted text snippets from a description.
 * Looks for text between double or single quotes that is at least 8 chars.
 */
function extractQuotedText(text: string): string[] {
  const quotes: string[] = []
  // Match "..." and '...' with at least 8 chars inside
  const pattern = /[""]([^""]{8,})[""]|['']([^'']{8,})['']|"([^"]{8,})"|'([^']{8,})'/g
  let match
  while ((match = pattern.exec(text)) !== null) {
    const content = match[1] || match[2] || match[3] || match[4]
    if (content) quotes.push(content.trim())
  }
  return quotes
}
