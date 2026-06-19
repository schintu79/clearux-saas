// ============================================================
// Evidence vocabulary + checks-run tests (2026-06-12)
// ============================================================
// REGRESSION (fixpath.ai audit adac62e1 report review): the trust strip
// said '76% verified, 0% observed' while the MD export labeled the SAME
// deterministic findings 'Observed' — two taxonomies for one dataset.
// Unified (Stefano's call): 'Verified' = an instrument measured it,
// 'AI-assessed' = the LLM concluded it. Strip, badges, and export labels
// must agree. Also: 'Checks run' derived from surviving findings
// under-reported checks that ran clean — pipeline execution metadata
// (crawl_summary.checks_executed) wins when present.

import {
  computeChecksRun,
  computeAuditTrustSummary,
  evidenceDisplayLabel,
  mapEvidenceType,
} from '../pipeline/trust-summary'
import { classifyFindingEvidence } from '../../export/classify-evidence'
import type { ExportFinding } from '../../export/findings-formatter'

/* ── Fixtures ────────────────────────────────────────────── */

const finding = (overrides: Record<string, any>) => ({
  confidence_level: 'heuristic',
  confidence_score: 0.8,
  detection_source: 'analyzer',
  viewport: null,
  evidence: null,
  ...overrides,
}) as any

const exportFinding = (overrides: Partial<ExportFinding>): ExportFinding => ({
  title: 'Test finding',
  severity: 'medium',
  status: 'open',
  modules: [],
  fixType: 'Content',
  classification: 'Strategic insight',
  description: 'A description of the issue.',
  whyItMatters: null,
  recommendation: 'Fix it.',
  affectedPages: [],
  findingType: 'fixable',
  evidence: null,
  dismissed: false,
  dismissalReason: null,
  communication: null,
  confidenceLevel: null,
  detectionSource: null,
  ...overrides,
})

/* ── computeChecksRun ────────────────────────────────────── */

describe('computeChecksRun', () => {
  it('REGRESSION: pipeline execution metadata wins over findings-derived detection', () => {
    // Audit where only WCAG findings survived but responsive + PageSpeed also ran
    const findings = [finding({ detection_source: 'wcag_checker' })]
    expect(computeChecksRun(findings, ['SEO', 'Responsive', 'Performance', 'WCAG']))
      .toEqual(['SEO', 'Responsive', 'Performance', 'WCAG'])
  })

  it('falls back to findings-derived detection for audits that predate the metadata', () => {
    const findings = [
      finding({ detection_source: 'wcag_checker' }),
      finding({ detection_source: 'responsive_checker' }),
    ]
    expect(computeChecksRun(findings)).toEqual(['WCAG', 'Responsive'])
    expect(computeChecksRun(findings, null)).toEqual(['WCAG', 'Responsive'])
    expect(computeChecksRun(findings, [])).toEqual(['WCAG', 'Responsive'])
  })

  it('shows AI review when no independent checks are detectable', () => {
    expect(computeChecksRun([finding({ detection_source: 'analyzer' })])).toEqual(['AI review'])
  })
})

/* ── Unified display labels ──────────────────────────────── */

describe('evidenceDisplayLabel (single source for strip, badges, export)', () => {
  it('deterministic detection displays as Measured (honest about method, not certainty)', () => {
    expect(evidenceDisplayLabel(mapEvidenceType(finding({ confidence_level: 'deterministic', detection_source: 'wcag_checker' }))))
      .toBe('Measured')
  })

  it('interpretive and heuristic LLM findings display as AI-assessed — never Observed/Heuristic', () => {
    expect(evidenceDisplayLabel(mapEvidenceType(finding({ confidence_level: 'interpretive' })))).toBe('AI-assessed')
    expect(evidenceDisplayLabel(mapEvidenceType(finding({ confidence_level: 'heuristic', confidence_score: 0.5 })))).toBe('AI-assessed')
  })

  it('very low confidence stays the honesty valve', () => {
    expect(evidenceDisplayLabel(mapEvidenceType(finding({ confidence_score: 0.1 })))).toBe('Not enough evidence')
  })
})

describe('computeAuditTrustSummary ai_assessed_percent', () => {
  it('merges observed + heuristic into the AI-assessed display tier', () => {
    const findings = [
      finding({ confidence_level: 'deterministic', detection_source: 'wcag_checker' }), // verified
      finding({ confidence_level: 'interpretive' }),  // observed (internal)
      finding({ confidence_level: 'heuristic', confidence_score: 0.5 }), // heuristic (internal)
      finding({ confidence_level: 'heuristic', confidence_score: 0.5 }),
    ]
    const trust = computeAuditTrustSummary(findings, null)
    expect(trust.verified_percent).toBe(25)
    expect(trust.ai_assessed_percent).toBe(75)
  })
})

/* ── Export classifier — DB truth, not regex guessing ────── */

describe('classifyFindingEvidence (unified with the trust strip)', () => {
  it('REGRESSION: deterministic findings are Verified in the export, regardless of prose', () => {
    const [c] = classifyFindingEvidence([exportFinding({
      confidenceLevel: 'deterministic',
      detectionSource: 'wcag_checker',
      // Prose that the old regex classifier would have called 'observed'
      description: 'Focus indicators are removed by a global styling rule.',
    })])
    expect(c.evidenceStrength).toBe('verified')
  })

  it('deterministic detection_source alone is enough (carried rows may lack confidence level)', () => {
    const [c] = classifyFindingEvidence([exportFinding({ detectionSource: 'structured_data' })])
    expect(c.evidenceStrength).toBe('verified')
  })

  it('LLM findings are AI-assessed — quoting site text no longer inflates them to verified', () => {
    const [c] = classifyFindingEvidence([exportFinding({
      confidenceLevel: 'interpretive',
      detectionSource: 'analyzer',
      description: 'The headline shows "Get started today" without explaining the product, for example, the pricing page assumes context.',
    })])
    expect(c.evidenceStrength).toBe('ai_assessed')
  })

  it('honest-absence findings stay flagged as unverified', () => {
    const [c] = classifyFindingEvidence([exportFinding({
      confidenceLevel: 'heuristic',
      description: 'Color contrast could not be verified — no color contrast testing was performed in this audit.',
    })])
    expect(c.evidenceStrength).toBe('unverified')
  })

  it('substantive evidence vetoes the unverified demotion but does not fake verification', () => {
    const [c] = classifyFindingEvidence([exportFinding({
      confidenceLevel: 'heuristic',
      description: 'The audit found no evidence of testimonials being highlighted.',
      evidence: 'Homepage hero section contains only product copy; no customer quotes present anywhere.',
    })])
    expect(c.evidenceStrength).toBe('ai_assessed')
  })
})
