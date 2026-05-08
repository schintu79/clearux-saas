// ============================================================
// ClearUX — Audit Checkpoint Labels (client-safe)
// Short labels for the 96 checkpoints, grouped by category.
// Used in the audit detail page to show pass/fail checklist.
// ============================================================

export const CHECKPOINT_LABELS: Record<string, string[]> = {
  // Foundation
  'Visual Design & First Impression': ['Above-the-fold clarity', 'Visual hierarchy & flow', 'Design consistency', 'Professional quality'],
  'Value Proposition & Messaging': ['Headline clarity', 'Differentiation', 'Audience fit', 'Proof & evidence'],
  'Navigation & Information Architecture': ['Primary navigation', 'Page structure', 'Footer & secondary nav', 'Internal linking'],
  'Content Quality & Readability': ['Scannability', 'Writing quality', 'Tone & voice', 'Media quality'],
  // Human Experience
  'Calls-to-Action & Conversion Path': ['Primary CTA', 'Conversion flow', 'Supporting elements', 'Secondary CTAs'],
  'Trust, Credibility & Social Proof': ['Social proof', 'Authority signals', 'Transparency', 'Security & safety'],
  'Ethical UX & Dark Pattern Detection': ['Confirmshaming', 'Fake urgency & scarcity', 'Hidden costs', 'Consent & privacy'],
  'Emotional Design & Psychological Safety': ['Anxiety reduction', 'Error handling', 'Tone & respect', 'Process transparency'],
  // Inclusive Design
  'Accessibility & WCAG Compliance': ['Perceivable (contrast, alt text)', 'Operable (keyboard, focus)', 'Understandable (labels, errors)', 'Robust (ARIA, semantic HTML)'],
  'Cognitive Accessibility & Neurodiversity': ['Cognitive load', 'Readability (fonts, spacing)', 'Predictability', 'Multi-modal communication'],
  'Digital Wellbeing & Responsible Design': ['Respectful engagement', 'Time respect', 'Inclusive of all abilities', 'Healthy defaults'],
  'Mobile Experience & Responsive Design': ['Viewport & responsiveness', 'Touch targets (44px+)', 'Mobile navigation', 'Mobile content priority'],
  // Future Readiness
  'Performance & Technical Health': ['Page weight', 'Render strategy', 'Technical SEO', 'Structured data / schema'],
  'AI Discoverability & LLM Readiness': ['LLM comprehension', 'Semantic structure', 'Content accessibility', 'Machine-readable identity'],
  'AI Agent Readiness': ['Agent navigability', 'Interactive elements', 'Crawl infrastructure', 'Real-world AI test'],
  'Cultural Sensitivity & Global Readiness': ['Language clarity', 'Internationalisation', 'Cultural neutrality', 'Legal & privacy'],
}

// Short pillar labels for checkpoint grouping
export const PILLAR_FOR_CATEGORY: Record<string, string> = {
  'Visual Design & First Impression': 'Foundation',
  'Value Proposition & Messaging': 'Foundation',
  'Navigation & Information Architecture': 'Foundation',
  'Content Quality & Readability': 'Foundation',
  'Calls-to-Action & Conversion Path': 'Human Experience',
  'Trust, Credibility & Social Proof': 'Human Experience',
  'Ethical UX & Dark Pattern Detection': 'Human Experience',
  'Emotional Design & Psychological Safety': 'Human Experience',
  'Accessibility & WCAG Compliance': 'Inclusive Design',
  'Cognitive Accessibility & Neurodiversity': 'Inclusive Design',
  'Digital Wellbeing & Responsible Design': 'Inclusive Design',
  'Mobile Experience & Responsive Design': 'Inclusive Design',
  'Performance & Technical Health': 'Future Readiness',
  'AI Discoverability & LLM Readiness': 'Future Readiness',
  'AI Agent Readiness': 'Future Readiness',
  'Cultural Sensitivity & Global Readiness': 'Future Readiness',
}
