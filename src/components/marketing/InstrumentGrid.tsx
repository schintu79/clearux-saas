import { SectionMarker } from './SectionMarker'
import { Button } from './Button'
import { ArrowRightIcon } from './icons'

const modules = [
  { num: '01', name: 'Foundation', desc: 'Visual design, messaging, navigation, content quality. The structural baseline a great experience is built on.', count: 16, range: 'F-01 → F-16' },
  { num: '02', name: 'Human Experience', desc: 'Clarity, cognitive load, dark patterns, conversion friction. Whether your UX respects users in stressed or impaired states.', count: 22, range: 'HX-01 → HX-22' },
  { num: '03', name: 'Inclusive Design', desc: 'WCAG compliance, cognitive accessibility, mobile context, equity across abilities. Every user, every context.', count: 18, range: 'ID-01 → ID-18' },
  { num: '04', name: 'Future Readiness', desc: 'How LLMs and AI agents read your product. Performance, agent readiness, internationalisation. The discovery layer of the next decade.', count: 14, range: 'FR-01 → FR-14' },
  { num: '05', name: 'Brand Consistency', desc: 'Voice, visual identity, tone alignment. Whether what users see matches what your brand promises — surface to surface.', count: 14, range: 'BC-01 → BC-14' },
  { num: '06', name: 'SEO Structure', desc: 'Heading hierarchy, meta tags, structured data, crawlability. Whether your product is findable, legible, and ranked the way it deserves.', count: 12, range: 'SEO-01 → SEO-12' },
]

export function InstrumentGrid() {
  return (
    <section className="py-[100px] border-b border-rule" id="instrument">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        {/* Section head */}
        <div className="mb-16 grid lg:grid-cols-[1fr_1.2fr] gap-20 items-end max-lg:grid-cols-1 max-lg:gap-6">
          <div>
            <SectionMarker number="03" label="The instrument" />
            <h2 className="font-serif font-normal text-ink leading-[0.98] tracking-[-0.022em]" style={{ fontSize: 'clamp(40px, 5vw, 72px)' }}>
              Six modules. <em className="italic text-signal">Ninety-six</em> checkpoints.
            </h2>
          </div>
          <p className="text-[17px] text-ink-2 leading-[1.55] max-w-[540px] font-sans">
            Each audit runs the full battery. No tiered plans, no &ldquo;upgrade to unlock accessibility.&rdquo; Foundation through SEO Structure — same depth, every time, every input.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-3 border-t border-l border-ink max-md:grid-cols-2 max-sm:grid-cols-1">
          {modules.map((mod) => (
            <div
              key={mod.num}
              className="border-r border-b border-ink p-7 sm:p-8 bg-paper hover:bg-paper-2 transition-colors min-h-[280px] flex flex-col"
            >
              <div className="font-mono text-[11px] text-signal font-semibold tracking-[0.08em] mb-3.5">
                {mod.num} / {mod.name}
              </div>
              <h3 className="font-serif font-normal text-[30px] tracking-[-0.015em] leading-[1.05] mb-3.5 text-ink">
                {mod.name}
              </h3>
              <p className="text-[14px] leading-[1.55] text-ink-2 mb-auto pb-6 font-sans">
                {mod.desc}
              </p>
              <div className="flex justify-between items-baseline pt-[18px] border-t border-dashed border-rule-2 font-mono text-[10px] text-m-muted tracking-[0.06em] uppercase">
                <span>
                  <strong className="font-serif text-[28px] font-normal text-ink normal-case tracking-[-0.02em]">{mod.count}</strong>{' '}
                  checkpoints
                </span>
                <span>{mod.range}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Demo report link */}
        <div className="mt-10 flex items-center justify-between border border-dashed border-rule p-6 sm:p-8">
          <p className="text-[15px] text-ink-2 font-sans max-w-[480px]">
            See how these modules translate into a real report — scores, findings, and actionable recommendations.
          </p>
          <Button href="/demo-report" variant="ghost" className="shrink-0 ml-6">
            See sample reports
            <ArrowRightIcon size={13} />
          </Button>
        </div>
      </div>
    </section>
  )
}
