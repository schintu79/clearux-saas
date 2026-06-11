// ============================================================
// Trust-engine tests — fabrication/contradiction net (Plan §0.2.3)
// ============================================================
// Every fixture here is a REAL incident from June 2026. If one of
// these tests breaks, a customer-facing fabrication is back.

import { contradictsContent } from '../analyzer'

// ── Real page-content fixtures ──────────────────────────────

/** qinacademy.com homepage (abridged): HAS real testimonials with names */
const QIN_CONTENT = `
QIN ACADEMY
Personalized platform for all educational needs
QIN TESTIMONIALS
From our students
"Tommy cleared up topics I was concerned about. He made the class so much easier! Great examples." — Muhannad S.
"The online class was great, but being able to watch the recording of the classes was a huge bonus!" — Andrew H.
Private Tutoring · Crash Courses · Contact & Support
`

/** fixpath.ai homepage (abridged): NO testimonials — but marketing copy
 *  MENTIONS trust/testimonial concepts as product features, and contains
 *  ordinary quoted strings followed by capitalized sentences (the pattern
 *  that fooled the first loose evidence regex). */
const FIXPATH_CONTENT = `
Fixpath — See what is hurting trust. Fix what matters.
"Find what hurts trust. Fix what matters." Based on verified checks, real page evidence, and structured review.
Our Trust, Credibility & Social Proof module checks your testimonials, reviews and social proof signals.
112 checkpoints across 7 modules. Audits built on verified checks.
Pricing · Product · Why Fixpath
`

describe('absence claims (finding says "missing X")', () => {
  it('REGRESSION qinacademy 2026-06-10: drops "no testimonials" when real attributed testimonials exist', () => {
    const finding = {
      title: 'Trust signals and social proof',
      description: 'The site contains no student testimonials, reviews, case studies, or quantified outcomes.',
    }
    expect(contradictsContent(finding as any, QIN_CONTENT)).toBe(true)
  })

  it('allows an honest absence claim on a site that truly has none', () => {
    const finding = {
      title: 'No social proof for a new brand',
      description: 'The site has no testimonials or case studies. As a new company, focus on earning real proof.',
    }
    expect(contradictsContent(finding as any, FIXPATH_CONTENT)).toBe(false)
  })
})

describe('presence fabrications (finding critiques X the site does not have)', () => {
  it('REGRESSION fixpath 2026-06-11: drops "testimonials lack attribution" on a site with zero testimonials', () => {
    const finding = {
      title: 'Testimonials lack specificity and verifiable attribution',
      description:
        'The site displays customer testimonials but they lack the specific details and verifiable attribution that would build trust with a professional B2B audience.',
    }
    expect(contradictsContent(finding as any, FIXPATH_CONTENT)).toBe(true)
  })

  it('REGRESSION fixpath 2026-06-11 (deep-audit wording): drops "customer quotes lack company names"', () => {
    const finding = {
      title: 'Trust signals and social proof',
      description:
        "The site includes customer quotes, but they lack company names, job titles, or specific results.",
    }
    expect(contradictsContent(finding as any, FIXPATH_CONTENT)).toBe(true)
  })

  it('mention-is-not-existence: marketing copy ABOUT testimonial checks is not evidence of testimonials', () => {
    // FIXPATH_CONTENT contains the word "testimonials" (as a feature description)
    // and a 25+ char quote followed by a capitalized word — the exact traps
    // that defeated the first loose regex.
    const finding = {
      title: 'Testimonials are anonymous',
      description: 'Testimonials lack attribution details that would let visitors verify they are real.',
    }
    expect(contradictsContent(finding as any, FIXPATH_CONTENT)).toBe(true)
  })

  it('allows quality critique when structural testimonial evidence exists', () => {
    const finding = {
      title: 'Testimonials lack verifiable attribution',
      description:
        'Testimonials lack links to trusted platforms or quantified results, limiting their persuasive power.',
    }
    // QIN really has quote+dash+name structure — critique is legitimate
    expect(contradictsContent(finding as any, QIN_CONTENT)).toBe(false)
  })

  it('drops case-study critiques when no case studies exist', () => {
    const finding = {
      title: 'Case studies missing results',
      description: 'The case studies lack quantified outcomes and metrics.',
    }
    expect(contradictsContent(finding as any, FIXPATH_CONTENT)).toBe(true)
  })
})

describe('unrelated findings pass through', () => {
  it('does not drop ordinary findings', () => {
    const finding = {
      title: 'Meta description is generic',
      description: 'The homepage meta description duplicates the title and wastes SERP space.',
    }
    expect(contradictsContent(finding as any, FIXPATH_CONTENT)).toBe(false)
    expect(contradictsContent(finding as any, QIN_CONTENT)).toBe(false)
  })
})
