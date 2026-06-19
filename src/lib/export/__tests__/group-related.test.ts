import { groupRelatedFindings } from '../group-related'
import type { ClassifiedFinding } from '../classify-evidence'

function f(title: string, description = '', severity = 'medium'): ClassifiedFinding {
  return { title, description, severity } as unknown as ClassifiedFinding
}

describe('groupRelatedFindings — accessibility over-merge fix', () => {
  it('does NOT lump four unrelated WCAG criteria into one group', () => {
    const findings = [
      f('10 touch targets below 44x44px minimum', 'WCAG 2.5.5 minimum tap size', 'high'),
      f('WCAG 2.1.1: Keyboard', 'interactive element not keyboard-accessible', 'high'),
      f('WCAG 1.1.1: Non-text Content', 'SVG has no accessible name', 'medium'),
      f('WCAG 2.4.6: Headings and Labels', 'heading structure skips levels h2 → h4', 'low'),
    ]
    const clusters = groupRelatedFindings(findings)
    // None of these share a cohesive sub-topic → each stays standalone.
    expect(clusters.every((c) => !c.isClustered)).toBe(true)
    expect(clusters).toHaveLength(4)
    // And specifically: no cluster labelled with the old catch-all.
    expect(clusters.some((c) => c.label === 'Accessibility and inclusive design')).toBe(false)
  })

  it('STILL groups genuinely related findings (two color-contrast issues)', () => {
    const findings = [
      f('Low color contrast on hero CTA', 'contrast ratio 2.9:1 fails WCAG 1.4.3', 'high'),
      f('Color contrast insufficient in footer links', 'low contrast text on tinted background', 'medium'),
    ]
    const clusters = groupRelatedFindings(findings)
    const contrast = clusters.find((c) => c.isClustered)
    expect(contrast).toBeDefined()
    expect(contrast!.members).toHaveLength(2)
    expect(contrast!.label).toBe('Color contrast and legibility')
  })

  it('meta-tags cluster no longer matches the substring "og" inside ordinary words', () => {
    const findings = [
      f('Blog index missing pagination', 'the blog catalog and dialog flows need work', 'medium'),
      f('Free audit offer unclear', 'visitors need to know the scope before signup', 'low'),
    ]
    const clusters = groupRelatedFindings(findings)
    // Neither mentions real meta/OG tags → no meta-tags cluster.
    expect(clusters.some((c) => c.label === 'Page-specific meta tags and descriptions')).toBe(false)
    expect(clusters.every((c) => !c.isClustered)).toBe(true)
  })

  it('meta-tags cluster STILL groups genuine meta/OG findings', () => {
    const findings = [
      f('Generic meta description', 'the meta description is not page-specific', 'medium'),
      f('Missing og:title', 'og:title and og:image tags absent for social sharing', 'low'),
    ]
    const clusters = groupRelatedFindings(findings)
    const meta = clusters.find((c) => c.label === 'Page-specific meta tags and descriptions')
    expect(meta).toBeDefined()
    expect(meta!.members).toHaveLength(2)
  })

  it('does not cross-group keyboard with alt-text', () => {
    const findings = [
      f('Keyboard trap in modal', 'focus order broken, tabindex misuse', 'high'),
      f('Missing alt text on product images', 'image alt attributes absent', 'medium'),
    ]
    const clusters = groupRelatedFindings(findings)
    expect(clusters.every((c) => !c.isClustered)).toBe(true)
  })
})
