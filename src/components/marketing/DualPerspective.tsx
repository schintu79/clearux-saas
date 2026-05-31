'use client'

import { SectionMarker } from './SectionMarker'
import { Button } from './Button'
import { ArrowRightIcon } from './icons'

const PILLARS = [
  {
    icon: (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--signal)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx={12} cy={12} r={10} /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    title: 'AI visibility',
    desc: 'We ask ChatGPT, Claude, and Gemini about your business — then check if their answers are correct. You see where AI gets you wrong.',
  },
  {
    icon: (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--signal)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx={9} cy={7} r={4} /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'Dual perspective',
    desc: 'Every issue comes with two views: how AI reads it and how a real user experiences it. Fix problems that affect both at the same time.',
  },
  {
    icon: (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--signal)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
      </svg>
    ),
    title: 'Beyond the checklist',
    desc: 'Other tools run automated checks. We measure cognitive load, detect dark patterns, and audit user wellbeing — the things that actually make people leave.',
  },
]

const COMPETITORS = [
  { name: 'Lighthouse', ai: false, human: false, wellbeing: false },
  { name: 'Hotjar', ai: false, human: true, wellbeing: false },
  { name: 'Baymard', ai: false, human: true, wellbeing: false },
  { name: 'Fixpath', ai: true, human: true, wellbeing: true },
]

export function DualPerspective() {
  return (
    <section className="py-[120px] border-b border-rule max-sm:py-[80px]">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        {/* Centered heading */}
        <div className="text-center mb-20 max-sm:mb-12">
          <SectionMarker number="01" label="The approach" centered />
          <h2
            className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.025em] mb-6 mx-auto"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)', maxWidth: 960 }}
          >
            Two lenses on every issue.{' '}
            <em className="italic text-signal">No blind spots.</em>
          </h2>
          <p
            className="text-[19px] leading-[1.55] text-ink-2 font-sans mx-auto"
            style={{ maxWidth: 640 }}
          >
            Most tools check one side — performance for search engines, or heatmaps for users. Fixpath checks both AI and human experience together, so nothing slips through.
          </p>
        </div>

        {/* Three pillars */}
        <div className="grid md:grid-cols-3 gap-0 border border-rule rounded-xl overflow-hidden mb-16 max-sm:mb-10">
          {PILLARS.map((p, i) => (
            <div
              key={p.title}
              className="p-8 max-sm:p-6 flex flex-col"
              style={{ borderRight: i < 2 ? '1px solid var(--rule)' : 'none' }}
            >
              <div className="mb-5">{p.icon}</div>
              <h3 className="font-sans text-[17px] font-semibold text-ink mb-2.5 leading-snug">
                {p.title}
              </h3>
              <p className="font-sans text-[14px] leading-[1.6] text-ink-2">
                {p.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Comparison mini-table */}
        <div className="mx-auto" style={{ maxWidth: 680 }}>
          <div className="rounded-xl border border-rule overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-4 px-6 py-3.5 max-sm:px-4" style={{ borderBottom: '1px solid var(--rule)' }}>
              <span className="font-mono text-[10px] tracking-[0.08em] uppercase font-semibold text-m-muted" />
              <span className="font-mono text-[10px] tracking-[0.08em] uppercase font-semibold text-m-muted text-center">AI visibility</span>
              <span className="font-mono text-[10px] tracking-[0.08em] uppercase font-semibold text-m-muted text-center">Human UX</span>
              <span className="font-mono text-[10px] tracking-[0.08em] uppercase font-semibold text-m-muted text-center">Wellbeing</span>
            </div>
            {/* Rows */}
            {COMPETITORS.map((c, i) => {
              const isClearux = c.name === 'Fixpath'
              return (
                <div
                  key={c.name}
                  className="grid grid-cols-4 px-6 py-3 max-sm:px-4 items-center"
                  style={{
                    borderBottom: i < COMPETITORS.length - 1 ? '1px solid var(--rule)' : 'none',
                    background: isClearux ? 'var(--signal-bg, rgba(191,250,96,0.08))' : 'transparent',
                  }}
                >
                  <span className={`font-sans text-[14px] ${isClearux ? 'font-semibold text-ink' : 'text-ink-2'}`}>
                    {c.name}
                  </span>
                  {[c.ai, c.human, c.wellbeing].map((v, j) => (
                    <span key={j} className="flex justify-center">
                      {v ? (
                        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--ok, #22c55e)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" />
                        </svg>
                      ) : (
                        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--rule-2, #ccc)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                          <line x1={5} y1={12} x2={19} y2={12} />
                        </svg>
                      )}
                    </span>
                  ))}
                </div>
              )
            })}
          </div>

          {/* CTA */}
          <div className="flex justify-center mt-10">
            <Button href="/product" variant="ghost">
              See the product
              <ArrowRightIcon size={13} />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
