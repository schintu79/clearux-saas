import {
  verifyFindingsAgainstDom,
  type DomFacts,
  type FindingForDomCheck,
} from '../pipeline/dom-verification'

// A DOM where everything the fixpath.ai LLM claimed "missing" is actually present.
const FULL_DOM: DomFacts = {
  landmarks: { main: true, nav: 2, header: true, footer: true, skipLink: true },
  headings: [1, 2, 2, 3],
  forms: { totalControls: 3, labeledControls: 3, requiredMarked: 3 },
  links: [
    { text: 'Contact', href: '/contact' },
    { text: 'Pricing', href: '/pricing' },
  ],
  langAttr: 'en',
  viewportMeta: true,
}

const llm = (id: string, title: string, description = ''): FindingForDomCheck => ({
  id,
  title,
  description,
  detection_source: 'analyzer',
})

describe('verifyFindingsAgainstDom — refutes LLM absence-claims the DOM disproves', () => {
  it('refutes "every page lacks a <main> element"', () => {
    const f = llm('main', 'Main content area not marked with proper HTML landmark', 'Every page lacks a <main> HTML element wrapping the primary content.')
    expect(verifyFindingsAgainstDom([f], FULL_DOM).refutedIds).toContain('main')
  })

  it('refutes "contact form fields are not connected to labels"', () => {
    const f = llm('labels', 'Accessibility', 'The contact form has input fields but they are not connected to label text.')
    expect(verifyFindingsAgainstDom([f], FULL_DOM).refutedIds).toContain('labels')
  })

  it('refutes "footer has no Contact or Support link"', () => {
    const f = llm('link', "Footer doesn't include a Contact or Support link", 'The footer has no direct link to the Contact page.')
    expect(verifyFindingsAgainstDom([f], FULL_DOM).refutedIds).toContain('link')
  })

  it('refutes "no skip to main content link"', () => {
    const f = llm('skip', 'No skip to main content link', 'Keyboard users cannot bypass the navigation.')
    expect(verifyFindingsAgainstDom([f], FULL_DOM).refutedIds).toContain('skip')
  })

  it('refutes "missing lang attribute" and "missing viewport meta"', () => {
    const lang = llm('lang', 'Page is missing a lang attribute')
    const vp = llm('vp', 'Missing viewport meta tag')
    const out = verifyFindingsAgainstDom([lang, vp], FULL_DOM)
    expect(out.refutedIds).toEqual(expect.arrayContaining(['lang', 'vp']))
  })

  it('attaches a DOM-fact reason for each refutation', () => {
    const f = llm('main', 'No <main> landmark present')
    expect(verifyFindingsAgainstDom([f], FULL_DOM).reasons['main']).toMatch(/<main>|landmark/)
  })
})

describe('verifyFindingsAgainstDom — does not over-refute', () => {
  it('keeps a genuine absence claim when the DOM confirms it (h1 truly missing)', () => {
    const noH1: DomFacts = { ...FULL_DOM, headings: [2, 3] }
    const f = llm('h1', 'Page has no h1 heading')
    expect(verifyFindingsAgainstDom([f], noH1).refutedIds).toHaveLength(0)
  })

  it('keeps a form-label claim when only SOME controls are labeled', () => {
    const partial: DomFacts = { ...FULL_DOM, forms: { totalControls: 3, labeledControls: 1, requiredMarked: 0 } }
    const f = llm('labels', 'Form inputs are not connected to labels')
    expect(verifyFindingsAgainstDom([f], partial).refutedIds).toHaveLength(0)
  })

  it('never refutes instrument-sourced findings (they own structural truth)', () => {
    const axe: FindingForDomCheck = { id: 'axe', title: 'No accessible name on control', description: 'label missing', detection_source: 'axe' }
    expect(verifyFindingsAgainstDom([axe], FULL_DOM).refutedIds).toHaveLength(0)
  })

  it('leaves interpretive content findings untouched', () => {
    const f = llm('cta', 'Primary CTA button text lacks action clarity', 'Buttons say "Get Started" without specifying the outcome.')
    expect(verifyFindingsAgainstDom([f], FULL_DOM).refutedIds).toHaveLength(0)
  })

  it('is a no-op when no DOM snapshot is available (never drop without evidence)', () => {
    const f = llm('main', 'Every page lacks a <main> element')
    expect(verifyFindingsAgainstDom([f], null).refutedIds).toHaveLength(0)
  })
})
