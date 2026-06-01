'use client'

import { FaqPreview } from '@/components/marketing/FaqPreview'

const HOME_FAQS = [
  {
    q: 'What does Fixpath actually check?',
    a: 'Seven categories — Foundation, Human Experience, Inclusive Design, Accessibility Readiness, Future Readiness, SEO Structure, and Design Consistency. 112 checkpoints total, covering technical quality, usability, and visual system consistency in one run.',
  },
  {
    q: 'How is this different from a standard SEO or accessibility tool?',
    a: 'Most tools check one dimension. Fixpath checks seven, ranks findings by severity with evidence, and gives you deployable fixes — not just a list of recommendations.',
  },
  {
    q: 'Does Fixpath generate fixes or just flag problems?',
    a: 'Both. For code-level issues, Fixpath generates minimal diffs you can preview, edit, and deploy. For strategic issues, you get clear guidance and next steps.',
  },
  {
    q: 'Can I re-audit after making changes?',
    a: 'Yes. Re-audits reconcile against previous findings so you can see what improved, what persists, and what regressed. Progress is tracked over time.',
  },
  {
    q: 'Is this only for large teams?',
    a: 'No. Fixpath works for solo operators, agencies, and teams of any size. Your first audit is free — no credit card required.',
  },
]

export function HomeFaq() {
  return <FaqPreview sectionNumber="07" items={HOME_FAQS} />
}
