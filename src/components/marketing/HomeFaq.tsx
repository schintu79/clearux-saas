'use client'

import { FaqPreview } from '@/components/marketing/FaqPreview'

const HOME_FAQS = [
  { q: 'How long does an audit take?', a: 'Most audits complete in under 10 minutes. Fixpath crawls your website, analyses every page against 96 checkpoints across six modules, and delivers a severity-ranked report with evidence and fixes.' },
  { q: 'What happens after the audit?', a: 'Every finding comes with a concrete fix path. You can apply code changes directly through Fixpath, deploy fixes via FTP, or export a clear recommendation your team can act on. Re-audit anytime to track improvement.' },
  { q: 'What does the audit cover?', a: 'Six modules with 16 checkpoints each: Foundation (structural baseline), Human Experience (usability and design), Inclusive Design (accessibility and WCAG compliance), Future Readiness (AI visibility), Brand Consistency (identity alignment), and SEO Structure (findability).' },
  { q: 'How does Fixpath compare to hiring a UX consultant?', a: "A traditional UX audit costs $5,000-15,000 and takes 2-4 weeks. Fixpath delivers 96 checkpoints in minutes for a fraction of the cost, with the ability to fix issues directly and track improvement over time." },
  { q: 'Is the first audit really free?', a: "Yes. Your first audit includes all 96 checkpoints, all six modules, full PDF and Word exports, and a shareable link. No credit card required, no expiration." },
]

export function HomeFaq() {
  return <FaqPreview sectionNumber="10" items={HOME_FAQS} />
}
