import { SectionMarker } from './SectionMarker'

/**
 * HomeIdentity — "What Fixpath is" section.
 * 5 visual cards for the core product identity, per the brief:
 * decision engine, prioritization system, fix guidance,
 * progress tracking, trust-building layer.
 */

const PILLARS = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="6" width="22" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 14h4m4 0h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M14 10v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'Decision engine',
    desc: 'Turns a complex website into a clear picture of what is working, what is broken, and what to do next.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7 20l4-4 4 3 6-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="4" y="4" width="20" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    title: 'Prioritization system',
    desc: 'Ranks every issue by severity and real impact so you fix the things that matter most — first.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 14h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M14 9v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="4" y="4" width="20" height="20" rx="10" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    title: 'Fix guidance',
    desc: 'Every finding comes with a concrete fix — code diffs, copy changes, or step-by-step recommendations your team can act on.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 21l4-6 4 3 4-5 4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 7v14h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Progress tracking',
    desc: 'Re-audit after changes to confirm fixes landed. Compare scores, see trends, and prove improvement over time.',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 6l2 4 4.5.5-3.25 3.5L18 19l-4-2.5L10 19l.75-5-3.25-3.5L12 10l2-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Trust-building layer',
    desc: 'Shows your team, your clients, or your stakeholders that the site is improving — with real data, not opinions.',
  },
]

export function HomeIdentity() {
  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <SectionMarker number="01" label="What Fixpath is" />
        <h2
          className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-5"
          style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
        >
          Not just an audit.{' '}
          <em className="italic text-signal">A complete system.</em>
        </h2>
        <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mb-14 font-sans">
          Fixpath is a decision engine for real website and brand issues. It finds what
          matters, tells you how to fix it, and tracks whether things improve.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-px rounded-[4px] overflow-hidden" style={{ background: 'var(--rule)' }}>
          {PILLARS.map((p) => (
            <div key={p.title} className="p-6 sm:p-7" style={{ background: 'var(--paper)' }}>
              <span className="text-signal mb-4 block">{p.icon}</span>
              <h3 className="font-sans text-[15px] font-semibold text-ink mb-2">{p.title}</h3>
              <p className="font-sans text-[13px] text-ink-2 leading-[1.6]">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
