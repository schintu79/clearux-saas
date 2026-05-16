import { SectionMarker } from './SectionMarker'

const oldWay = [
  '$30k engagement',
  '6 weeks lead time',
  'One-off, never re-run',
  'Built for stakeholders',
]

const clearuxWay = [
  '$0 first audit',
  '<10 minutes',
  'Re-run after every release',
  'Built for the team that ships',
]

export function Problem() {
  return (
    <section className="py-[120px] border-b border-rule">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <div className="grid lg:grid-cols-[1fr_1.5fr] gap-24 items-start max-lg:grid-cols-1 max-lg:gap-12">
          <div>
            <SectionMarker number="02" label="The problem" />
            <h2 className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.022em]" style={{ fontSize: 'clamp(48px, 6.8vw, 96px)' }}>
              UX audits were built for a slower{' '}
              <em className="italic text-signal block">internet.</em>
            </h2>
          </div>
          <div>
            <p className="text-[19px] leading-[1.55] text-ink-2 mb-7 font-sans">
              Your product ships weekly, lives across screens, and is read by humans and language models alike. Quality has to be continuous to be credible.
            </p>

            {/* Pull quote */}
            <div className="border-l-2 border-signal pl-6 py-1.5 my-11 font-serif italic text-[26px] leading-[1.32] text-ink">
              Clarity. Rigour. Speed.
            </div>

            <p className="font-sans font-semibold text-ink mt-9 mb-0 text-[19px] leading-[1.55]">
              Fixpath is built to improve the human experience. Paste a URL. Get a senior-rigor report in minutes.
            </p>

            {/* Comparison columns */}
            <div className="grid sm:grid-cols-2 gap-14 mt-20 pt-9 border-t border-rule max-sm:grid-cols-1 max-sm:gap-8 max-sm:mt-14">
              {/* Old way */}
              <div>
                <h4 className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-m-muted mb-5">
                  <span className="text-signal font-semibold mr-2.5">&mdash;</span>The old way
                </h4>
                <ul className="list-none">
                  {oldWay.map((item) => (
                    <li key={item} className="grid grid-cols-[20px_1fr] gap-3 py-3.5 border-b border-rule text-[15px] leading-[1.45] text-m-muted line-through" style={{ textDecorationColor: 'var(--rule-2)' }}>
                      <span className="text-signal font-mono text-[13px] leading-none">*</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* ClearUX way */}
              <div>
                <h4 className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-m-muted mb-5">
                  <span className="text-signal font-semibold mr-2.5">+</span>The Fixpath way
                </h4>
                <ul className="list-none">
                  {clearuxWay.map((item) => (
                    <li key={item} className="grid grid-cols-[20px_1fr] gap-3 py-3.5 border-b border-rule text-[15px] leading-[1.45] text-ink-2 items-baseline">
                      <span className="text-signal font-mono text-[13px] leading-none">&#10003;</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
