import { SectionMarker } from './SectionMarker'

/**
 * HomeDifferentiator — "Why we are different" section.
 * Highlights the audit-bible philosophy as a market differentiator:
 * real issues over noise, prioritization over checklists, fix guidance
 * over generic reports, progress over one-off audits, truth over hype.
 */

const CONTRASTS = [
  {
    theirs: 'Endless findings',
    ours: 'Real issues only',
    desc: 'We never pad the report. If something is not actually hurting your site, we do not flag it. Your team focuses on what matters.',
  },
  {
    theirs: 'Flat checklists',
    ours: 'Impact-ranked priorities',
    desc: 'Every finding is ranked by severity and real-world impact. Critical issues surface first. Low-noise items stay out of the way.',
  },
  {
    theirs: 'Generic advice',
    ours: 'Concrete fix guidance',
    desc: 'Fixpath generates the actual fix — code diffs, copy suggestions, deployment steps. Not a paragraph of vague recommendations.',
  },
  {
    theirs: 'One-off reports',
    ours: 'Progress tracking',
    desc: 'Re-audit after changes to confirm fixes landed. Compare scores over time. See which fixes had the biggest impact on your health score.',
  },
  {
    theirs: 'Inflated scores',
    ours: 'Honest truth',
    desc: 'We do not gamify scores to keep you engaged. If your site is strong, we say so. If it needs work, you will know exactly where.',
  },
]

export function HomeDifferentiator() {
  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <SectionMarker number="03" label="Why we are different" />
        <h2
          className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-5"
          style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
        >
          Built around truth,{' '}
          <em className="italic text-signal">not noise.</em>
        </h2>
        <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mb-14 font-sans">
          Most audit tools try to always find something. Fixpath is built around a different
          principle: only surface what is real, useful, and worth fixing.
        </p>

        <div className="space-y-0 border border-rule rounded-[4px] overflow-hidden">
          {CONTRASTS.map((c, i) => (
            <div
              key={c.ours}
              className={`grid sm:grid-cols-[160px_160px_1fr] gap-4 sm:gap-8 p-6 sm:p-7 items-start ${i < CONTRASTS.length - 1 ? 'border-b border-rule' : ''}`}
              style={{ background: 'var(--paper)' }}
            >
              <div>
                <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-m-muted block mb-1">Others</span>
                <span className="font-sans text-[14px] text-ink-2 line-through decoration-rule-2">{c.theirs}</span>
              </div>
              <div>
                <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-signal block mb-1">Fixpath</span>
                <span className="font-sans text-[14px] font-semibold text-ink">{c.ours}</span>
              </div>
              <p className="font-sans text-[14px] text-ink-2 leading-[1.6]">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
