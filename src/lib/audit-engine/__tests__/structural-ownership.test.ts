import {
  classifyStructuralOwnership,
  isLlmSource,
  type FindingForOwnership,
} from '../pipeline/structural-ownership'

// Regression fixtures taken verbatim from the hand-verified fixpath.ai audit
// (2026-06-13). All three were confirmed FALSE POSITIVES — the element was
// present. See docs/DETECTION_SOURCE_ACCURACY.md.

const CONTACT_LABELS_FP: FindingForOwnership = {
  id: 'fp-contact-labels',
  title: 'Accessibility and inclusive design',
  description:
    'The contact form on the Contact page has input fields (name, email, message) but they are not connected to label text in a way that screen readers can understand.',
  detection_source: 'analyzer',
}

const MAIN_LANDMARK_FP: FindingForOwnership = {
  id: 'fp-main-landmark',
  title: 'Main content area not marked with proper HTML landmark',
  description:
    'Every page on the site lacks a <main> HTML element wrapping the primary content. The page structure uses generic divs instead of semantic landmarks.',
  detection_source: 'deep_analyzer',
}

const FOOTER_LINK_FP: FindingForOwnership = {
  id: 'fp-footer-link',
  title: "Footer doesn't include a Contact or Support link",
  description:
    'The footer includes legal pages (privacy, terms, cookies) but no direct link to the Contact page or support information.',
  detection_source: 'analyzer',
}

const NAV_LABEL_FP: FindingForOwnership = {
  id: 'fp-nav-label',
  title: 'Multiple navigation menus not labeled to distinguish them',
  description:
    'The site has multiple <nav> elements (primary navigation and footer navigation visible in the structure), but they lack aria-label attributes.',
  detection_source: 'analyzer',
}

describe('classifyStructuralOwnership — drops LLM structural false positives', () => {
  it('drops the contact-form label claim (form-label is axe-owned)', () => {
    const { dropIds } = classifyStructuralOwnership([CONTACT_LABELS_FP])
    expect(dropIds).toContain('fp-contact-labels')
  })

  it('drops the <main> landmark claim (landmark is axe-owned)', () => {
    const { dropIds } = classifyStructuralOwnership([MAIN_LANDMARK_FP])
    expect(dropIds).toContain('fp-main-landmark')
  })

  it('drops the footer Contact-link absence claim (link presence is crawler-owned)', () => {
    const { dropIds } = classifyStructuralOwnership([FOOTER_LINK_FP])
    expect(dropIds).toContain('fp-footer-link')
  })

  it('drops the nav aria-label claim (landmark labeling is axe-owned)', () => {
    const { dropIds } = classifyStructuralOwnership([NAV_LABEL_FP])
    expect(dropIds).toContain('fp-nav-label')
  })

  it('attaches a reason naming the owning check', () => {
    const { reasons } = classifyStructuralOwnership([MAIN_LANDMARK_FP])
    expect(reasons['fp-main-landmark']).toMatch(/axe/)
  })
})

describe('classifyStructuralOwnership — never touches deterministic findings', () => {
  // These match structural patterns but come from instruments — they OWN the truth.
  it('keeps the axe contrast finding', () => {
    const f: FindingForOwnership = {
      id: 'axe-contrast',
      title: '[WCAG 1.4.3] Elements must meet minimum color contrast ratio thresholds',
      description: 'Ensure the contrast between foreground and background colors meets AA.',
      detection_source: 'axe',
    }
    expect(classifyStructuralOwnership([f]).dropIds).toHaveLength(0)
  })

  it('keeps the responsive-checker touch-target finding', () => {
    const f: FindingForOwnership = {
      id: 'resp-target',
      title: '10 touch targets below 44x44px minimum at 375px',
      description: '10 of 29 interactive elements are smaller than the WCAG 2.5.5 minimum.',
      detection_source: 'responsive_checker',
    }
    expect(classifyStructuralOwnership([f]).dropIds).toHaveLength(0)
  })

  it('keeps the axe SVG accessible-name finding', () => {
    const f: FindingForOwnership = {
      id: 'axe-svg',
      title: 'WCAG 1.1.1: Non-text Content',
      description: 'SVG has no accessible name (no <title>, accessibility-label).',
      detection_source: 'axe',
    }
    expect(classifyStructuralOwnership([f]).dropIds).toHaveLength(0)
  })
})

describe('classifyStructuralOwnership — preserves genuine interpretive findings', () => {
  it('keeps the pricing security/compliance content gap (LLM, not structural)', () => {
    const f: FindingForOwnership = {
      id: 'pricing-security',
      title: "Pricing page doesn't explain how audit data is protected or stored",
      description:
        'The /pricing page shows plan tiers but does not mention data security, encryption, compliance certifications (SOC2, GDPR), or data retention policies.',
      detection_source: 'analyzer',
    }
    expect(classifyStructuralOwnership([f]).dropIds).toHaveLength(0)
  })

  it('keeps the free-tier explanation content gap (LLM, not structural)', () => {
    const f: FindingForOwnership = {
      id: 'register-free-tier',
      title: "Free signup page doesn't explain what's included in the free account",
      description:
        "The registration page says 'Create Your Free Account' but does not state what features or limitations come with the free tier.",
      detection_source: 'analyzer',
    }
    expect(classifyStructuralOwnership([f]).dropIds).toHaveLength(0)
  })
})

describe('isLlmSource', () => {
  it('treats analyzer/deep_analyzer/gap_fill as LLM', () => {
    expect(isLlmSource('analyzer')).toBe(true)
    expect(isLlmSource('deep_analyzer')).toBe(true)
    expect(isLlmSource('gap_fill')).toBe(true)
  })
  it('treats instruments as non-LLM', () => {
    expect(isLlmSource('axe')).toBe(false)
    expect(isLlmSource('responsive_checker')).toBe(false)
    expect(isLlmSource('head_tag')).toBe(false)
  })
  it('treats unattributed findings as LLM (conservative)', () => {
    expect(isLlmSource(null)).toBe(true)
    expect(isLlmSource(undefined)).toBe(true)
  })
})
