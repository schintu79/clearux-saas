import { SectionMarker } from './SectionMarker'

const chips = [
  { sev: 'high', label: 'Dark pattern scanner', mod: 'HX-04' },
  { sev: 'med', label: 'Cognitive load index', mod: 'HX-11' },
  { sev: 'high', label: 'Login friction map', mod: 'HX-18' },
  { sev: 'low', label: 'Heading hierarchy', mod: 'SEO-03' },
  { sev: 'med', label: 'WCAG contrast (AA)', mod: 'ID-02' },
  { sev: 'high', label: 'AI discoverability score', mod: 'FR-01' },
  { sev: 'med', label: 'Brand voice drift', mod: 'BC-07' },
  { sev: 'low', label: 'Trust signal audit', mod: 'F-09' },
  { sev: 'high', label: 'Conversion friction map', mod: 'HX-22' },
  { sev: 'med', label: 'Mobile tap target size', mod: 'ID-14' },
  { sev: 'high', label: 'Agent-readability test', mod: 'FR-06' },
  { sev: 'low', label: 'Structured data check', mod: 'SEO-08' },
  { sev: 'med', label: 'Form abandonment risk', mod: 'HX-13' },
  { sev: 'high', label: 'Privacy pattern review', mod: 'HX-19' },
  { sev: 'low', label: 'Footer link audit', mod: 'F-12' },
  { sev: 'med', label: 'Visual identity match', mod: 'BC-03' },
]

function dotColor(sev: string) {
  if (sev === 'high') return 'bg-severe'
  if (sev === 'med') return 'bg-warn'
  return 'bg-ok'
}

export function CheckpointTicker() {
  const allChips = [...chips, ...chips]

  return (
    <section className="py-[100px] border-b border-rule overflow-hidden">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <div className="mb-16 grid lg:grid-cols-[1fr_1.2fr] gap-20 items-end max-lg:grid-cols-1 max-lg:gap-6">
          <div>
            <SectionMarker number="03" label="The math" />
            <h2 className="font-serif font-normal text-ink leading-[0.98] tracking-[-0.022em]" style={{ fontSize: 'clamp(40px, 5vw, 72px)' }}>
              What ninety-six checkpoints <em className="italic text-signal">actually</em> measure.
            </h2>
          </div>
          <p className="text-[17px] text-ink-2 leading-[1.55] max-w-[540px] font-sans">
            A representative slice from the full checkpoint registry. Each one runs against your input, scored by severity and business impact.
          </p>
        </div>
      </div>

      {/* Ticker */}
      <div className="relative mx-[-32px] py-8 border-t border-b border-ink bg-paper-2 overflow-hidden">
        {/* Fade edges */}
        <div className="absolute top-0 bottom-0 left-0 w-[120px] z-[2] pointer-events-none" style={{ background: 'linear-gradient(to right, var(--paper-2), transparent)' }} />
        <div className="absolute top-0 bottom-0 right-0 w-[120px] z-[2] pointer-events-none" style={{ background: 'linear-gradient(to left, var(--paper-2), transparent)' }} />

        <div className="flex gap-4 w-max" style={{ animation: 'm-scroll-left 60s linear infinite' }}>
          {allChips.map((chip, i) => (
            <span key={`${chip.mod}-${i}`} className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-paper border border-rule-2 rounded-[2px] text-[13px] text-ink whitespace-nowrap font-sans">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotColor(chip.sev)}`} />
              {chip.label}
              <span className="font-mono text-[10px] text-m-muted tracking-[0.06em] uppercase">{chip.mod}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <div className="mt-7 flex justify-between items-center font-mono text-[11px] text-m-muted tracking-[0.06em] uppercase max-sm:flex-col max-sm:gap-3">
          <span>
            <span className="text-severe">&#9679;</span> Critical &nbsp;
            <span className="text-warn ml-4">&#9679;</span> Medium &nbsp;
            <span className="text-ok ml-4">&#9679;</span> Minor
          </span>
          <span>Full registry visible in every audit report</span>
        </div>
      </div>
    </section>
  )
}
