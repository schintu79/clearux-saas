import { SectionMarker } from './SectionMarker'
import { LayoutDashboard, BarChart3, Wrench, TrendingUp, Award } from 'lucide-react'

/**
 * HomeIdentity — "What Fixpath is" section.
 * 5 dashboard-style cards showing the core product identity.
 */

const PILLARS = [
  {
    Icon: LayoutDashboard,
    color: '#3B82F6',
    title: 'Decision engine',
    desc: 'Turns a complex website into a clear picture of what is working, what is broken, and what to do next.',
  },
  {
    Icon: BarChart3,
    color: '#8B5CF6',
    title: 'Prioritization system',
    desc: 'Ranks every issue by severity and real impact so you fix the things that matter most — first.',
  },
  {
    Icon: Wrench,
    color: '#10B981',
    title: 'Fix guidance',
    desc: 'Every finding comes with a concrete fix — code diffs, copy changes, or step-by-step recommendations your team can act on.',
  },
  {
    Icon: TrendingUp,
    color: '#F59E0B',
    title: 'Progress tracking',
    desc: 'Re-audit after changes to confirm fixes landed. Compare scores, see trends, and prove improvement over time.',
  },
  {
    Icon: Award,
    color: '#EC4899',
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
        <p className="text-[18px] max-sm:text-[15px] leading-[1.6] text-ink-2 max-w-[560px] mb-14 max-sm:mb-8 font-sans">
          Fixpath is a decision engine for real website and brand issues. It finds what
          matters, tells you how to fix it, and tracks whether things improve.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="rounded-xl p-6"
              style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
            >
              <span
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `color-mix(in srgb, ${p.color} 12%, transparent)`, color: p.color }}
              >
                <p.Icon size={20} strokeWidth={1.5} />
              </span>
              <h3 className="font-sans text-[15px] font-semibold text-ink mb-2">{p.title}</h3>
              <p className="font-sans text-[13px] text-ink-2 leading-[1.6]">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
