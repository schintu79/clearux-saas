import { SectionMarker } from './SectionMarker'
import { Ruler, Sparkles, PaintBucket, Accessibility, Cpu, Search, Fingerprint } from 'lucide-react'

const CATEGORIES = [
  { Icon: Ruler, name: 'Foundation', count: 16 },
  { Icon: Sparkles, name: 'Human experience', count: 22 },
  { Icon: PaintBucket, name: 'Inclusive design', count: 18 },
  { Icon: Accessibility, name: 'Accessibility readiness', count: 16 },
  { Icon: Cpu, name: 'Future readiness', count: 14 },
  { Icon: Search, name: 'SEO structure', count: 12 },
  { Icon: Fingerprint, name: 'Design consistency', count: 14 },
]

export function HomeModules() {
  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <SectionMarker number="04" label="What we cover" centered />
        <h2
          className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6 text-center"
          style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
        >
          Seven categories.{' '}
          <em className="italic text-signal">One system.</em>
        </h2>
        <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mx-auto mb-14 font-sans text-center">
          Technical quality, user experience, and brand perception — 112
          checkpoints in a single run.
        </p>

        <div className="flex flex-wrap justify-center gap-3 max-w-[960px] mx-auto">
          {CATEGORIES.map((cat) => (
            <span
              key={cat.name}
              className="inline-flex items-center gap-2.5 font-sans text-[14px] font-medium tracking-[-0.01em] px-5 py-3 rounded-full"
              style={{
                color: 'var(--ink)',
                border: '1px solid var(--rule)',
                background: 'var(--paper)',
              }}
            >
              <cat.Icon size={16} strokeWidth={1.5} style={{ color: 'var(--ink-2)' }} />
              {cat.name}
              <span className="text-[12px] text-m-muted">{cat.count}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
