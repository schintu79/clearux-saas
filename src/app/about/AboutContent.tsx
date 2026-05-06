'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight,
  Eye,
  Shield,
  Heart,
  Sparkles,
  ExternalLink,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   AboutContent — Why ClearUX exists, founder, values
   ═══════════════════════════════════════════════════════════════ */

export default function AboutContent() {
  return (
    <main className="relative flex-1">
      {/* ── Single page background ── */}
      <div className="absolute inset-0" aria-hidden="true">
        <img
          src="/gradients/bg-hero.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#111114] via-transparent to-[#111114]" />
      </div>

      {/* ═══════════════════════════════════════════════════════
          1. HERO
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-6">
            About ClearUX
          </p>

          <h1 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white leading-[1.1] mb-6">
            Every product deserves an independent,{' '}
            <span className="text-lime-gradient">unbiased</span> review.
          </h1>

          <p className="font-body text-sm sm:text-base text-white/50 leading-relaxed max-w-xl">
            ClearUX exists because great user experience shouldn&apos;t be a luxury reserved for companies with six-figure consultancy budgets.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          2. WHY WE EXIST — Origin story
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-6">
            The origin story
          </p>
          <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white mb-14">
            Why ClearUX exists
          </h2>

          {/* Quote */}
          <div className="mb-14 p-6 sm:p-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm">
            <p className="font-body text-white font-medium text-lg sm:text-xl leading-relaxed max-w-2xl">
              &ldquo;What if the depth of a senior consultant&apos;s review could be available to anyone, in minutes, at a fraction of the cost?&rdquo;
            </p>
          </div>

          {/* Three story blocks */}
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Eye,
                title: 'The problem we saw',
                desc: 'After 20+ years in digital, the pattern was clear: companies that needed UX audits the most couldn\'t afford them. Enterprise got $15K consultants. Everyone else was left guessing.',
              },
              {
                icon: Shield,
                title: 'What kept going wrong',
                desc: 'Dark patterns eroding trust. Inaccessible interfaces excluding real users. Products that ignore emotional design failing to connect. These cost businesses revenue and cost users their dignity.',
              },
              {
                icon: Sparkles,
                title: 'What we built instead',
                desc: 'Not a checklist tool. A human-centered audit framework — 16 categories, 4 pillars — that examines products the way a skilled UX researcher would: with empathy, evidence, and actionable clarity.',
              },
            ].map((item) => {
              const ItemIcon = item.icon
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-7"
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 bg-[#84CC16]/10">
                    <ItemIcon size={20} className="text-[#84CC16]" />
                  </div>
                  <h3 className="font-heading font-medium text-lg text-white mb-3">{item.title}</h3>
                  <p className="font-body text-white/50 text-[14px] leading-relaxed">{item.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          3. FOUNDER
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-6">
            The founder
          </p>
          <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white mb-12">
            Built by someone who lived the problem
          </h2>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-8 sm:p-10">
            <div className="flex flex-col sm:flex-row items-start gap-6 sm:gap-8">
              <Image
                src="/team-stefano.jpg"
                alt="Stefano Schintu"
                width={80}
                height={80}
                className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
              />

              <div className="flex-1">
                <h3 className="font-heading font-medium text-xl text-white mb-1">Stefano Schintu</h3>
                <p className="font-body text-white/50 text-sm mb-4">Founder &amp; Product Lead</p>

                <div className="space-y-4 font-body text-white/50 text-[15px] leading-relaxed">
                  <p>
                    20+ years in digital product design, UX strategy, and conversion optimisation. Worked with startups, agencies, unicorn companies, and enterprise teams across the world — exposed to cultural and market differences, from early-stage MVPs to products serving millions.
                  </p>
                  <p>
                    The frustration was always the same: brilliant teams shipping products without an unbiased, structured UX review — because the only option was a consultant charging five figures and taking six weeks. The teams that needed it most could never afford it.
                  </p>
                  <p>
                    ClearUX was built to close that gap. Same depth, same rigour, accessible to everyone — in minutes instead of weeks, at a fraction of the cost.
                  </p>
                </div>

                <a
                  href="https://www.linkedin.com/in/stefanoschintu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-6 text-sm font-medium text-white hover:opacity-70 transition-opacity"
                >
                  <ExternalLink size={14} />
                  Connect on LinkedIn
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          4. OUR VALUES — Simple, clear, reliable
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-6">
            Our commitment
          </p>
          <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white mb-4">
            Clear, simple, and reliable
          </h2>
          <p className="font-body text-sm sm:text-base text-white/50 leading-relaxed max-w-xl mb-14">
            We hold ourselves to the same standard we measure others by.
          </p>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: Shield,
                title: 'Ethical by default',
                desc: 'Every audit checks for dark patterns, manipulative design, and cognitive overload. We refuse to use them ourselves — no subscription traps, no pressure tactics, no hidden costs.',
              },
              {
                icon: Eye,
                title: 'Evidence over opinion',
                desc: 'Scores are backed by 64 measurable checkpoints across 16 categories. No subjective hand-waving. Every finding links to evidence you can verify.',
              },
              {
                icon: Heart,
                title: 'Accessible to all',
                desc: 'A $99 audit delivers what used to cost $5K-15K from a consultant. Quality UX review shouldn\'t be a luxury reserved for well-funded teams.',
              },
            ].map((item) => {
              const ItemIcon = item.icon
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-7"
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 bg-[#84CC16]/10">
                    <ItemIcon size={20} className="text-[#84CC16]" />
                  </div>
                  <h3 className="font-heading font-medium text-lg text-white mb-3">{item.title}</h3>
                  <p className="font-body text-white/50 text-[14px] leading-relaxed">{item.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          5. FINAL CTA BAND
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-28 sm:py-36 overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <img src="/gradients/bg-cta.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#111114] via-transparent to-[#111114]" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 text-center">
          <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white mb-4" style={{ lineHeight: '1.1' }}>
            Start your audit <span className="text-lime-gradient">today</span>
          </h2>
          <p className="text-white/45 text-base md:text-lg max-w-md mx-auto leading-relaxed mb-10">
            Your first audit is free. No credit card, no commitment — just actionable UX insights in minutes.
          </p>
          <Link
            href="/register"
            className="group inline-flex items-center gap-2.5 px-7 py-[1.2rem] rounded-full bg-white text-[#111114] text-sm font-medium tracking-wide uppercase transition-all hover:bg-white/90 whitespace-nowrap min-h-[48px]"
          >
            Start Free Audit
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </section>
    </main>
  )
}
