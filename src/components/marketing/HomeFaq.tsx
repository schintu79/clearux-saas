'use client'

import { FaqPreview } from '@/components/marketing/FaqPreview'

const HOME_FAQS = [
  { q: 'How long does an audit take?', a: 'Most audits complete in under 10 minutes. Our AI crawls your website, analyses every page against 96 checkpoints across six modules, and generates a full professional report.' },
  { q: 'What does the audit cover?', a: 'We evaluate 24 categories across six modules: Foundation (the structural and technical baseline), Human Experience (how your product feels to use), Inclusive Design (accessibility and equity), Future Readiness (AI discoverability), Brand Consistency (whether what users see matches the brand), and SEO Structure (findability and rankings).' },
  { q: 'How does Fixpath compare to hiring a UX consultant?', a: "A traditional UX audit costs $5,000–15,000 and takes 2–4 weeks. Fixpath delivers 96 checkpoints across six modules in minutes for a fraction of the cost. It's ideal for quick, comprehensive baseline assessments." },
  { q: 'Does Fixpath replace a human UX auditor?', a: "No. Fixpath is designed to complement human expertise, not replace it. It covers 96 checkpoints across six modules in minutes — the kind of breadth that would take a consultant days. But for deep qualitative research, we recommend working with a specialist." },
  { q: 'Is Fixpath 100% accurate?', a: "No, and we believe honesty about this is important. Our AI catches issues that traditional tools miss — dark patterns, emotional design gaps, cognitive accessibility barriers, AI readiness gaps — but no automated system is perfect. We recommend human review for accessibility-critical and security-sensitive findings." },
]

export function HomeFaq() {
  return <FaqPreview sectionNumber="10" items={HOME_FAQS} />
}
