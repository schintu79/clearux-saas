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
  // SEO Structure & Rules
  'On-Page SEO Fundamentals': ['Title tags & meta descriptions', 'Heading hierarchy (H1-H6)', 'URL structure & slugs', 'Image alt text & optimisation'],
  'Technical SEO & Crawlability': ['Robots.txt & sitemap.xml', 'Canonical URLs', 'Page speed & Core Web Vitals', 'Mobile-first indexing'],
  'Structured Data & Rich Results': ['Schema.org markup', 'JSON-LD implementation', 'Rich snippet eligibility', 'Knowledge graph signals'],
  'SEO Content & Link Strategy': ['Keyword targeting & density', 'Internal link architecture', 'Content depth & authority', 'External link profile'],
  // Brand Consistency
  'Visual Identity Alignment': ['Logo usage & placement', 'Colour palette adherence', 'Typography consistency', 'Imagery & iconography style'],
  'Voice & Tone Alignment': ['Brand voice consistency', 'Tone-to-audience fit', 'Messaging hierarchy', 'Copy style guide adherence'],
  'Messaging & Value Prop Alignment': ['Core value proposition clarity', 'Tagline & headline alignment', 'Feature-benefit framing', 'Competitive differentiation'],
  'Brand Standards Compliance': ['Brand guideline adherence', 'Cross-page consistency', 'Template & layout standards', 'Legal & trademark compliance'],
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
  'On-Page SEO Fundamentals': 'SEO Structure & Rules',
  'Technical SEO & Crawlability': 'SEO Structure & Rules',
  'Structured Data & Rich Results': 'SEO Structure & Rules',
  'SEO Content & Link Strategy': 'SEO Structure & Rules',
  'Visual Identity Alignment': 'Brand Consistency',
  'Voice & Tone Alignment': 'Brand Consistency',
  'Messaging & Value Prop Alignment': 'Brand Consistency',
  'Brand Standards Compliance': 'Brand Consistency',
}
