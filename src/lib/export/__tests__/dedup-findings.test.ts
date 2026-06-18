// ============================================================
// Export dedup — over-merge guard (2026-06-18)
// Regression: unrelated findings that only share boilerplate description text
// ("this issue may affect how visitors experience your site") were clustering
// because the combined-similarity path didn't check topic. The fix requires a
// shared significant TITLE word on that weak path.
// ============================================================

import { deduplicateFindings } from '../dedup-findings'
import type { ExportFinding } from '../findings-formatter'

const mk = (title: string, description: string, over: Partial<ExportFinding> = {}): ExportFinding =>
  ({
    title,
    description,
    severity: 'medium',
    modules: ['Module'],
    affectedPages: [],
    whyItMatters: '',
    recommendation: 'do x',
    evidence: '',
    ...over,
  } as unknown as ExportFinding)

const BOILERPLATE = 'This issue may affect how visitors experience and interact with your site on this page.'

describe('deduplicateFindings — over-merge guard', () => {
  it('does NOT merge unrelated findings that only share description boilerplate', () => {
    const out = deduplicateFindings([
      mk('Page-specific meta tags and descriptions', BOILERPLATE),
      mk('Error modal dialog cannot be dismissed', BOILERPLATE),
    ])
    expect(out).toHaveLength(2) // no shared significant title word → stay separate
  })

  it('still merges true duplicates that share a root cause across modules', () => {
    const out = deduplicateFindings([
      mk('Canonical URL missing on key pages', 'The canonical tag is absent.', { modules: ['SEO Structure & Rules'] }),
      mk('No canonical tag found', 'Pages lack a canonical url.', { modules: ['Future Readiness'] }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].mergedCount).toBe(2)
  })

  it('still merges near-identical findings (same title + similar body)', () => {
    const out = deduplicateFindings([
      mk('Unused JavaScript loaded on the homepage', 'JavaScript is downloaded but never executed, wasting bandwidth on this page.'),
      mk('Unused JavaScript loaded on the homepage', 'JavaScript is downloaded but never executed, wasting bandwidth on this page.'),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].mergedCount).toBe(2)
  })

  it('merges on the combined path only when titles share a significant word', () => {
    // High body overlap AND a shared title word ("contrast") → merge.
    const out = deduplicateFindings([
      mk('Low colour contrast on body text', 'Text fails the WCAG AA contrast minimum against its background on this page.'),
      mk('Insufficient contrast on labels', 'Text fails the WCAG AA contrast minimum against its background on this page.'),
    ])
    expect(out).toHaveLength(1)
  })

  it('passes a single finding through unchanged', () => {
    const out = deduplicateFindings([mk('Solo finding', 'desc')])
    expect(out).toHaveLength(1)
    expect(out[0].mergedCount).toBe(1)
  })
})
