'use client'

import { SectionMarker } from '@/components/marketing/SectionMarker'
import { Button } from '@/components/marketing/Button'
import { ArrowRightIcon } from '@/components/marketing/icons'

const MODULES = [
  { num: '01', title: 'Foundation', desc: 'Visual design, messaging, navigation, content quality. The structural baseline a great experience is built on.', count: 16, range: 'F-01 → F-16' },
  { num: '02', title: 'Human Experience', desc: 'Clarity, cognitive load, dark patterns, conversion friction. Whether your UX respects users in stressed or impaired states.', count: 22, range: 'HX-01 → HX-22' },
  { num: '03', title: 'Inclusive Design', desc: 'WCAG compliance, cognitive accessibility, mobile context, equity across abilities. Every user, every context.', count: 18, range: 'ID-01 → ID-18' },
  { num: '04', title: 'Future Readiness', desc: 'How LLMs and AI agents read your product. Performance, agent readiness, internationalisation. The discovery layer of the next decade.', count: 14, range: 'FR-01 → FR-14' },
  { num: '05', title: 'Brand Consistency', desc: 'Voice, visual identity, tone alignment. Whether what users see matches what your brand promises — surface to surface.', count: 14, range: 'BC-01 → BC-14' },
  { num: '06', title: 'SEO Structure', desc: 'Heading hierarchy, meta tags, structured data, crawlability. Whether your product is findable, legible, and ranked the way it deserves.', count: 12, range: 'SEO-01 → SEO-12' },
]

const STEPS = [
  { num: '01', title: 'Choose your audit', desc: 'Paste a website URL, upload brand identity files (PDF, DOCX, images), or submit a design. ClearUX handles all three.' },
  { num: '02', title: 'We run 96 checkpoints', desc: 'Every input analysed across six modules and 24 categories. Every score is evidence-based — no subjective hand-waving.' },
  { num: '03', title: 'You decide what to fix', desc: 'Every issue ranked and explained. Export as PDF or Word, share with a link. We identify. You decide.' },
]

export default function HowItWorksContent() {
  return (
    <main>
      {/* Hero */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="01" label="How it works" />
          <h1 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-8" style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}>
            Audit your product. Get <em className="italic text-signal">360° clarity.</em>
          </h1>
          <p className="text-[19px] leading-[1.55] text-ink-2 max-w-[640px] font-sans">
            ClearUX audits your website, brand identity, and design across 96 checkpoints in 6 modules. Prioritised findings with evidence, severity rankings, and specific fixes. Professional-grade depth in minutes.
          </p>
        </div>
      </section>

      {/* Three-step process */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="02" label="The process" />
          <h2 className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.02em] mb-14" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
            Three steps to <em className="italic text-signal">clarity.</em>
          </h2>

          <div className="grid md:grid-cols-3 gap-0 border border-ink">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className={`p-8 ${i < STEPS.length - 1 ? 'md:border-r border-ink max-md:border-b' : ''}`}
              >
                <span className="font-serif text-[56px] text-m-muted-2 font-normal leading-none block mb-5" style={{ color: 'color-mix(in srgb, var(--ink) 12%, transparent)' }}>
                  {step.num}
                </span>
                <h3 className="font-sans text-[17px] font-medium text-ink mb-3">{step.title}</h3>
                <p className="font-sans text-[15px] text-ink-2 leading-[1.6]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Six modules — matches homepage InstrumentGrid */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
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

          <div className="grid grid-cols-3 border-t border-l border-ink max-md:grid-cols-2 max-sm:grid-cols-1">
            {MODULES.map((mod) => (
              <div
                key={mod.num}
                className="border-r border-b border-ink p-7 sm:p-8 bg-paper hover:bg-paper-2 transition-colors min-h-[280px] flex flex-col"
              >
                <div className="font-mono text-[11px] text-signal font-semibold tracking-[0.08em] mb-3.5">
                  {mod.num} / {mod.title}
                </div>
                <h3 className="font-serif font-normal text-[30px] tracking-[-0.015em] leading-[1.05] mb-3.5 text-ink">
                  {mod.title}
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
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden" style={{ background: 'var(--ink)', color: 'var(--paper)', padding: '100px 0' }}>
        <div className="absolute pointer-events-none" style={{ top: -100, right: -100, width: 400, height: 400, background: 'radial-gradient(circle, var(--signal) 0%, transparent 65%)', opacity: 0.18 }} />
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5 relative text-center">
          <h2 className="font-serif font-normal leading-[0.95] tracking-[-0.025em] mb-6" style={{ fontSize: 'clamp(40px, 5.5vw, 72px)', color: 'var(--paper)' }}>
            Start your audit <em className="italic text-signal">today</em>
          </h2>
          <p className="text-[18px] leading-[1.55] mb-10 font-sans max-w-[480px] mx-auto" style={{ color: 'color-mix(in srgb, var(--paper) 75%, transparent)' }}>
            Your first audit is free. No credit card, no commitment. Actionable UX insights in minutes.
          </p>
          <a
            href="/register"
            className="coda-cta inline-flex items-center gap-2 font-sans font-medium text-[15px] rounded-full px-8 py-4 transition-all"
          >
            Start free audit
            <ArrowRightIcon size={14} />
          </a>
        </div>
      </section>
    </main>
  )
}
