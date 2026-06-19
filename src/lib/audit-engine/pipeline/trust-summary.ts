// ============================================================
// Fixpath Trust Summary Engine
// ============================================================
// Computes audit-level, category-level, and finding-level trust
// metadata for the Find & Fix trust layer.
//
// Maps existing pipeline evidence fields to the product-facing
// evidence taxonomy:
//   deterministic  → verified
//   interpretive   → observed
//   heuristic      → heuristic
//   (low confidence) → undetermined
//
// PROPRIETARY — do not distribute outside the Fixpath codebase.
// ============================================================

import type { AuditFinding, CrawlSummary } from '@/types/database'

/* ── Evidence Taxonomy ──────────────────────────────────────── */

/** Product-facing evidence type — the four trust levels */
export type EvidenceType = 'verified' | 'observed' | 'heuristic' | 'undetermined'

/** How the finding was detected — maps to system labels */
export type VerificationMethod = 'parser' | 'browser' | 'validator' | 'extractor' | 'llm' | 'hybrid'

/** Crawl coverage completeness */
export type CoverageLabel = 'full' | 'partial' | 'limited'

/** Confidence tier */
export type ConfidenceLabel = 'high' | 'medium' | 'low'

/* ── Trust Summary Types ────────────────────────────────────── */

/** Page-level trust summary — drives the AuditConfidenceStrip */
export interface AuditTrustSummary {
  /** Crawl coverage */
  crawl_coverage_label: CoverageLabel
  crawl_coverage_text: string
  /** Overall audit confidence */
  confidence_label: ConfidenceLabel
  confidence_text: string
  /** Evidence type breakdown percentages */
  verified_percent: number
  observed_percent: number
  heuristic_percent: number
  undetermined_percent: number
  /** 2026-06-12 unified display tier: observed + heuristic — everything
   *  the LLM concluded rather than an instrument measured. */
  ai_assessed_percent: number
  /** Which independent checks were run */
  checks_run: string[]
  /** Total findings used for computation */
  total_findings: number
}

/** Category-level trust metadata */
export interface CategoryTrustMeta {
  confidence_label: ConfidenceLabel
  coverage_label: CoverageLabel
}

/** Finding-level trust metadata for UI rendering */
export interface FindingTrustMeta {
  evidence_type: EvidenceType
  source_label: string | null
  affected_surfaces: ('desktop' | 'mobile')[] | null
  evidence_summary: string | null
  verification_method: VerificationMethod
  confidence_score: number
}

/* ── Mapping Functions ──────────────────────────────────────── */

/**
 * Map internal confidence_level to product-facing evidence type.
 * Low-confidence heuristic findings become 'undetermined'.
 */
export function mapEvidenceType(finding: AuditFinding): EvidenceType {
  const { confidence_level, confidence_score } = finding

  // Very low confidence → undetermined regardless of method
  if (confidence_score < 0.3) return 'undetermined'

  switch (confidence_level) {
    case 'deterministic':
      return 'verified'
    case 'interpretive':
      return 'observed'
    case 'heuristic':
      // High-confidence heuristic with strong deterministic source → observed
      if (confidence_score >= 0.7 && isDeterministicSource(finding.detection_source)) {
        return 'observed'
      }
      return 'heuristic'
    default:
      return 'heuristic'
  }
}

/**
 * User-facing evidence label (2026-06-12 unification — Stefano's call):
 * TWO tiers everywhere. 'Verified' = an instrument measured it
 * (deterministic detection). 'AI-assessed' = the LLM concluded it
 * (interpretive/heuristic). 'Not enough evidence' stays as the honesty
 * valve for very-low-confidence findings. The internal EvidenceType keeps
 * its four values because confidence math still distinguishes interpretive
 * from heuristic — but no user-facing surface may print 'Observed' or
 * 'Heuristic'. Export labels (findings-formatter EVIDENCE_LABELS) and the
 * strip/badges must agree with this function.
 */
export function evidenceDisplayLabel(type: EvidenceType): 'Measured' | 'AI-assessed' | 'Not enough evidence' {
  // 'Measured' (was 'Verified', 2026-06): an instrument measured this — it does
  // NOT claim the result is definitely a problem for every visitor. "Verified"
  // over-promised certainty (a hidden element can be measured and still not be a
  // real issue). "Measured" states the method honestly; the human decides.
  if (type === 'verified') return 'Measured'
  if (type === 'undetermined') return 'Not enough evidence'
  return 'AI-assessed'
}

/** Check if detection source is deterministic (parser/validator/checker) */
function isDeterministicSource(source: string | null): boolean {
  if (!source) return false
  return ['wcag_checker', 'axe', 'structured_data', 'head_tag', 'crawler', 'responsive_checker', 'performance_checker', 'pagespeed_api'].includes(source)
}

/**
 * Map detection_source to a user-facing source label.
 * Returns one of the approved source labels from the brief.
 */
export function mapSourceLabel(detectionSource: string | null): string {
  switch (detectionSource) {
    case 'crawler':
      return 'Crawl scan'
    case 'responsive_checker':
      return 'Browser test'
    case 'wcag_checker':
      return 'WCAG checker'
    case 'axe':
      return 'Accessibility scan (axe-core)'
    case 'structured_data':
      return 'Schema validator'
    case 'head_tag':
      return 'SEO parser'
    case 'performance_checker':
    case 'pagespeed_api':
      return 'SEO parser'
    case 'analyzer':
    case 'deep_analyzer':
    case 'brand_analyzer':
      return 'AI review'
    case 'gap_fill':
      return 'AI review'
    default:
      return 'AI review'
  }
}

/**
 * Map detection_source to verification method.
 */
export function mapVerificationMethod(detectionSource: string | null): VerificationMethod {
  switch (detectionSource) {
    case 'head_tag':
    case 'structured_data':
      return 'parser'
    case 'responsive_checker':
      return 'browser'
    case 'wcag_checker':
    case 'axe':
      return 'validator'
    case 'crawler':
    case 'performance_checker':
    case 'pagespeed_api':
      return 'extractor'
    case 'analyzer':
    case 'deep_analyzer':
    case 'brand_analyzer':
    case 'gap_fill':
      return 'llm'
    default:
      return 'llm'
  }
}

/**
 * Map finding viewport to affected surfaces array.
 */
export function mapAffectedSurfaces(viewport: string | null): ('desktop' | 'mobile')[] | null {
  if (!viewport) return null
  switch (viewport) {
    case 'mobile':
      return ['mobile']
    case 'desktop':
      return ['desktop']
    case 'tablet':
      return ['mobile'] // treat tablet as mobile for trust metadata
    case 'all':
    case 'cross-viewport':
      return ['desktop', 'mobile']
    case 'technical':
    case 'brand-dna':
      return null // not surface-specific
    default:
      return null
  }
}

/* ── Compute Trust Metadata ────────────────────────────────── */

/**
 * Compute finding-level trust metadata from existing AuditFinding fields.
 */
export function computeFindingTrust(finding: AuditFinding): FindingTrustMeta {
  const evidenceType = mapEvidenceType(finding)
  const sourceLabel = mapSourceLabel(finding.detection_source)
  const surfaces = mapAffectedSurfaces(finding.viewport)
  const method = mapVerificationMethod(finding.detection_source)

  // Build a short evidence summary
  let summary: string | null = null
  if (finding.evidence) {
    // Truncate to first sentence or 120 chars
    const firstSentence = finding.evidence.split(/[.!?]\s/)[0]
    summary = firstSentence.length > 120 ? firstSentence.slice(0, 117) + '...' : firstSentence
  }

  return {
    evidence_type: evidenceType,
    source_label: sourceLabel,
    affected_surfaces: surfaces,
    evidence_summary: summary,
    verification_method: method,
    confidence_score: finding.confidence_score ?? 0.5,
  }
}

/**
 * Compute crawl coverage label from CrawlSummary.
 */
export function computeCoverageLabel(crawl: CrawlSummary | null): { label: CoverageLabel; text: string } {
  if (!crawl) return { label: 'limited', text: 'No crawl data available' }

  const { urls_discovered, pages_analyzed } = crawl
  // 2026-06-12: pages_analyzed can legitimately exceed urls_discovered
  // (the canonical-misconfiguration guard crawls pages past the initial
  // discovery list) — the strip showed '25 of 20 key URLs'. The
  // denominator is whichever is larger; coverage cannot exceed 100%.
  const total = Math.max(urls_discovered || 1, pages_analyzed || 0, 1)

  // Coverage ratio
  const ratio = pages_analyzed / total

  if (ratio >= 0.7) {
    return {
      label: 'full',
      text: `${pages_analyzed} of ${total} key URLs audited`,
    }
  }

  if (ratio >= 0.3) {
    return {
      label: 'partial',
      text: `${pages_analyzed} of ${total} key URLs audited`,
    }
  }

  return {
    label: 'limited',
    text: `${pages_analyzed} of ${total} key URLs audited`,
  }
}

/**
 * Compute overall audit confidence from evidence type distribution
 * and crawl coverage.
 */
export function computeConfidenceLabel(
  verifiedPercent: number,
  observedPercent: number,
  coverageLabel: CoverageLabel,
): { label: ConfidenceLabel; text: string } {
  const strongEvidence = verifiedPercent + observedPercent

  // Limited coverage always caps at medium
  if (coverageLabel === 'limited') {
    return {
      label: 'low',
      text: 'Limited coverage with mostly AI-assessed evidence',
    }
  }

  if (strongEvidence >= 60 && coverageLabel === 'full') {
    return {
      label: 'high',
      text: 'Mostly instrument-verified evidence',
    }
  }

  if (strongEvidence >= 40) {
    return {
      label: 'medium',
      text: 'Mixed verified and AI-assessed evidence',
    }
  }

  return {
    label: 'low',
    text: 'Mostly AI-assessed evaluation',
  }
}

/**
 * Determine which independent checks were run during this audit.
 * Derives from detection_source values present on findings.
 */
export function computeChecksRun(findings: AuditFinding[], executedChecks?: string[] | null): string[] {
  // 2026-06-12: deriving 'checks run' ONLY from surviving findings
  // under-reports — a check that ran clean, or whose findings were
  // deduplicated away, vanished from the strip ('Checks run: WCAG' on an
  // audit where responsive + PageSpeed also ran). When the pipeline
  // provides execution metadata (crawl_summary.checks_executed), it wins;
  // findings-derived detection remains the fallback for old audits.
  if (executedChecks && executedChecks.length > 0) return executedChecks
  const sources = new Set(findings.map(f => f.detection_source).filter(Boolean))
  const checks: string[] = []

  // Map detection sources to user-friendly check names
  if (sources.has('head_tag') || sources.has('crawler')) checks.push('SEO')
  if (sources.has('wcag_checker') || sources.has('axe')) checks.push('WCAG')
  if (sources.has('structured_data')) checks.push('Schema')
  if (sources.has('performance_checker') || sources.has('pagespeed_api')) checks.push('Performance')
  if (sources.has('responsive_checker')) checks.push('Responsive')

  // If no independent checks detected, show AI review as the only method
  if (checks.length === 0) checks.push('AI review')

  return checks
}

/**
 * Compute per-category trust metadata.
 * Groups findings by category_index, computes evidence mix and coverage.
 */
export function computeCategoryTrust(
  findings: AuditFinding[],
  coverageLabel: CoverageLabel,
): Map<number, CategoryTrustMeta> {
  const result = new Map<number, CategoryTrustMeta>()

  // Group findings by category_index
  const byCategory = new Map<number, AuditFinding[]>()
  for (const f of findings) {
    const idx = f.category_index ?? -1
    if (idx < 0) continue
    const arr = byCategory.get(idx) || []
    arr.push(f)
    byCategory.set(idx, arr)
  }

  for (const [catIdx, catFindings] of byCategory) {
    const types = catFindings.map(f => mapEvidenceType(f))
    const verified = types.filter(t => t === 'verified').length
    const observed = types.filter(t => t === 'observed').length
    const total = types.length || 1

    const strongPercent = ((verified + observed) / total) * 100

    // Category confidence
    let confidenceLabel: ConfidenceLabel = 'medium'
    if (strongPercent >= 60 && coverageLabel !== 'limited') {
      confidenceLabel = 'high'
    } else if (strongPercent < 30 || coverageLabel === 'limited') {
      confidenceLabel = 'low'
    }

    result.set(catIdx, {
      confidence_label: confidenceLabel,
      coverage_label: coverageLabel,
    })
  }

  return result
}

/* ── Main Computation ──────────────────────────────────────── */

/**
 * Compute the full trust summary for an audit.
 * This is the primary entry point called from the pipeline.
 */
export function computeAuditTrustSummary(
  findings: AuditFinding[],
  crawlSummary: CrawlSummary | null,
): AuditTrustSummary {
  const total = findings.length || 1

  // Compute evidence type distribution
  const types = findings.map(f => mapEvidenceType(f))
  const verified = types.filter(t => t === 'verified').length
  const observed = types.filter(t => t === 'observed').length
  const heuristic = types.filter(t => t === 'heuristic').length
  const undetermined = types.filter(t => t === 'undetermined').length

  const verifiedPercent = Math.round((verified / total) * 100)
  const observedPercent = Math.round((observed / total) * 100)
  const heuristicPercent = Math.round((heuristic / total) * 100)
  const undeterminedPercent = Math.round((undetermined / total) * 100)
  // Computed from raw counts (not the rounded percents) to avoid drift
  const aiAssessedPercent = Math.round(((observed + heuristic) / total) * 100)

  // Crawl coverage
  const coverage = computeCoverageLabel(crawlSummary)

  // Overall confidence
  const confidence = computeConfidenceLabel(verifiedPercent, observedPercent, coverage.label)

  // Independent checks — execution metadata from the pipeline wins;
  // findings-derived detection covers audits that predate it.
  const checksRun = computeChecksRun(findings, crawlSummary?.checks_executed)

  return {
    crawl_coverage_label: coverage.label,
    crawl_coverage_text: coverage.text,
    confidence_label: confidence.label,
    confidence_text: confidence.text,
    verified_percent: verifiedPercent,
    observed_percent: observedPercent,
    heuristic_percent: heuristicPercent,
    undetermined_percent: undeterminedPercent,
    ai_assessed_percent: aiAssessedPercent,
    checks_run: checksRun,
    total_findings: findings.length,
  }
}
