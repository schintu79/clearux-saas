// ============================================================
// Fix History Gate — Pre-Surfacing Suppression
// ============================================================
//
// PURPOSE:
// Prevent previously-fixed findings from being resurfaced in new
// audits unless current evidence proves they have genuinely
// regressed. This is the critical missing link between:
//   - The audit generation layer (which produces findings from AI analysis)
//   - The fix/deploy layer (which remembers what was fixed)
//
// WITHOUT THIS GATE:
//   The audit says "open issue" while Fix/Deploy says "was fixed before"
//   → Trust-destroying inconsistency for the user
//
// WITH THIS GATE:
//   A finding that matches a previously-fixed issue family is
//   suppressed by default. Only if the finding has HIGH confidence
//   evidence of genuine regression does it pass through, marked
//   as 'reopened' rather than generic 'open'.
//
// HOW IT WORKS:
//   1. Load issue families with fix_status in [pending_verification,
//      validated_fixed, implemented] for this workspace
//   2. For each current finding, attempt to match against fixed families
//      using title fingerprint similarity + category alignment
//   3. Matching findings are SUPPRESSED (removed from surfaced set)
//   4. Exception: if finding has 'deterministic' confidence_level AND
//      fresh page evidence, it passes through as 'reopened'
//
// RULES:
//   - Default: suppress previously-fixed findings
//   - Exception: deterministic + fresh evidence → reopened
//   - Never suppress findings with 'deterministic' confidence from
//     automated checkers (WCAG, responsive, structured data)
//   - Log all suppression decisions for debug trace
//
// PROPRIETARY — do not distribute outside the Fixpath codebase.
// ============================================================

import { createTitleFingerprint } from './relevance-scorer'

/* ── Types ──────────────────────────────────────────────────── */

export interface FindingForHistoryGate {
  id: string
  title: string
  description: string
  severity: string
  page_url: string | null
  category_index: number | null
  confidence_level?: 'deterministic' | 'heuristic' | 'interpretive' | null
  detection_source?: string | null
}

export interface FixedIssueFamily {
  id: string
  issue_key: string
  title_canonical: string
  category_key: string
  fix_status: string
  fix_updated_at: string | null
  current_lifecycle_state: string
  scope_signature: string | null
}

export type FindingState = 'new' | 'still_present' | 'reopened' | null

export interface FixHistoryGateResult {
  /** IDs of findings suppressed (should be removed from surfaced set) */
  suppressedIds: string[]
  /** IDs of findings that passed as genuinely reopened */
  reopenedIds: string[]
  /** Map of finding ID → suppression reason */
  suppressionReasons: Record<string, string>
  /** Map of finding ID → matched issue family ID */
  matchedFamilies: Record<string, string>
}

/* ── Title matching ─────────────────────────────────────────── */

function normalizeForMatch(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleSimilarity(a: string, b: string): number {
  const aWords = new Set(normalizeForMatch(a).split(' ').filter(w => w.length >= 3))
  const bWords = new Set(normalizeForMatch(b).split(' ').filter(w => w.length >= 3))
  if (aWords.size === 0 && bWords.size === 0) return 1
  if (aWords.size === 0 || bWords.size === 0) return 0
  const intersection = [...aWords].filter(w => bWords.has(w)).length
  const union = new Set([...aWords, ...bWords]).size
  return union > 0 ? intersection / union : 0
}

/* ── Main gate logic ────────────────────────────────────────── */

/**
 * Check findings against fix history and suppress previously-fixed
 * findings that should not be resurfaced.
 *
 * @param findings - Current findings to check
 * @param fixedFamilies - Issue families with fix_status indicating prior fix
 * @returns Gate result with suppressed/reopened IDs and reasons
 */
export function applyFixHistoryGate(
  findings: FindingForHistoryGate[],
  fixedFamilies: FixedIssueFamily[],
): FixHistoryGateResult {
  const suppressedIds: string[] = []
  const reopenedIds: string[] = []
  const suppressionReasons: Record<string, string> = {}
  const matchedFamilies: Record<string, string> = {}

  if (fixedFamilies.length === 0) {
    return { suppressedIds, reopenedIds, suppressionReasons, matchedFamilies }
  }

  // Pre-compute fingerprints for fixed families
  const familyFingerprints = fixedFamilies.map(fam => ({
    family: fam,
    fingerprint: createTitleFingerprint(fam.title_canonical),
    normalized: normalizeForMatch(fam.title_canonical),
  }))

  for (const finding of findings) {
    const findingFingerprint = createTitleFingerprint(finding.title)
    const findingNormalized = normalizeForMatch(finding.title)

    // Try to match against fixed families
    let bestMatch: { family: FixedIssueFamily; confidence: number } | null = null

    for (const { family, fingerprint, normalized } of familyFingerprints) {
      let confidence = 0

      // Signal 1: Fingerprint exact match (strongest signal)
      if (findingFingerprint && fingerprint && findingFingerprint === fingerprint) {
        confidence = 0.95
      } else {
        // Signal 2: Title similarity (Jaccard)
        const titleSim = titleSimilarity(finding.title, family.title_canonical)
        if (titleSim >= 0.6) {
          confidence = 0.5 + titleSim * 0.4
        }
      }

      // Signal 3: Exact normalized match
      if (findingNormalized === normalized && findingNormalized.length > 10) {
        confidence = Math.max(confidence, 0.98)
      }

      if (confidence > 0.6 && (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = { family, confidence }
      }
    }

    if (!bestMatch) continue

    // We have a match against a previously-fixed family.
    matchedFamilies[finding.id] = bestMatch.family.id

    // Decision: suppress or allow as reopened?
    //
    // RULE: Suppress by default.
    // EXCEPTION: If finding has 'deterministic' confidence_level
    // (from automated checkers like WCAG, responsive, structured data)
    // AND the issue family was fixed more than 24h ago, allow as reopened.
    // This means the automated checker independently verified the issue
    // is genuinely present again.

    const isDeterministic = finding.confidence_level === 'deterministic'
    const isFromAutomatedChecker = finding.detection_source === 'wcag_checker' ||
      finding.detection_source === 'responsive_checker' ||
      finding.detection_source === 'structured_data_validator' ||
      finding.detection_source === 'head_tag_extraction'

    if (isDeterministic && isFromAutomatedChecker) {
      // Automated checker found real evidence — allow as reopened
      reopenedIds.push(finding.id)
    } else {
      // Default: suppress
      suppressedIds.push(finding.id)
      const familyFixStatus = bestMatch.family.fix_status
      const matchConf = Math.round(bestMatch.confidence * 100)
      suppressionReasons[finding.id] =
        `Suppressed: matches issue family "${bestMatch.family.title_canonical}" ` +
        `(fix_status: ${familyFixStatus}, match confidence: ${matchConf}%). ` +
        `Previously-fixed findings are not resurfaced unless deterministic ` +
        `evidence proves genuine regression.`
    }
  }

  return { suppressedIds, reopenedIds, suppressionReasons, matchedFamilies }
}
