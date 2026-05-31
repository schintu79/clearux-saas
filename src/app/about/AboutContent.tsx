'use client'

import Image from 'next/image'
import { Search, Target, Cpu, Eye, Shield, Heart } from 'lucide-react'
import { SectionMarker } from '@/components/marketing/SectionMarker'
import { Button } from '@/components/marketing/Button'
import { ArrowRightIcon } from '@/components/marketing/icons'
import { HomeCta } from '@/components/marketing/HomeCta'

export default function AboutContent() {
  return (
    <main>
      {/* Hero */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="00" label="About" />
          <h1 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-8" style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}>
            Built around truth,{' '}
            <em className="italic text-signal">not noise.</em>
          </h1>
          <p className="text-[19px] leading-[1.55] text-ink-2 max-w-[640px] mb-10 font-sans">
            Fixpath exists because too many teams get generic reports full of low-signal
            findings instead of useful truth they can act on. We built a decision engine
            around clarity, honest scoring, and real progress tracking — so every team can
            identify what matters, fix it, and prove improvement over time.
          </p>
        </div>
      </section>

      {/* Origin story */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="02" label="Origin" />
          <h2 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-12" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
            Why Fixpath <em className="italic text-signal">exists</em>
          </h2>

          {/* Pull quote */}
          <div className="mb-14 rounded-xl p-6 sm:p-8" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
            <div className="border-l-[3px] border-signal pl-6">
              <p className="font-serif italic text-[24px] text-ink leading-[1.4] max-w-[640px]">
                &ldquo;What if teams could get useful truth about their website — not noise, not inflated scores — and actually track whether things are getting better?&rdquo;
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                title: 'The problem we saw',
                desc: 'Most audit tools create noise. Teams get 200 findings and no way to tell which ten matter. Scores lose meaning. Reports feel generic. Progress is invisible.',
                icon: Search,
                color: '#EF4444',
              },
              {
                title: 'What teams actually need',
                desc: 'Not more findings — better answers. Clear priority. Concrete fixes. Progress evidence. Honest assessment. Useful categories beyond just SEO checklists.',
                icon: Target,
                color: '#3B82F6',
              },
              {
                title: 'What we built instead',
                desc: 'A decision engine for real website and brand issues. Seven modules, 112 checkpoints, severity-ranked findings with fix guidance and progress tracking. Truth, not noise.',
                icon: Cpu,
                color: '#10B981',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl p-6"
                style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `color-mix(in srgb, ${item.color} 12%, transparent)` }}>
                  <item.icon size={20} style={{ color: item.color }} />
                </div>
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
          <h2 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-12" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
            Built by someone who <em className="italic text-signal">lived the problem</em>
          </h2>

          <div className="grid md:grid-cols-[280px_1fr] gap-0 border border-ink max-md:grid-cols-1">
            {/* Photo column */}
            <div className="relative aspect-[3/4] md:aspect-auto overflow-hidden bg-off">
              <Image
                src="/team-stefano.jpg"
                alt="Stefano Schintu"
                fill
                className="object-cover"
              />
            </div>

            {/* Bio column */}
            <div className="p-10 max-sm:p-6 flex flex-col justify-center">
              <h3 className="font-serif text-[32px] text-ink font-normal tracking-[-0.015em] leading-[1.1] mb-1">Stefano Schintu</h3>
              <p className="font-mono text-[11px] tracking-[0.08em] uppercase text-m-muted mb-8">Founder &amp; Product Lead</p>

              <div className="space-y-5 font-sans text-[16px] text-ink-2 leading-[1.7]">
                <p>
                  Two decades in product design, UX strategy, and conversion optimisation — from early-stage MVPs to products serving millions. The frustration was always the same: brilliant teams shipping without a structured UX review, because the only option was a consultant charging five figures.
                </p>
                <p>
                  Fixpath was built to close that gap. Same depth, same rigour, accessible to everyone — in minutes instead of weeks.
                </p>
              </div>

              <a
                href="https://www.linkedin.com/in/stefanoschintu"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-10 font-sans text-[14px] font-medium text-ink hover:text-signal transition-colors"
              >
                Connect on LinkedIn
                <ArrowRightIcon size={12} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="04" label="Values" />
          <h2 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-5" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
            Truth. Trust. <em className="italic text-signal">Usefulness.</em>
          </h2>
          <p className="text-[17px] text-ink-2 leading-[1.55] max-w-[520px] mb-14 font-sans">
            Three principles guide every decision we make — from how we score to how we charge.
          </p>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                title: 'Truth over noise',
                desc: 'Every finding is backed by evidence from your actual site. Scores come from measurable checkpoints, not subjective opinion. We show what matters and skip what doesn\'t.',
                icon: Eye,
                color: '#10B981',
              },
              {
                title: 'Trust by design',
                desc: 'We audit for dark patterns, manipulative design, and cognitive overload — and refuse to use them ourselves. No subscription traps, no pressure tactics, no hidden costs.',
                icon: Shield,
                color: '#3B82F6',
              },
              {
                title: 'Useful to everyone',
                desc: 'Audits from $9.90 deliver what used to cost $5K-15K from a consultant. Quality UX review shouldn\'t be a luxury reserved for well-funded teams.',
                icon: Heart,
                color: '#EC4899',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl p-6"
                style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `color-mix(in srgb, ${item.color} 12%, transparent)` }}>
                  <item.icon size={20} style={{ color: item.color }} />
                </div>
                <h3 className="font-mono text-[11px] tracking-[0.1em] uppercase text-m-muted mb-4">{item.title}</h3>
                <p className="font-sans text-[15px] text-ink-2 leading-[1.6]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <HomeCta />
    </main>
  )
}
