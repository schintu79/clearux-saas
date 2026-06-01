import { SectionMarker } from './SectionMarker'
import { ListChecks, FileText, Wrench, RefreshCw } from 'lucide-react'

/**
 * HomeProof — "Inside Fixpath."
 * Horizontal 4-column row of separate cards.
 * Distinct from section 5's container pattern — feels like a workflow/system.
 * Tighter vertical spacing, more product-oriented.
 */

const PROOF_ITEMS = [
  {
    Icon: ListChecks,
    title: 'Severity-ranked findings',
    desc: 'Prioritized by impact so teams fix what matters first.',
  },
  {
    Icon: FileText,
    title: 'Evidence on every issue',
    desc: 'Every finding tied to real content on the site.',
  },
  {
    Icon: Wrench,
    title: 'Deploy-ready fixes',
    desc: 'Code diffs, copy changes, or actions ready to implement.',
  },
  {
    Icon: RefreshCw,
    title: 'Re-audit tracking',
    desc: 'Re-check changes. See what improved.',
  },
]

export function HomeProof() {
  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <SectionMarker number="07" label="What you get" centered />
        <h2
          className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6 text-center"
          style={{ fontSize: 'clamp(36px, 7vw, 96px)' }}
        >
          Inside{' '}
          <em className="italic text-signal">Fixpath.</em>
        </h2>
        <p className="text-[18px] max-sm:text-[15px] leading-[1.6] text-ink-2 max-w-[520px] mx-auto mb-14 max-sm:mb-8 font-sans text-center">
          Not just findings. A system to prioritize, fix, and track.
        </p>

        {/* Horizontal 4-column row */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PROOF_ITEMS.map((item) => (
            <div
              key={item.title}
              className="flex flex-col items-center text-center px-6 py-8 max-sm:px-5 max-sm:py-6 rounded-xl"
              style={{ border: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)' }}
            >
              <item.Icon
                size={20}
                strokeWidth={1.5}
                style={{ color: 'var(--ink-2)' }}
                className="mb-4"
              />
              <h3
                className="font-sans text-[14px] font-semibold tracking-[-0.01em] mb-2"
                style={{ color: 'var(--ink)' }}
              >
                {item.title}
              </h3>
              <p
                className="font-sans text-[13px] leading-[1.55]"
                style={{ color: 'var(--m-muted)' }}
              >
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
