'use client'

import { FaqPreview } from '@/components/marketing/FaqPreview'

const HOME_FAQS = [
  {
    q: 'What does Fixpath actually check?',
    a: 'Seven categories — Foundation, Human Experience, Inclusive Design, Accessibility Readiness, Future Readiness, SEO Structure, and Design Consistency. 112 checkpoints total, covering technical quality, usability, and visual system consistency in one run.',
  },
  {
    q: 'How is Fixpath different from a generic AI audit?',
    a: 'Most AI tools flatten everything into one opaque output. Fixpath combines direct checks, page evidence, and structured review — then separates verified findings from observed issues and heuristic interpretation. It shows confidence and coverage so teams know what to trust first.',
  },
  {
    q: 'Does Fixpath verify issues or just infer them?',
    a: 'Some issues are verified directly — like missing metadata or accessibility violations. Others are observed from real page evidence, such as layout inconsistencies or unclear messaging. Where human judgment is still needed, findings are marked as heuristic. The system makes that distinction visible on every finding.',
  },
  {
    q: 'Why does confidence matter in an audit?',
    a: 'Not every result carries the same certainty. Confidence and coverage help teams understand how much trust to place in a finding or score — so you fix verified problems first and apply judgment where it is still needed.',
  },
  {
    q: 'Does Fixpath generate fixes or just flag problems?',
    a: 'Both. For code-level issues, Fixpath generates minimal diffs you can preview, edit, and deploy. For strategic issues, you get clear guidance and next steps.',
  },
  {
    q: 'Can I re-audit after making changes?',
    a: 'Yes. Re-audits reconcile against previous findings so you can see what improved, what persists, and what regressed. Progress is tracked over time with clearer confidence as coverage deepens.',
  },
  {
    q: 'Is this only for large teams?',
    a: 'No. Fixpath works for solo operators, agencies, and teams of any size. Your first audit is free — no credit card required.',
  },
]

export function HomeFaq() {
  return <FaqPreview sectionNumber="07" items={HOME_FAQS} />
}
