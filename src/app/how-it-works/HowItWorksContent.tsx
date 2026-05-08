'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Layers,
  Users,
  Accessibility,
  Rocket,
  Fingerprint,
  Code2,
  Search,
  Globe2,
  FileText,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   Data
   ═══════════════════════════════════════════════════════════════ */

const MODULES = [
  {
    icon: Layers,
    title: 'Foundation',
    desc: 'Visual design, value proposition, navigation, and content quality. The structural basics that determine whether users stay or leave.',
  },
  {
    icon: Users,
    title: 'Human Experience',
    desc: 'CTAs, trust signals, ethical UX, and emotional design. How your product makes people feel — not just what it lets them do.',
  },
  {
    icon: Accessibility,
    title: 'Inclusive Design',
    desc: 'Accessibility, cognitive load, digital wellbeing, and mobile experience. Interfaces that work for everyone, including users in stressed or impaired states.',
  },
  {
    icon: Rocket,
    title: 'Future Readiness',
    desc: 'Performance, AI discoverability, AI agent readiness, and cultural sensitivity. Built for the next wave of how products are found and used.',
  },
  {
    icon: Fingerprint,
    title: 'Brand Consistency',
    desc: 'Voice, visual identity, and tone alignment across every page. Upload your brand guidelines and the audit checks your product against them.',
  },
  {
    icon: Code2,
    title: 'SEO Structure',
    desc: 'Technical SEO, meta tags, heading hierarchy, and structured data. The foundation search engines and AI models need to understand your product.',
  },
]

const STEPS = [
  {
    num: '01',
    title: 'Paste your URL',
    desc: 'Enter your site URL. ClearUX automatically crawls every key page — homepage, pricing, sign-up, checkout, and more.',
    icon: Search,
  },
  {
    num: '02',
    title: 'AI runs 64 checkpoints',
    desc: 'Each page is analysed across six modules and 16 categories. Every score is evidence-based — no subjective hand-waving.',
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
      <section className="relative z-10 py-14 sm:py-36">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-4">
            HOW IT WORKS
          </p>
          <h1
            className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white mb-3"
            style={{ lineHeight: '1.1' }}
          >
            Paste a URL. Get a{' '}
            <span className="text-lime-gradient">professional audit.</span>
          </h1>
          <p className="font-body text-sm sm:text-base text-white/65 leading-relaxed max-w-2xl">
            ClearUX runs a structured AI audit across 64 checkpoints in 16 categories — covering usability, accessibility, dark patterns, conversion, and AI discoverability. You get a prioritised report with evidence-based findings, severity rankings, and specific fixes. No consultants. No weeks of waiting.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          2. THREE-STEP PROCESS
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-14 sm:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-4">
            THE PROCESS
          </p>
          <h2
            className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white mb-10"
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
                  <span className="font-heading text-[4rem] sm:text-[5rem] font-light text-white/[0.10] leading-none block mb-4">
                    {step.num}
                  </span>
                  <div className="w-10 h-10 rounded-lg bg-[#84CC16]/10 flex items-center justify-center mb-5">
                    <StepIcon size={20} className="text-[#84CC16]" />
                  </div>
                  <h3 className="font-heading text-lg sm:text-xl font-medium text-white mb-3">
                    {step.title}
                  </h3>
                  <p className="font-body text-sm sm:text-base text-white/65 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          3. SIX MODULES
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-14 sm:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-4">
            WHAT WE EVALUATE
          </p>
          <h2
            className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white mb-4"
            style={{ lineHeight: '1.1' }}
          >
            Six modules. <span className="text-lime-gradient">Complete coverage.</span>
          </h2>
          <p className="font-body text-sm sm:text-base text-white/65 leading-relaxed max-w-xl mb-10">
            64 checkpoints across six modules that go beyond traditional audits — evaluating the dimensions most tools still ignore.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {MODULES.map((mod) => {
              const ModIcon = mod.icon
              return (
                <div
                  key={mod.title}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-8"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#84CC16]/10 flex items-center justify-center mb-6">
                    <ModIcon size={20} className="text-[#84CC16]" />
                  </div>
                  <h3 className="font-heading text-lg sm:text-xl font-medium text-white mb-3">
                    {mod.title}
                  </h3>
                  <p className="font-body text-sm sm:text-base text-white/65 leading-relaxed">
                    {mod.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          4. FINAL CTA
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
          <p className="text-white/65 text-base md:text-lg max-w-md mx-auto leading-relaxed mb-10">
            Your first audit is free. No credit card, no commitment — just actionable UX insights in minutes.
          </p>
          <Link
            href="/register"
            className="group inline-flex items-center gap-2.5 px-7 py-[1.2rem] rounded-full bg-white text-[#111114] text-base font-medium transition-all hover:bg-white/90 whitespace-nowrap min-h-[48px]"
          >
            Start Free Audit
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </section>
    </main>
  )
}
