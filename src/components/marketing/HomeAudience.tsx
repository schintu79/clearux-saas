import { SectionMarker } from './SectionMarker'

/**
 * HomeAudience — "Who Fixpath is for / not for" section.
 * Clean two-column layout to sharpen positioning and build trust.
 */

const FOR_ITEMS = [
  'Teams that want clarity and action — not another PDF to ignore',
  'Brands that care about trust, accessibility, and consistency',
  'Operators who want real fixes they can deploy, not vague suggestions',
  'Agencies that need structured, shareable audit reports for clients',
  'Companies preparing redesigns, migrations, or rebrand projects',
]

const NOT_FOR_ITEMS = [
  'People looking for vanity dashboards with inflated scores',
  'Teams that want endless SEO checklist noise without prioritization',
  'Anyone expecting a magic button that fixes everything automatically',
  'Organizations that need only a generic compliance certificate',
]

export function HomeAudience() {
  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <SectionMarker number="05" label="Who it is for" />
        <h2
          className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-14"
          style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
        >
          Built for teams that{' '}
          <em className="italic text-signal">ship real improvements.</em>
        </h2>

        <div className="grid md:grid-cols-2 gap-0 border border-rule rounded-[4px] overflow-hidden">
          {/* For */}
          <div className="p-8 sm:p-10 md:border-r border-rule max-md:border-b" style={{ background: 'var(--paper)' }}>
            <p className="font-mono text-[11px] tracking-[0.12em] uppercase text-signal mb-6 font-medium">
              Fixpath is for
            </p>
            <div className="space-y-4">
              {FOR_ITEMS.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full shrink-0 mt-0.5 inline-flex items-center justify-center" style={{ background: 'var(--signal-soft)' }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 6l2 2 4-4" stroke="var(--signal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <span className="font-sans text-[14px] text-ink leading-[1.55]">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Not for */}
          <div className="p-8 sm:p-10" style={{ background: 'var(--paper)' }}>
            <p className="font-mono text-[11px] tracking-[0.12em] uppercase text-m-muted mb-6 font-medium">
              Not the best fit for
            </p>
            <div className="space-y-4">
              {NOT_FOR_ITEMS.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full shrink-0 mt-0.5 inline-flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--m-muted) 15%, transparent)' }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="var(--m-muted)" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </span>
                  <span className="font-sans text-[14px] text-ink-2 leading-[1.55]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
