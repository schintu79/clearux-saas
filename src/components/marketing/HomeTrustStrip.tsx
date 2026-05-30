/**
 * HomeTrustStrip — a short visual strip below the hero to reduce
 * skepticism fast and communicate product maturity at a glance.
 */
export function HomeTrustStrip() {
  return (
    <section className="py-10 border-b border-rule" style={{ background: 'var(--paper-2)' }}>
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10">
          {[
            {
              label: 'Truth over hype',
              desc: 'We never invent issues. If your site is strong, we say so.',
            },
            {
              label: 'Built for real fixes',
              desc: 'Every finding includes a concrete action — not a vague suggestion.',
            },
            {
              label: 'Progress, not one-off reports',
              desc: 'Re-audit to confirm fixes landed and track improvement over time.',
            },
            {
              label: 'Clarity in under 10 minutes',
              desc: '112 checkpoints. Severity-ranked. Delivered fast enough to act on today.',
            },
          ].map((item) => (
            <div key={item.label}>
              <p className="font-sans text-[14px] font-semibold text-ink mb-1.5">{item.label}</p>
              <p className="font-sans text-[13px] text-ink-2 leading-[1.55]">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
