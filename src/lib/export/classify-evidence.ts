/**
 * Evidence classifier for export findings.
 *
 * 2026-06-12 VOCABULARY UNIFICATION (Stefano's call): the product has ONE
 * two-tier evidence taxonomy everywhere — trust strip, finding badges,
 * and exports:
 *  - 'verified':    an instrument measured it — deterministic detection
 *                   (confidence_level 'deterministic': WCAG checker,
 *                   schema validator, responsive browser test, PageSpeed,
 *                   head-tag parser).
 *  - 'ai_assessed': the LLM concluded it (interpretive/heuristic review).
 *  - 'unverified':  the finding essentially says "we couldn't test this" —
 *                   labeled "Not enough evidence", never dressed up.
 *
 * The previous classifier REGEX-GUESSED strength from finding text while
 * the DB already carried confidence_level/detection_source — so the trust
 * strip said '76% verified' while the export labeled the same deterministic
 * findings 'Observed'. Two taxonomies for one dataset. Classification now
 * starts from the pipeline's own metadata; text patterns only catch the
 * honest-absence tier.
 *
 * React-free, reusable across all export renderers.
 */

import type { ExportFinding } from './findings-formatter';

/* ── Types ─────────────────────────────────────────────── */

export type EvidenceStrength = 'verified' | 'ai_assessed' | 'unverified';

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

/** Detection sources produced by instruments, not the LLM. */
const DETERMINISTIC_SOURCES = [
  'wcag_checker',
  'structured_data',
  'head_tag',
  'crawler',
  'responsive_checker',
  'performance_checker',
  'pagespeed_api',
];

/* ── Classifier ────────────────────────────────────────── */

function classifyEvidence(f: ExportFinding): EvidenceStrength {
  // 1. The pipeline's own metadata wins — deterministic detection is
  //    'verified' regardless of how the prose reads.
  if (
    f.confidenceLevel === 'deterministic' ||
    (f.detectionSource && DETERMINISTIC_SOURCES.includes(f.detectionSource))
  ) {
    return 'verified';
  }

  // 2. Honest-absence tier: the finding admits we couldn't test this.
  //    Substantive evidence text vetoes the demotion.
  const text = [f.description, f.evidence || '', f.whyItMatters || ''].join(' ');
  const hasSubstantiveEvidence =
    f.evidence !== null &&
    f.evidence !== undefined &&
    f.evidence.trim().length > 20;
  if (UNVERIFIED_PATTERNS.some((p) => p.test(text)) && !hasSubstantiveEvidence) {
    return 'unverified';
  }

  // 3. Everything else is the LLM's conclusion.
  return 'ai_assessed';
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
