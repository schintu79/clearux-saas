import { plainCopyForDeterministicFinding, synthesizeCommunication } from '../communication-layer'

describe('plainCopyForDeterministicFinding — humanize the known deterministic checks', () => {
  it('touch targets: plain copy, no "44x44px" jargon in the lead, keeps examples', () => {
    const c = plainCopyForDeterministicFinding(
      '10 touch targets below 44x44px minimum at 375px',
      '10 of 30 interactive elements (33%) are smaller than the WCAG 2.5.5 minimum of 44x44px on mobile screen size. Examples: <a> "Product" (45x17px); <a> "Pricing" (40x17px).',
    )
    expect(c).not.toBeNull()
    expect(c!.title_plain.toLowerCase()).toContain('too small to tap')
    expect(c!.what_found).toMatch(/Product|Pricing/) // keeps the "where"
    expect(c!.what_found).not.toMatch(/WCAG 2\.5\.5/) // no spec jargon in the lead
  })

  it('keyboard (WCAG 2.1.1): explains it in human terms', () => {
    const c = plainCopyForDeterministicFinding(
      'WCAG 2.1.1: Keyboard',
      '[WCAG 2.1.1] 1 interactive element(s) are not keyboard-accessible (tabindex="-1").',
    )
    expect(c).not.toBeNull()
    expect(c!.what_found.toLowerCase()).toContain('keyboard')
    expect(c!.title_plain.toLowerCase()).not.toContain('wcag 2.1.1')
  })

  it('content density: plain copy', () => {
    const c = plainCopyForDeterministicFinding(
      'Content blocks are tightly packed on mobile — poor visual breathing room',
      '11 of 15 content blocks (73%) have less than 8px spacing between them at the 375px screen size.',
    )
    expect(c).not.toBeNull()
    expect(c!.title_plain.toLowerCase()).toContain('crammed')
  })

  it('returns null for anything it does not recognize (generic synth still handles it)', () => {
    expect(plainCopyForDeterministicFinding('Some bespoke AI finding', 'a unique strategic observation')).toBeNull()
  })

  it('synthesizeCommunication uses the curated copy and preserves the technical detail', () => {
    const comm = synthesizeCommunication(
      {
        title: '10 touch targets below 44x44px minimum at 375px',
        description: '10 of 30 interactive elements are smaller than the WCAG 2.5.5 minimum of 44x44px.',
        recommendation: 'Increase the size of interactive elements to at least 44x44px on touch devices.',
        estimatedImpact: 'Users will struggle to tap buttons and links accurately.',
      },
      null,
    )
    expect(comm.title_plain.toLowerCase()).toContain('too small to tap')
    // Developer detail retained in the technical note.
    expect(comm.technical_note).toMatch(/44x44px/)
  })
})
