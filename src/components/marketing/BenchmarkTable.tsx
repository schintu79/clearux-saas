import { SectionMarker } from './SectionMarker'

const rows = [
  {
    label: 'Traditional agency',
    sub: 'UX consulting firm',
    cost: '$10-50k',
    turn: '2-6 weeks',
    ai: { text: 'No', cls: 'text-signal' },
    reaudit: { text: 'Re-quote', cls: 'text-signal' },
    depth: { text: 'High', cls: 'text-ok' },
    highlight: false,
  },
  {
    label: 'In-house senior',
    sub: 'Hire or pull from product',
    cost: '$120k+ / yr',
    turn: 'If they\'re free',
    ai: { text: 'Sometimes', cls: 'text-warn' },
    reaudit: { text: 'Capacity-bound', cls: 'text-warn' },
    depth: { text: 'High', cls: 'text-ok' },
    highlight: false,
  },
  {
    label: 'Lighthouse-style scanner',
    sub: 'Free perf tools',
    cost: 'Free',
    turn: 'Minutes',
    ai: { text: 'No', cls: 'text-signal' },
    reaudit: { text: 'Unlimited', cls: 'text-ok' },
    depth: { text: 'Surface only', cls: 'text-signal' },
    highlight: false,
  },
  {
    label: 'ClearUX',
    sub: '96 checkpoints · 6 modules',
    cost: 'From $9.90',
    turn: '< 10 minutes',
    ai: { text: 'Native', cls: 'text-ok' },
    reaudit: { text: 'Unlimited', cls: 'text-ok' },
    depth: { text: 'Senior-grade', cls: 'text-ok' },
    highlight: true,
  },
]

export function BenchmarkTable() {
  return (
    <section className="py-[100px] border-b border-rule" id="benchmark">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <div className="mb-16 grid lg:grid-cols-[1fr_1.2fr] gap-20 items-end max-lg:grid-cols-1 max-lg:gap-6">
          <div>
            <SectionMarker number="07" label="Compared" />
            <h2 className="font-serif font-normal text-ink leading-[0.98] tracking-[-0.022em]" style={{ fontSize: 'clamp(40px, 5vw, 72px)' }}>
              The market, on <em className="italic text-signal">one page</em>.
            </h2>
          </div>
          <p className="text-[17px] text-ink-2 leading-[1.55] max-w-[540px] font-sans">
            We&apos;re not the cheapest scanner. We&apos;re not the most expensive consultant. We&apos;re the only thing built for teams that ship.
          </p>
        </div>

        <div className="border border-ink overflow-x-auto">
          <table className="w-full border-collapse min-w-[700px]">
            <thead>
              <tr>
                {['', 'Cost', 'Turnaround', 'AI discoverability', 'Re-audits', 'Depth'].map((h) => (
                  <th key={h} className="bg-ink text-paper font-mono text-[10px] font-medium tracking-[0.1em] uppercase px-6 py-4 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={row.label} className={`${ri < rows.length - 1 ? 'border-b border-rule' : ''} hover:bg-paper-2 transition-colors`}>
                  <td className={`px-6 py-[22px] ${row.highlight ? 'bg-ink text-paper' : ''}`} style={{ width: 260 }}>
                    {row.highlight ? (
                      <>
                        <span className="font-serif text-[22px] font-normal tracking-[-0.01em] italic">{row.label}</span>
                        <small className="block font-sans text-[12px] mt-0.5" style={{ color: 'color-mix(in srgb, var(--paper) 60%, transparent)' }}>{row.sub}</small>
                      </>
                    ) : (
                      <>
                        <span className="font-serif text-[22px] font-normal tracking-[-0.01em] text-ink">{row.label}</span>
                        <small className="block font-sans text-[12px] text-m-muted mt-0.5">{row.sub}</small>
                      </>
                    )}
                  </td>
                  <td className={`px-6 py-[22px] text-[14px] text-ink-2 ${row.highlight ? 'bg-paper-2 font-medium text-ink' : ''}`}>{row.cost}</td>
                  <td className={`px-6 py-[22px] text-[14px] text-ink-2 ${row.highlight ? 'bg-paper-2 font-medium text-ink' : ''}`}>{row.turn}</td>
                  <td className={`px-6 py-[22px] text-[14px] font-mono text-[11px] tracking-[0.08em] uppercase ${row.ai.cls} ${row.highlight ? 'bg-paper-2 font-medium' : ''}`}>{row.ai.text}</td>
                  <td className={`px-6 py-[22px] text-[14px] font-mono text-[11px] tracking-[0.08em] uppercase ${row.reaudit.cls} ${row.highlight ? 'bg-paper-2 font-medium' : ''}`}>{row.reaudit.text}</td>
                  <td className={`px-6 py-[22px] text-[14px] font-mono text-[11px] tracking-[0.08em] uppercase ${row.depth.cls} ${row.highlight ? 'bg-paper-2 font-medium' : ''}`}>{row.depth.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
