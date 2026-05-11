import { SectionMarker } from './SectionMarker'
import { Button } from './Button'
import { ArrowRightIcon } from './icons'
import { SpecimenCard } from './SpecimenCard'

export function Hero() {
  return (
    <section className="py-20 sm:py-[80px] border-b border-rule relative">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-20 items-start">
          <div>
            <SectionMarker number="00" label="The thesis" />
            <h1 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-9" style={{ fontSize: 'clamp(56px, 7.5vw, 108px)' }}>
              The audit your team <em className="italic text-signal">actually</em> ships from.
            </h1>
            <p className="text-[19px] leading-[1.55] text-ink-2 max-w-[520px] mb-10 font-sans">
              ClearUX runs <strong className="font-semibold text-ink">96 checkpoints across 6 modules</strong> on your website, brand, and design — and returns a report your team can act on. Severity-ranked. Evidence-backed. No agency, no consultant, no six-week waitlist.
            </p>
            <div className="flex gap-3.5 mb-14 max-sm:flex-col max-sm:items-stretch">
              <Button href="/register">
                Start free audit
                <ArrowRightIcon size={14} />
              </Button>
              <Button href="/demo-report" variant="ghost">See a real finding</Button>
            </div>
            <div className="grid grid-cols-3 gap-4 sm:gap-9 pt-7 border-t border-rule font-mono text-[11px] text-m-muted tracking-[0.06em] uppercase">
              <div>
                <strong className="block font-serif text-[28px] sm:text-[36px] text-ink font-normal tracking-[-0.02em] normal-case mb-0.5">96</strong>
                Checkpoints / audit
              </div>
              <div>
                <strong className="block font-serif text-[28px] sm:text-[36px] text-ink font-normal tracking-[-0.02em] normal-case mb-0.5">&lt;10</strong>
                Minutes to delivery
              </div>
              <div>
                <strong className="block font-serif text-[28px] sm:text-[36px] text-ink font-normal tracking-[-0.02em] normal-case mb-0.5">Free</strong>
                First audit, on us
              </div>
            </div>
          </div>
          <div>
            <SpecimenCard />
          </div>
        </div>
      </div>
    </section>
  )
}
