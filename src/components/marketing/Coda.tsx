import { SectionMarker } from './SectionMarker'
import { Button } from './Button'
import { ArrowRightIcon } from './icons'

export function Coda() {
  return (
    <section className="relative overflow-hidden" style={{ background: 'var(--ink)', color: 'var(--paper)', padding: '120px 0' }}>
      {/* Olive glow */}
      <div className="absolute pointer-events-none" style={{ top: -100, right: -100, width: 400, height: 400, background: 'radial-gradient(circle, var(--signal) 0%, transparent 65%)', opacity: 0.18 }} />

      <div className="max-w-mkt mx-auto px-8 max-sm:px-5 relative">
        <div className="grid lg:grid-cols-2 gap-20 items-end max-lg:grid-cols-1 max-lg:gap-12">
          <div>
            <SectionMarker number="07" label="Coda" dark />
            <h2 className="font-serif font-normal leading-[0.95] tracking-[-0.025em]" style={{ fontSize: 'clamp(50px, 6.5vw, 96px)', color: 'var(--paper)' }}>
              Run the audit. <em className="italic text-signal">Move the score.</em>
            </h2>
          </div>
          <div>
            <p className="text-[18px] leading-[1.55] mb-11 font-sans" style={{ color: 'color-mix(in srgb, var(--paper) 78%, transparent)' }}>
              The first one is free, no expiration, no credit card. By the time your stand-up ends tomorrow, you&apos;ll have 96 checkpoints, ranked findings, and a sprint&apos;s worth of work that actually moves the score.
            </p>
            <a
              href="/register"
              className="coda-cta inline-flex items-center gap-2 font-sans font-medium text-[15px] rounded-full px-8 py-4 transition-all"
            >
              Start free audit
              <ArrowRightIcon size={14} />
            </a>
          </div>
        </div>

        <div className="mt-20 pt-8 flex justify-between font-mono text-[11px] tracking-[0.08em] uppercase" style={{ borderTop: '1px solid color-mix(in srgb, var(--paper) 12%, transparent)', color: 'color-mix(in srgb, var(--paper) 45%, transparent)' }}>
          <span>End of edition · 96 / 6 / 99</span>
          <span>Audits delivered in minutes</span>
        </div>
      </div>
    </section>
  )
}
