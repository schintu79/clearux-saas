import {
  clampSeverityToEvidence,
  enforceSeverityEvidenceInvariant,
  MAX_SEVERITY_BY_EVIDENCE,
} from '../pipeline/evidence-severity'

describe('clampSeverityToEvidence — the invariant', () => {
  it('"Not enough evidence" (undetermined) can never be HIGH or critical', () => {
    expect(clampSeverityToEvidence('high', 'undetermined')).toBe('low')
    expect(clampSeverityToEvidence('critical', 'undetermined')).toBe('low')
    expect(clampSeverityToEvidence('medium', 'undetermined')).toBe('low')
  })

  it('heuristic findings cannot be critical (capped at high)', () => {
    expect(clampSeverityToEvidence('critical', 'heuristic')).toBe('high')
    expect(clampSeverityToEvidence('high', 'heuristic')).toBe('high')
  })

  it('verified / observed findings are never clamped', () => {
    expect(clampSeverityToEvidence('critical', 'verified')).toBe('critical')
    expect(clampSeverityToEvidence('high', 'verified')).toBe('high')
    expect(clampSeverityToEvidence('critical', 'observed')).toBe('critical')
  })

  it('never raises severity', () => {
    expect(clampSeverityToEvidence('low', 'verified')).toBe('low')
    expect(clampSeverityToEvidence('low', 'undetermined')).toBe('low')
  })

  it('ceilings are wired correctly', () => {
    expect(MAX_SEVERITY_BY_EVIDENCE.undetermined).toBe('low')
    expect(MAX_SEVERITY_BY_EVIDENCE.heuristic).toBe('high')
    expect(MAX_SEVERITY_BY_EVIDENCE.verified).toBe('critical')
  })
})

describe('enforceSeverityEvidenceInvariant — over findings', () => {
  it('clamps the fixpath.ai case: a low-confidence HIGH becomes LOW', () => {
    // confidence_score < 0.3 → mapEvidenceType returns "undetermined"
    const findings = [
      { id: 'fp', severity: 'high', confidence_level: 'heuristic', confidence_score: 0.2, detection_source: 'analyzer', viewport: null },
    ] as any
    const clamps = enforceSeverityEvidenceInvariant(findings)
    expect(clamps).toHaveLength(1)
    expect(clamps[0]).toMatchObject({ id: 'fp', from: 'high', to: 'low', evidence: 'undetermined' })
  })

  it('leaves a verified HIGH untouched', () => {
    const findings = [
      { id: 'axe', severity: 'high', confidence_level: 'deterministic', confidence_score: 0.95, detection_source: 'axe', viewport: null },
    ] as any
    expect(enforceSeverityEvidenceInvariant(findings)).toHaveLength(0)
  })

  it('caps a heuristic CRITICAL down to HIGH', () => {
    const findings = [
      { id: 'h', severity: 'critical', confidence_level: 'heuristic', confidence_score: 0.6, detection_source: 'analyzer', viewport: null },
    ] as any
    const clamps = enforceSeverityEvidenceInvariant(findings)
    expect(clamps).toHaveLength(1)
    expect(clamps[0]).toMatchObject({ id: 'h', to: 'high', evidence: 'heuristic' })
  })

  it('returns nothing when every finding already respects the invariant', () => {
    const findings = [
      { id: 'ok1', severity: 'low', confidence_level: 'heuristic', confidence_score: 0.2, detection_source: 'analyzer', viewport: null },
      { id: 'ok2', severity: 'critical', confidence_level: 'deterministic', confidence_score: 0.9, detection_source: 'axe', viewport: null },
    ] as any
    expect(enforceSeverityEvidenceInvariant(findings)).toHaveLength(0)
  })
})
