import { SectionMarker } from './SectionMarker'
import { Ruler, LayoutGrid, Eye, BarChart3 } from 'lucide-react'

/**
 * HomeSignals — Product principle.
 * "We don't grade taste. We measure signals."
 * Compact trust-building section after Find / Fix / Track.
 */

const SIGNALS = [
  {
    Icon: LayoutGrid,
    text: 'Structure over style trends',
  },
  {
    Icon: Eye,
    text: 'Clarity over personal taste',
  },
  {
    Icon: Ruler,
    text: 'Consistency over aesthetic preference',
  },
  {
    Icon: BarChart3,
    text: 'Observable signals, not vanity opinions',
  },
]

export function HomeSignals() {
  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <SectionMarker number="02" label="The principle" centered />

        <h2
          className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6 text-center"
          style={{ fontSize: 'clamp(36px, 7vw, 96px)' }}
        >
          We don{"'"}t grade taste.{' '}
          <em className="italic text-signal">We measure signals.</em>
        </h2>

        <p className="text-[18px] max-sm:text-[15px] leading-[1.6] text-ink-2 max-w-[560px] mx-auto mb-14 max-sm:mb-8 font-sans text-center">
          Design feedback is based on structural clarity, consistency, readability,
          and trust signals — not personal taste. First impressions are analyzed
          through what helps or hurts communication, not whether it looks trendy.
        </p>

        {/* 4 signal pills in a single row */}
        <div className="flex flex-wrap justify-center gap-3 max-w-[720px] mx-auto">
          {SIGNALS.map((s) => (
            <div
              key={s.text}
              className="flex items-center gap-2.5 px-5 py-3 max-sm:px-4 max-sm:py-2.5 rounded-full font-sans text-[13px] max-sm:text-[12px] font-medium"
              style={{
                color: 'var(--ink)',
                background: 'color-mix(in srgb, var(--ink) 3%, var(--paper))',
                border: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)',
              }}
            >
              <s.Icon size={15} strokeWidth={1.5} style={{ color: 'var(--signal)' }} />
              {s.text}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
