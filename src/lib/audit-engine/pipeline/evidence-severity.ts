// ============================================================
// Fixpath Proprietary Pipeline — Severity ≤ Evidence Invariant (P0)
// ============================================================
//
// THE BUG THIS CLOSES (2026-06-13):
// On the fixpath.ai audit, a finding was displayed as "Not enough evidence"
// and STILL shipped as a HIGH-severity issue that pulled the overall score
// cap down to 65. A finding cannot be both "we couldn't verify this" and
// "this is a serious confirmed problem." Severity must never exceed what the
// evidence supports.
//
// THE INVARIANT:
//   A finding's severity may never outrank its evidence tier.
//   In particular, an "undetermined" / "Not enough evidence" finding can
//   never be HIGH or CRITICAL, and therefore can never drive the score cap.
//   It stays visible (honesty valve) but at LOW severity — flagged, never
//   inflated. This matches the promise on /methodology.
//
// We derive the evidence tier from the SAME source of truth the UI uses
// (trust-summary.mapEvidenceType), so the clamp can never disagree with the
// label a user sees. See docs/LLM_NOISE_ELIMINATION_PLAN.md.
// ============================================================

import type { AuditFinding } from '@/types/database'
import { mapEvidenceType, type EvidenceType } from './trust-summary'

export type Severity = 'critical' | 'high' | 'medium' | 'low'

const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 }

/**
 * Maximum severity each evidence tier is allowed to carry.
 *  - verified / observed: grounded enough to be anything (no clamp).
 *  - heuristic: a guess with weak grounding — capped below CRITICAL.
 *  - undetermined ("Not enough evidence"): cannot exceed LOW, cannot cap the score.
 */
export const MAX_SEVERITY_BY_EVIDENCE: Record<EvidenceType, Severity> = {
  verified: 'critical',
  observed: 'critical',
  heuristic: 'high',
  undetermined: 'low',
}

/** Clamp a severity down to the ceiling its evidence tier allows. */
export function clampSeverityToEvidence(severity: Severity, evidence: EvidenceType): Severity {
  const ceiling = MAX_SEVERITY_BY_EVIDENCE[evidence]
  return SEVERITY_RANK[severity] > SEVERITY_RANK[ceiling] ? ceiling : severity
}

export interface SeverityClamp {
  id: string
  from: Severity
  to: Severity
  evidence: EvidenceType
}

/**
 * Find every finding whose severity outranks its evidence tier.
 * Returns the clamps to apply (caller updates in-memory + DB). Findings that
 * already respect the invariant are omitted.
 *
 * Accepts the finding fields mapEvidenceType needs; tolerant of partial rows.
 */
export function enforceSeverityEvidenceInvariant(
  findings: ReadonlyArray<Pick<AuditFinding, 'id' | 'severity' | 'confidence_level' | 'confidence_score' | 'detection_source' | 'viewport'> & Partial<AuditFinding>>,
): SeverityClamp[] {
  const clamps: SeverityClamp[] = []
  for (const f of findings) {
    const evidence = mapEvidenceType(f as AuditFinding)
    const from = f.severity as Severity
    const to = clampSeverityToEvidence(from, evidence)
    if (to !== from) clamps.push({ id: f.id, from, to, evidence })
  }
  return clamps
}
