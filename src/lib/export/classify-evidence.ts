/**
 * Evidence classifier for export findings.
 *
 * Tags each finding with an evidence strength level:
 *  - 'verified':   Cites specific evidence (URLs, elements, code, data)
 *  - 'observed':   Describes a real issue but without hard evidence
 *  - 'unverified': Essentially says "we didn't test this" or "no evidence found"
 *
 * This classification helps the export renderer surface verified findings
 * prominently and flag unverified ones transparently, so the recipient
 * knows exactly which items are confirmed problems vs. audit gaps.
 *
 * React-free, reusable across all export renderers.
 */

import type { ExportFinding } from './findings-formatter';

/* ── Types ─────────────────────────────────────────────── */

export type EvidenceStrength = 'verified' | 'observed' | 'unverified';

export interface ClassifiedFinding extends ExportFinding {
  evidenceStrength: EvidenceStrength;
}

/* ── Detection patterns ────────────────────────────────── */

/**
 * Patterns that indicate the finding did NOT actually find a problem,
 * but rather notes the absence of testing or evidence.
 */
const UNVERIFIED_PATTERNS = [
  /no\s+(evidence|verification|validation)\s+(of|that|was)/i,
  /not\s+(verified|validated|tested|checked|confirmed)/i,
  /no\s+color\s+contrast\s+(testing|validation|audit|check)/i,
  /no\s+verification\s+of\s+(alt\s+text|keyboard|focus)/i,
  /were\s+not\s+tested/i,
  /lacks?\s+(evidence|verification|testing|validation)/i,
  /absence\s+of\s+(customer|user)?\s*(testimonial|case\s+stud|review|proof)/i,
  /not\s+been\s+(audit|test|verif|check|confirm)/i,
  /could\s+not\s+(verify|confirm|validate|test)/i,
  /unable\s+to\s+(verify|confirm|validate|test)/i,
  /insufficient\s+consideration/i,
  /audit\s+(found|identified)\s+no\s+(evidence|verification)/i,
  /the\s+audit\s+indicates?\s+.*\s+not\s+.*\s+(highlight|discoverabil|verif)/i,
];

/**
 * Patterns that indicate the finding cites specific, verifiable evidence.
 */
const VERIFIED_PATTERNS = [
  /canonical\s*(tag|url)?\s*(set|point|show|reveal|configured|misconfigured)\s+to\s+['"]?https?:\/\//i,
  /og:(title|description|image)\s*[=:]\s*['"]?/i,
  /shows?\s+['"].*?['"]/i,        // quotes specific text found on page
  /\bfor\s+example,?\s+the\s+/i,   // "for example, the pricing page..."
  /\bthe\s+(site\s+map|sitemap|crawl|scan|response)\s+(reveals?|shows?|contains?)/i,
  /\b\d+\s+(pages?|urls?)\s+(have|share|use|show|display)/i,  // "14 pages have..."
  /https?:\/\/[^\s]+\s+(shows?|has|have|displays?|returns?|contains?)/i,
  /\bJSON-LD\s+(block|data|markup)\s+(is|was|lacks?|missing)/i,
  /\blocated\s+(at|on|in)\s+/i,
  /\bfound\s+(on|in|at)\s+(page|url|line|element)/i,
  /\btest\s+results?\s+show/i,
  /\bscreenshot|element\s+inspector|devtools/i,
  /\bresponse\s+(code|header|status)\s+\d/i,
];

/* ── Classifier ────────────────────────────────────────── */

function classifyEvidence(f: ExportFinding): EvidenceStrength {
  const text = [
    f.description,
    f.evidence || '',
    f.whyItMatters || '',
  ].join(' ');

  // Check for unverified first — these override everything
  const hasUnverifiedSignal = UNVERIFIED_PATTERNS.some((p) => p.test(text));

  // Check for verified signals
  const hasVerifiedSignal = VERIFIED_PATTERNS.some((p) => p.test(text));

  // If the finding has explicit evidence field with substance, it's verified
  const hasSubstantiveEvidence =
    f.evidence !== null &&
    f.evidence !== undefined &&
    f.evidence.trim().length > 20;

  if (hasUnverifiedSignal && !hasVerifiedSignal && !hasSubstantiveEvidence) {
    return 'unverified';
  }

  if (hasVerifiedSignal || hasSubstantiveEvidence) {
    return 'verified';
  }

  return 'observed';
}

/* ── Public API ─────────────────────────────────────────── */

/**
 * Classify each finding's evidence strength.
 * Returns a new array — does not mutate the input.
 */
export function classifyFindingEvidence(
  findings: ExportFinding[],
): ClassifiedFinding[] {
  return findings.map((f) => ({
    ...f,
    evidenceStrength: classifyEvidence(f),
  }));
}
