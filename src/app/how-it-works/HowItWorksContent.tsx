'use client'

import Link from 'next/link'
import {
  ArrowRight,
  BrainCircuit,
  Accessibility,
  ShieldCheck,
  HeartHandshake,
  BarChart3,
  Rocket,
  Tag,
  Target,
  Globe2,
  Search,
  FileText,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   Data
   ═══════════════════════════════════════════════════════════════ */

const PILLARS = [
  {
    icon: ShieldCheck,
    title: 'Ethical UX',
    desc: 'Detects dark patterns, manipulative flows, confirmshaming, fake urgency, and guilt-driven copy. Ensures your product makes users feel safe, respected, and in control.',
  },
  {
    icon: Accessibility,
    title: 'Cognitive Accessibility',
    desc: 'Evaluates cognitive load, sensory overwhelm, predictable navigation, and clear information hierarchy for users with ADHD, dyslexia, autism spectrum, and more.',
  },
  {
    icon: BrainCircuit,
    title: 'AI Readiness',
    desc: 'Assesses whether your product is discoverable, navigable, and interpretable by LLMs and AI agents — structured data, semantic markup, and machine-readable content.',
  },
  {
    icon: HeartHandshake,
    title: 'Conversion Psychology',
    desc: 'Analyzes tone, microcopy, error messaging, delight moments, and persuasion patterns. The emotional experience users remember long after they close the tab.',
  },
]

const AUDIENCES = [
  {
    icon: BarChart3,
    title: 'Product Managers',
    desc: 'Justify UX investment with data. Track findings from open to fixed, share results with stakeholders, and re-audit to show measurable improvement.',
  },
  {
    icon: Rocket,
    title: 'Founders & Startups',
    desc: 'Get consultant-grade audits at a fraction of the cost, in minutes instead of weeks. No six-figure budget required.',
  },
  {
    icon: Tag,
    title: 'Agencies',
    desc: 'White-label reports for clients, shareable result links for stakeholders, and re-audit tracking to prove the value of your work over time.',
  },
  {
    icon: Target,
    title: 'UX Designers',
    desc: 'An objective second opinion before launch. Comprehensive, evidence-based review across 16 categories that catches what fresh eyes would.',
  },
]

const STEPS = [
  {
    num: '01',
    title: 'Paste your URL',
    desc: 'Enter your site URL and ClearUX automatically crawls every key page — homepage, pricing, sign-up, checkout, and more.',
    icon: Search,
  },
  {
    num: '02',
    title: 'AI runs 64 checkpoints',
    desc: 'Each page is analyzed across four UX pillars and 16 categories. No subjective hand-waving — every score is evidence-based.',
    icon: Globe2,
  },
  {
    num: '03',
    title: 'Get your report',
    desc: 'Ranked findings with severity levels, actionable fixes, and shareable links. Track progress as you resolve each issue.',
    icon: FileText,
  },
]

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */

export default function HowItWorksContent() {
  return (
    <main id="main-content" className="relative flex-1">
      {/* ── Single page background ── */}
      <div className="absolute inset-0" aria-hidden="true">
        <img
          src="/gradients/bg-howitworks.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#111114] via-transparent to-[#111114]" />
      </div>

      {/* ═══════════════════════════════════════════════════════
          1. HERO
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-28 sm:py-36">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-6">
            HOW IT WORKS
          </p>
          <h1
            className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white mb-6"
            style={{ lineHeight: '1.1' }}
          >
            How ClearUX <span className="text-lime-gradient">works.</span>
          </h1>
          <p className="font-body text-sm sm:text-base text-white/50 leading-relaxed max-w-xl">
            A human-centered AI audit that evaluates your product the way a senior UX researcher would — with empathy, evidence, and actionable clarity.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          2. THREE-STEP PROCESS
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-6">
            THE PROCESS
          </p>
          <h2
            className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white mb-16"
            style={{ lineHeight: '1.1' }}
          >
            Three steps to <span className="text-lime-gradient">clarity.</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step) => {
              const StepIcon = step.icon
              return (
                <div
                  key={step.num}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-8"
                >
                  <span className="font-heading text-[4rem] sm:text-[5rem] font-light text-white/[0.06] leading-none block mb-4">
                    {step.num}
                  </span>
                  <div className="w-10 h-10 rounded-lg bg-[#84CC16]/10 flex items-center justify-center mb-5">
                    <StepIcon size={20} className="text-[#84CC16]" />
                  </div>
                  <h3 className="font-heading text-lg sm:text-xl font-medium text-white mb-3">
                    {step.title}
                  </h3>
                  <p className="font-body text-sm sm:text-base text-white/50 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          3. THE FOUR PILLARS
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-6">
            WHAT WE EVALUATE
          </p>
          <h2
            className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white mb-4"
            style={{ lineHeight: '1.1' }}
          >
            Four pillars of <span className="text-lime-gradient">modern UX.</span>
          </h2>
          <p className="font-body text-sm sm:text-base text-white/50 leading-relaxed max-w-xl mb-16">
            64 checkpoints across four pillars that go beyond traditional audits — evaluating the dimensions most tools still ignore.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {PILLARS.map((pillar) => {
              const PillarIcon = pillar.icon
              return (
                <div
                  key={pillar.title}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-8"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#84CC16]/10 flex items-center justify-center mb-6">
                    <PillarIcon size={20} className="text-[#84CC16]" />
                  </div>
                  <h3 className="font-heading text-lg sm:text-xl font-medium text-white mb-3">
                    {pillar.title}
                  </h3>
                  <p className="font-body text-sm sm:text-base text-white/50 leading-relaxed">
                    {pillar.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          4. BUILT FOR
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-6">
            WHO WE SERVE
          </p>
          <h2
            className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white mb-4"
            style={{ lineHeight: '1.1' }}
          >
            Built for people who <span className="text-lime-gradient">ship.</span>
          </h2>
          <p className="font-body text-sm sm:text-base text-white/50 leading-relaxed max-w-xl mb-16">
            Not another enterprise tool. Built for teams that move fast.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {AUDIENCES.map((item) => {
              const ItemIcon = item.icon
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-8"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#84CC16]/10 flex items-center justify-center mb-6">
                    <ItemIcon size={20} className="text-[#84CC16]" />
                  </div>
                  <h3 className="font-heading text-lg sm:text-xl font-medium text-white mb-3">
                    {item.title}
                  </h3>
                  <p className="font-body text-sm sm:text-base text-white/50 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          5. FINAL CTA
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
