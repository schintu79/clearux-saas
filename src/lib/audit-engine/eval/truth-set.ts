// ============================================================
// Fixpath — Detection Accuracy Truth-Set (P2)
// ============================================================
//
// A hand-verified, labeled dataset of real findings with ground-truth verdicts.
// This is the instrument that turns "we're accurate" into a NUMBER: the
// precision harness (precision.ts) runs the live noise gates over these cases
// and measures how many confirmed false positives are eliminated and — the
// safety check — how many genuine findings are wrongly dropped.
//
// This is what makes the moat defensible and regression-proof: every change to
// the gates re-runs against this set, and the deploy gate test fails if the
// false-positive elimination drops or a true positive starts getting dropped.
//
// HOW TO GROW IT: each time we hand-verify an audit, append a TruthSet here
// (and a row in docs/DETECTION_SOURCE_ACCURACY.md). Run 1 = fixpath.ai
// (2026-06-13). More sites → a more trustworthy published FP rate.
// ============================================================

import type { DomFacts } from '../pipeline/dom-verification'

export type GroundTruth = 'true_positive' | 'false_positive'

export interface TruthCase {
  id: string
  detection_source: string
  title: string
  description: string
  target_element?: string | null
  evidence?: string | null
  page_url?: string | null
  /** The hand-verified verdict: was this finding actually real? */
  groundTruth: GroundTruth
  note: string
}

export interface TruthSet {
  name: string
  capturedAt: string
  /** Verified ground-truth DOM for the audited site (per representative page). */
  domByUrl: Record<string, DomFacts>
  fallbackUrl: string
  cases: TruthCase[]
}

// fixpath.ai DOM as hand-verified on 2026-06-13: every element the LLM claimed
// "missing" is in fact present.
const FIXPATH_DOM: DomFacts = {
  landmarks: { main: true, nav: 1, header: true, footer: true, skipLink: true },
  headings: [1, 2, 2, 3, 3],
  forms: { totalControls: 3, labeledControls: 3, requiredMarked: 3 },
  links: [
    { text: 'Contact', href: '/contact' },
    { text: 'Pricing', href: '/pricing' },
    { text: 'Product', href: '/product' },
  ],
  langAttr: 'en',
  viewportMeta: true,
}

export const FIXPATH_RUN_1: TruthSet = {
  name: 'fixpath.ai',
  capturedAt: '2026-06-13',
  domByUrl: { 'https://www.fixpath.ai/': FIXPATH_DOM, 'https://www.fixpath.ai/contact': FIXPATH_DOM },
  fallbackUrl: 'https://www.fixpath.ai/',
  cases: [
    // ── Confirmed FALSE POSITIVES (LLM absence-claims, must be eliminated) ──
    {
      id: 'fp-contact-labels',
      detection_source: 'analyzer',
      title: 'Accessibility and inclusive design',
      description: 'The contact form has input fields (name, email, message) but they are not connected to label text in a way that screen readers can understand.',
      page_url: 'https://www.fixpath.ai/contact',
      groundTruth: 'false_positive',
      note: 'Form has <label htmlFor>, aria-required, required — labels are present.',
    },
    {
      id: 'fp-main-landmark',
      detection_source: 'deep_analyzer',
      title: 'Main content area not marked with proper HTML landmark',
      description: 'Every page on the site lacks a <main> HTML element wrapping the primary content.',
      page_url: 'https://www.fixpath.ai/',
      groundTruth: 'false_positive',
      note: 'All pages render <main>.',
    },
    {
      id: 'fp-footer-link',
      detection_source: 'analyzer',
      title: "Footer doesn't include a Contact or Support link",
      description: 'The footer includes legal pages but no direct link to the Contact page.',
      page_url: 'https://www.fixpath.ai/',
      groundTruth: 'false_positive',
      note: "Footer's first link is Contact.",
    },
    {
      id: 'fp-nav-label',
      detection_source: 'analyzer',
      title: 'Multiple navigation menus not labeled to distinguish them',
      description: 'The site has multiple <nav> elements but they lack aria-label attributes.',
      page_url: 'https://www.fixpath.ai/',
      groundTruth: 'false_positive',
      note: 'Primary nav now labeled; footer is <footer>, not a second nav.',
    },

    // ── TRUE POSITIVES that MUST SURVIVE ──
    // Instrument findings (grounded by measurement):
    {
      id: 'tp-axe-contrast',
      detection_source: 'axe',
      title: '[WCAG 1.4.3] Elements must meet minimum color contrast ratio thresholds',
      description: 'A text element does not meet the AA contrast minimum.',
      target_element: '.text-\\[7px\\].leading-snug.truncate',
      groundTruth: 'true_positive',
      note: 'Deterministic axe measurement.',
    },
    {
      id: 'tp-resp-touch',
      detection_source: 'responsive_checker',
      title: '10 touch targets below 44x44px minimum at 375px',
      description: '10 of 29 interactive elements are smaller than the WCAG 2.5.5 minimum.',
      groundTruth: 'true_positive',
      note: 'Deterministic responsive measurement.',
    },
    {
      id: 'tp-resp-fixedwidth',
      detection_source: 'responsive_checker',
      title: '3 elements with fixed widths exceeding 375px viewport',
      description: 'Elements use fixed pixel widths larger than the 375px screen size.',
      groundTruth: 'true_positive',
      note: 'Deterministic responsive measurement.',
    },
    {
      id: 'tp-wcag-svg',
      detection_source: 'wcag_checker',
      title: 'WCAG 1.1.1: Non-text Content',
      description: 'SVG has no accessible name (no <title>, aria-label).',
      target_element: '<svg>',
      groundTruth: 'true_positive',
      note: 'Deterministic WCAG check.',
    },
    // Interpretive findings grounded in a verbatim quote (the LLM's legit domain):
    {
      id: 'tp-pricing-security',
      detection_source: 'analyzer',
      title: "Pricing page lacks clarity on data handling and security",
      description: "The /pricing page shows plan tiers but the copy 'Start free audit' never mentions encryption, SOC2, GDPR, or data retention.",
      page_url: 'https://www.fixpath.ai/pricing',
      groundTruth: 'true_positive',
      note: 'Real content gap; grounded in a quote.',
    },
    {
      id: 'tp-free-tier',
      detection_source: 'analyzer',
      title: "Signup page doesn't explain what's included in the free account",
      description: "The page says 'Create Your Free Account' but never states the free-tier limits.",
      page_url: 'https://www.fixpath.ai/register',
      groundTruth: 'true_positive',
      note: 'Real content gap; grounded in a quote.',
    },
  ],
}

export const ALL_TRUTH_SETS: TruthSet[] = [FIXPATH_RUN_1]
