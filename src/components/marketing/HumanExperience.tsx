import { SectionMarker } from './SectionMarker'

const PILLARS = [
  {
    title: 'Cognitive load',
    desc: 'We measure how much mental effort your interface demands. Forms that exhaust, navigation that confuses, layouts that overwhelm — before users bounce.',
  },
  {
    title: 'Dark patterns',
    desc: 'Forced urgency, confirm-shaming, hidden costs. We flag manipulative design that erodes trust — not just GDPR violations, but the subtle ones users feel but can\'t name.',
  },
  {
    title: 'User wellbeing',
    desc: 'Checkout flows that create unnecessary anxiety. Error states that blame the user. Consent patterns that pressure. We audit how your product treats people under stress.',
  },
]

export function HumanExperience() {
  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-20 items-start max-lg:grid-cols-1 max-lg:gap-10">
          <div>
            <SectionMarker number="03" label="Human experience" />
            <h2
              className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.022em] mb-6"
              style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
            >
              We audit how it <em className="italic text-signal">feels,</em> not just how it works.
            </h2>
            <p className="text-[17px] text-ink-2 leading-[1.55] font-sans max-w-[480px]">
              Cognitive load, dark patterns, and user wellbeing are first-class checks — not edge cases. This is what separates a UX audit from a tech scan.
            </p>
          </div>

          <div className="space-y-0 border border-ink">
            {PILLARS.map((pillar, i) => (
              <div
                key={pillar.title}
                className={`p-7 sm:p-8 ${i < PILLARS.length - 1 ? 'border-b border-ink' : ''}`}
              >
                <h3 className="font-sans text-[17px] font-medium text-ink mb-2">{pillar.title}</h3>
                <p className="font-sans text-[14px] text-ink-2 leading-[1.6]">{pillar.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
