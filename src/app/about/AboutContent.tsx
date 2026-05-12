'use client'

import Image from 'next/image'
import { SectionMarker } from '@/components/marketing/SectionMarker'
import { Button } from '@/components/marketing/Button'
import { ArrowRightIcon } from '@/components/marketing/icons'

export default function AboutContent() {
  return (
    <main>
      {/* Hero */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="01" label="About" />
          <h1 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-8" style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}>
            Full clarity, <em className="italic text-signal">at your fingertips.</em>
          </h1>
          <p className="text-[19px] leading-[1.55] text-ink-2 max-w-[600px] font-sans">
            ClearUX exists because great user experience shouldn&apos;t be a luxury reserved for companies with six-figure consultancy budgets. We audit your website, brand identity, and design — giving every team access to professional-grade insights in minutes.
          </p>
        </div>
      </section>

      {/* Origin story */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="02" label="Origin" />
          <h2 className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.02em] mb-12" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
            Why ClearUX <em className="italic text-signal">exists</em>
          </h2>

          {/* Pull quote */}
          <div className="mb-14 border-l-[3px] border-signal pl-8 py-2">
            <p className="font-serif italic text-[24px] text-ink leading-[1.4] max-w-[640px]">
              &ldquo;What if the depth of a senior consultant&apos;s review could be available to anyone, in minutes, at a fraction of the cost?&rdquo;
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-0 border border-ink">
            {[
              {
                title: 'The problem we saw',
                desc: 'The pattern was always the same: the companies that needed UX audits the most couldn\'t afford them. Enterprise got $15K consultants. Everyone else was left guessing.',
              },
              {
                title: 'What kept going wrong',
                desc: 'Dark patterns eroding trust. Inaccessible interfaces excluding real users. Products invisible to AI models. These cost businesses revenue and cost users their dignity.',
              },
              {
                title: 'What we built instead',
                desc: 'Not a checklist tool. A structured audit framework — six modules, 96 checkpoints — that gives teams 360° clarity on their user experience. Senior UX rigor, in minutes.',
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className={`p-8 ${i < 2 ? 'md:border-r border-ink max-md:border-b' : ''}`}
              >
                <h3 className="font-mono text-[11px] tracking-[0.1em] uppercase text-m-muted mb-4">{item.title}</h3>
                <p className="font-sans text-[15px] text-ink-2 leading-[1.6]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Founder */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="03" label="Founder" />
          <h2 className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.02em] mb-12" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
            Built by someone who <em className="italic text-signal">lived the problem</em>
          </h2>

          <div className="border border-ink p-10 max-sm:p-6">
            <div className="flex flex-col sm:flex-row items-start gap-8">
              <Image
                src="/team-stefano.jpg"
                alt="Stefano Schintu"
                width={96}
                height={96}
                className="w-24 h-24 object-cover flex-shrink-0"
              />
              <div className="flex-1">
                <h3 className="font-serif text-[24px] text-ink font-normal tracking-[-0.01em] mb-1">Stefano Schintu</h3>
                <p className="font-mono text-[11px] tracking-[0.08em] uppercase text-m-muted mb-6">Founder &amp; Product Lead</p>

                <div className="space-y-4 font-sans text-[15px] text-ink-2 leading-[1.65]">
                  <p>
                    Two decades in product design, UX strategy, and conversion optimisation — from early-stage MVPs to products serving millions. The frustration was always the same: brilliant teams shipping without a structured UX review, because the only option was a consultant charging five figures.
                  </p>
                  <p>
                    ClearUX was built to close that gap. Same depth, same rigour, accessible to everyone — in minutes instead of weeks.
                  </p>
                </div>

                <a
                  href="https://www.linkedin.com/in/stefanoschintu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-8 font-sans text-[14px] font-medium text-ink hover:text-signal transition-colors"
                >
                  Connect on LinkedIn
                  <ArrowRightIcon size={12} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="04" label="Values" />
          <h2 className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.02em] mb-5" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
            Clarity. Rigour. <em className="italic text-signal">Speed.</em>
          </h2>
          <p className="text-[17px] text-ink-2 leading-[1.55] max-w-[520px] mb-14 font-sans">
            We hold ourselves to the same standard we measure others by.
          </p>

          <div className="grid sm:grid-cols-3 gap-0 border border-ink">
            {[
              {
                title: 'Ethical by default',
                desc: 'Every audit checks for dark patterns, manipulative design, and cognitive overload. We refuse to use them ourselves — no subscription traps, no pressure tactics, no hidden costs.',
              },
              {
                title: 'Evidence over opinion',
                desc: 'Scores are backed by measurable checkpoints across six modules. No subjective hand-waving. Every finding links to evidence you can verify.',
              },
              {
                title: 'Accessible to all',
                desc: 'Audits from $9.90 deliver what used to cost $5K-15K from a consultant. Quality UX review shouldn\'t be a luxury reserved for well-funded teams.',
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className={`p-8 ${i < 2 ? 'sm:border-r border-ink max-sm:border-b' : ''}`}
              >
                <h3 className="font-mono text-[11px] tracking-[0.1em] uppercase text-m-muted mb-4">{item.title}</h3>
                <p className="font-sans text-[15px] text-ink-2 leading-[1.6]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="accent-section relative overflow-hidden" style={{ padding: '100px 0' }}>
        <div className="absolute pointer-events-none" style={{ top: -100, right: -100, width: 400, height: 400, background: 'radial-gradient(circle, var(--signal) 0%, transparent 65%)', opacity: 0.18 }} />
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5 relative text-center">
          <h2 className="font-serif font-normal leading-[0.95] tracking-[-0.025em] mb-6" style={{ fontSize: 'clamp(40px, 5.5vw, 72px)' }}>
            Start your audit <em className="italic text-signal">today</em>
          </h2>
          <p className="accent-subdued text-[18px] leading-[1.55] mb-10 font-sans max-w-[480px] mx-auto">
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
