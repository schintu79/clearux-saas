import { ShieldCheck, Wrench, TrendingUp, Zap } from 'lucide-react'

/**
 * HomeTrustStrip — visual strip below the hero with dashboard-style cards.
 * Big icons + short headings to communicate product maturity at a glance.
 */

const TRUST_ITEMS = [
  {
    Icon: ShieldCheck,
    color: '#10B981',
    label: 'Truth over hype',
    desc: 'We never invent issues. If your site is strong, we say so.',
  },
  {
    Icon: Wrench,
    color: '#3B82F6',
    label: 'Built for real fixes',
    desc: 'Every finding includes a concrete action — not a vague suggestion.',
  },
  {
    Icon: TrendingUp,
    color: '#8B5CF6',
    label: 'Progress, not one-off reports',
    desc: 'Re-audit to confirm fixes landed and track improvement over time.',
  },
  {
    Icon: Zap,
    color: '#F59E0B',
    label: 'Clarity in under 10 minutes',
    desc: '112 checkpoints. Severity-ranked. Delivered fast enough to act on today.',
  },
]

export function HomeTrustStrip() {
  return (
    <section className="py-12 border-b border-rule" style={{ background: 'var(--paper-2)' }}>
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TRUST_ITEMS.map((item) => (
            <div
              key={item.label}
              className="rounded-xl p-5 flex flex-col gap-3"
              style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
            >
              <span
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `color-mix(in srgb, ${item.color} 12%, transparent)`, color: item.color }}
              >
                <item.Icon size={20} strokeWidth={1.5} />
              </span>
              <div>
                <p className="font-sans text-[15px] font-semibold text-ink mb-1">{item.label}</p>
                <p className="font-sans text-[13px] text-ink-2 leading-[1.55]">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
