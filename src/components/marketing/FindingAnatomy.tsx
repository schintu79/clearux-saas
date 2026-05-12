import { SectionMarker } from './SectionMarker'

const callouts = [
  { num: '01', title: 'Severity, ranked.', desc: 'Critical, medium, or minor — calibrated to business impact, not severity-theatre.' },
  { num: '02', title: 'Evidence, not opinion.', desc: 'The exact element, the exact pattern, the exact reason it fails.' },
  { num: '03', title: 'The fix, shippable.', desc: 'Copy-paste ready. No "consider refactoring." Concrete and specific.' },
]

export function FindingAnatomy() {
  return (
    <section className="py-[100px] border-b border-rule" id="anatomy">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <div className="grid lg:grid-cols-[1fr_1.3fr] gap-16 items-start max-lg:grid-cols-1">
          {/* Left */}
          <div>
            <SectionMarker number="06" label="Anatomy of a finding" />
            <h2 className="font-serif font-normal text-ink leading-[1.02] tracking-[-0.022em] mb-6" style={{ fontSize: 'clamp(40px, 4.5vw, 64px)' }}>
              What a <em className="italic text-signal">real</em> finding looks like.
            </h2>
            <p className="text-[17px] leading-[1.55] text-ink-2 mb-7 font-sans">
              Every checkpoint in a ClearUX report follows the same anatomy. Severity. Evidence. Business impact. A specific fix your engineer or designer can ship on Monday. This is what closes the loop between &ldquo;audit&rdquo; and &ldquo;outcome.&rdquo;
            </p>

            <ul className="list-none mt-9">
              {callouts.map((c) => (
                <li key={c.num} className="flex gap-3.5 py-3.5 border-t border-rule text-[14px] items-baseline last:border-b">
                  <span className="font-mono text-[11px] text-signal font-semibold min-w-[32px]">{c.num}</span>
                  <div>
                    <strong className="block font-semibold mb-0.5 text-ink">{c.title}</strong>
                    <span className="text-m-muted text-[13px]">{c.desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Right — finding card */}
          <div className="bg-paper border border-ink rounded-[2px] overflow-hidden" style={{ boxShadow: '8px 8px 0 var(--shadow-offset)' }}>
            {/* Head */}
            <div className="bg-ink text-paper px-7 py-5 flex justify-between items-center">
              <span className="font-mono text-[11px] tracking-[0.1em] uppercase" style={{ color: 'color-mix(in srgb, var(--paper) 55%, transparent)' }}>
                Finding · HX-04 · Audit #4827
              </span>
              <span className="bg-signal text-white font-mono text-[10px] font-semibold tracking-[0.12em] uppercase px-2.5 py-[5px] rounded-[2px]">
                Critical
              </span>
            </div>

            {/* Body */}
            <div className="px-7 py-8">
              <h3 className="font-serif font-normal text-[32px] tracking-[-0.02em] leading-[1.1] mb-2 text-ink">
                Subscription flow uses pre-checked consent box for marketing emails.
              </h3>
              <div className="font-mono text-[11px] text-m-muted tracking-[0.06em] uppercase mb-6 pb-5 border-b border-dashed border-rule-2">
                Module: Human Experience · Pattern: Confirmshaming + opt-out trap · Page: /checkout
              </div>

              {/* What we observed */}
              <div className="mb-[22px]">
                <div className="font-mono text-[10px] text-signal font-semibold tracking-[0.12em] uppercase mb-2">What we observed</div>
                <p className="text-[14.5px] leading-[1.55] text-ink-2 font-sans">
                  The checkout form&apos;s marketing-consent checkbox is checked by default. Below it, the opt-out copy reads &ldquo;No thanks, I prefer to miss exclusive offers.&rdquo; This combination triggers two recognised dark patterns simultaneously: pre-selection (GDPR Article 7) and confirmshaming.
                </p>
              </div>

              {/* Business impact */}
              <div className="mb-[22px]">
                <div className="font-mono text-[10px] text-signal font-semibold tracking-[0.12em] uppercase mb-2">Business impact</div>
                <p className="text-[14.5px] leading-[1.55] text-ink-2 font-sans">
                  Beyond regulatory exposure (estimated &euro;4k&ndash;&euro;20k per violation under GDPR), trust drops measurably post-checkout. ClearUX models a 6&ndash;11% lift in repeat purchase when consent patterns are clean.
                </p>
              </div>

              {/* The fix */}
              <div>
                <div className="font-mono text-[10px] text-signal font-semibold tracking-[0.12em] uppercase mb-2">The fix</div>
                <p className="text-[14.5px] leading-[1.55] text-ink-2 font-sans">Uncheck by default, rewrite copy in neutral voice:</p>
                <code className="block font-mono text-[12.5px] bg-paper-2 border border-rule px-3.5 py-3 mt-2 text-ink leading-[1.6] whitespace-pre-wrap">
{`<label>
  <input type="checkbox" name="marketing">
  Send me occasional updates and offers.
</label>`}
                </code>
              </div>
            </div>

            {/* Foot */}
            <div className="bg-paper-2 px-7 py-4 border-t border-rule flex justify-between font-mono text-[11px] text-m-muted tracking-[0.06em] uppercase">
              <span>Est. fix time: <strong className="text-ok">12 min</strong></span>
              <span>Confidence: <strong className="text-ok">97%</strong></span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
