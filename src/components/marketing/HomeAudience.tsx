import { SectionMarker } from './SectionMarker'
import { Users, Briefcase, ArrowLeftRight, Shield, Globe, Blocks } from 'lucide-react'

const AUDIENCES = [
  {
    Icon: Users,
    title: 'Product and marketing teams',
    desc: 'Clear priorities, not another report to ignore.',
  },
  {
    Icon: Briefcase,
    title: 'Agencies and consultants',
    desc: 'Structured findings and fixes for client work.',
  },
  {
    Icon: ArrowLeftRight,
    title: 'Redesign and migration teams',
    desc: 'Catch trust, UX, and accessibility issues early.',
  },
  {
    Icon: Shield,
    title: 'Trust-focused brands',
    desc: 'Improve clarity, consistency, and real site quality.',
  },
  {
    Icon: Globe,
    title: 'Website owners and operators',
    desc: 'Fix issues directly without a large internal team.',
  },
  {
    Icon: Blocks,
    title: 'WordPress and CMS teams',
    desc: 'Turn findings into fixes inside the workflow you already use.',
  },
]

export function HomeAudience() {
  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <SectionMarker number="05" label="Who it is for" centered />
        <h2
          className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6 text-center"
          style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
        >
          Who Fixpath{' '}
          <em className="italic text-signal">is for.</em>
        </h2>
        <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mx-auto mb-16 font-sans text-center">
          Built for the people responsible for making websites better — and
          proving the work worked.
        </p>

        {/* 3×2 grid inside one container with internal dividers */}
        <div
          className="rounded-xl overflow-hidden max-w-[900px] mx-auto"
          style={{ border: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)' }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3">
            {AUDIENCES.map((a, i) => {
              const col = i % 3
              const isTopRow = i < 3
              return (
                <div
                  key={a.title}
                  className="flex flex-col items-center text-center px-6 py-10 max-sm:px-5 max-sm:py-8"
                  style={{
                    borderRight: col < 2 ? '1px solid color-mix(in srgb, var(--ink) 6%, transparent)' : 'none',
                    borderBottom: isTopRow ? '1px solid color-mix(in srgb, var(--ink) 6%, transparent)' : 'none',
                  }}
                >
                  <a.Icon
                    size={20}
                    strokeWidth={1.5}
                    style={{ color: 'var(--ink-2)' }}
                    className="mb-4"
                  />
                  <h3
                    className="font-sans text-[15px] font-semibold tracking-[-0.01em] mb-2"
                    style={{ color: 'var(--ink)' }}
                  >
                    {a.title}
                  </h3>
                  <p
                    className="font-sans text-[13px] leading-[1.55] max-w-[220px]"
                    style={{ color: 'var(--m-muted)' }}
                  >
                    {a.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Disclaimer label */}
        <div className="flex justify-center mt-8">
          <span
            className="inline-block font-sans text-[11px] tracking-[0.04em] px-4 py-2 rounded-full"
            style={{
              color: 'var(--ink-2)',
              border: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)',
              background: 'color-mix(in srgb, var(--ink) 2.5%, var(--paper))',
            }}
          >
            Not built for vanity dashboards or magic-button automation.
          </span>
        </div>
      </div>
    </section>
  )
}
