import {
  classifyLimitation,
  buildLimitations,
  type CaptureForLimitation,
  type LimitationDecisionRecord,
} from '../coverage-limitations'

const errorPage: CaptureForLimitation = {
  page_url: 'https://x.com/ar/options',
  page_status: 'complete',
  http_status: 200,
  fetch_strategy: 'jina',
  extracted_text: 'upstream connect error or disconnect/reset before headers. reset reason: connection termination',
  captured_at: '2026-06-16T09:46:00Z',
}
const goodPage: CaptureForLimitation = {
  page_url: 'https://x.com/ar/pricing',
  page_status: 'complete',
  http_status: 200,
  fetch_strategy: 'direct+rendered',
  extracted_text: 'Pricing Plans. '.repeat(80),
}

describe('classifyLimitation', () => {
  it('flags an upstream/proxy error body', () => {
    expect(classifyLimitation(errorPage)).toBe('upstream_error')
  })
  it('flags failed/partial/thin', () => {
    expect(classifyLimitation({ page_url: 'a', page_status: 'failed', extracted_text: '' })).toBe('unreachable')
    expect(classifyLimitation({ page_url: 'a', page_status: 'partial', extracted_text: 'some' })).toBe('partial_capture')
    expect(classifyLimitation({ page_url: 'a', page_status: 'complete', extracted_text: 'tiny' })).toBe('thin_content')
  })
  it('returns null for a healthy page', () => {
    expect(classifyLimitation(goodPage)).toBeNull()
  })
})

describe('buildLimitations + workspace memory', () => {
  it('surfaces open limitations with evidence', () => {
    const lims = buildLimitations([errorPage, goodPage])
    expect(lims).toHaveLength(1)
    expect(lims[0].reason).toBe('upstream_error')
    expect(lims[0].status).toBe('open')
    expect(lims[0].evidence.text_excerpt).toContain('upstream connect error')
    expect(lims[0].evidence.fetch_strategy).toBe('jina')
  })

  it('REMEMBERS a dismissal — does not re-surface it (the deeper-audit case)', () => {
    const decisions: LimitationDecisionRecord[] = [
      { page_url: 'https://x.com/ar/options', reason: 'upstream_error', decision: 'dismissed' },
    ]
    expect(buildLimitations([errorPage], decisions)).toHaveLength(0)
  })

  it('keeps a promoted limitation visible and linked to its finding', () => {
    const decisions: LimitationDecisionRecord[] = [
      { page_url: 'https://x.com/ar/options', reason: 'upstream_error', decision: 'promoted', finding_id: 'f-1' },
    ]
    const lims = buildLimitations([errorPage], decisions)
    expect(lims).toHaveLength(1)
    expect(lims[0].status).toBe('promoted')
    expect(lims[0].finding_id).toBe('f-1')
  })

  it('can include dismissed ones when asked (e.g. an audit trail view)', () => {
    const decisions: LimitationDecisionRecord[] = [
      { page_url: 'https://x.com/ar/options', reason: 'upstream_error', decision: 'dismissed' },
    ]
    const lims = buildLimitations([errorPage], decisions, { includeDecided: true })
    expect(lims).toHaveLength(1)
    expect(lims[0].status).toBe('dismissed')
  })

  it('matches decisions tolerant of trailing slashes', () => {
    const decisions: LimitationDecisionRecord[] = [
      { page_url: 'https://x.com/ar/options/', reason: 'upstream_error', decision: 'dismissed' },
    ]
    expect(buildLimitations([errorPage], decisions)).toHaveLength(0)
  })
})
