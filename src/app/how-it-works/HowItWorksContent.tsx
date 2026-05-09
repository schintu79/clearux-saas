'use client'

import Link from 'next/link'
import SmartCta from '@/components/ui/SmartCta'
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
    desc: 'The structural and technical baseline a great experience is built on — visual design, value proposition, navigation, and content quality.',
  },
  {
    icon: Users,
    title: 'Human Experience',
    desc: 'How your product feels to use — clarity, flow, cognitive load, and wellbeing. We audit feeling, not function alone, including how flows land for users in stressed or impaired states.',
  },
  {
    icon: Accessibility,
    title: 'Inclusive Design',
    desc: 'Accessibility and equity for every user, every ability, every context. WCAG compliance, cognitive accessibility, digital wellbeing, and mobile experience.',
  },
  {
    icon: Rocket,
    title: 'Future Readiness',
    desc: 'AI discoverability and how your product holds up as discovery and interaction shift. Performance, agent readiness, and internationalisation.',
  },
  {
    icon: Fingerprint,
    title: 'Brand Consistency',
    desc: 'Whether what users see matches what the brand promises — voice, visual identity, and tone alignment across every surface.',
  },
  {
    icon: Code2,
    title: 'SEO Structure',
    desc: 'Whether your product is findable, legible, and ranked the way it deserves. Technical SEO, meta tags, heading hierarchy, and structured data.',
  },
]

const STEPS = [
  {
    num: '01',
    title: 'Choose your audit',
    desc: 'Paste a website URL, upload brand identity files (PDF, DOCX, images), or submit a design. ClearUX handles all three.',
    icon: Search,
  },
  {
    num: '02',
    title: 'We run 96 checkpoints',
    desc: 'Every input analysed across six modules and 24 categories. Every score is evidence-based — no subjective hand-waving.',
    icon: Globe2,
  },
  {
    num: '03',
    title: 'You decide what to fix',
    desc: 'Every issue ranked and explained. Export as PDF or Word, share with a link. We identify. You decide.',
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
      <div className="fixed inset-0" aria-hidden="true">
        <img
          src="/gradients/bg-hero.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-80 hidden dark:block"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-surface via-transparent to-surface" />
      </div>

      {/* ═══════════════════════════════════════════════════════
          1. HERO
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-14 sm:py-36">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-muted mb-4">
            HOW IT WORKS
          </p>
          <h1
            className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-bold text-text mb-3"
            style={{ lineHeight: '1.1' }}
          >
            Audit your product. Get{' '}
            <span className="text-lime-gradient">360° clarity.</span>
          </h1>
          <p className="font-body text-base sm:text-lg text-muted leading-relaxed max-w-2xl">
            Design-file linters check mockups. ClearUX audits the shipped product — real content, live interactions, responsive behaviour, and AI discoverability across 96 checkpoints in 24 categories. Prioritised findings with evidence, severity rankings, and specific fixes. No consultants. No weeks of waiting.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          2. THREE-STEP PROCESS
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-14 sm:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-muted mb-4">
            THE PROCESS
          </p>
          <h2
            className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-bold text-text mb-10"
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
                  className="rounded-2xl border border-border bg-card backdrop-blur-sm p-8"
                >
                  <span className="font-heading text-[4rem] sm:text-[5rem] font-bold text-muted leading-none block mb-4">
                    {step.num}
                  </span>
                  <div className="w-10 h-10 rounded-lg bg-[#A8E54A]/15 dark:bg-[#BFFA60]/10 flex items-center justify-center mb-5">
                    <StepIcon size={20} className="text-[#6B9A2E] dark:text-[#BFFA60]" />
                  </div>
                  <h3 className="font-heading text-lg sm:text-xl font-medium text-text mb-3">
                    {step.title}
                  </h3>
                  <p className="font-body text-sm sm:text-base text-muted leading-relaxed">
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
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-muted mb-4">
            WHAT WE EVALUATE
          </p>
          <h2
            className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-bold text-text mb-4"
            style={{ lineHeight: '1.1' }}
          >
            Six modules. <span className="text-lime-gradient">Complete coverage.</span>
          </h2>
          <p className="font-body text-base sm:text-lg text-muted leading-relaxed max-w-xl mb-10">
            96 checkpoints across six modules that go beyond traditional audits — evaluating the dimensions most tools still ignore.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {MODULES.map((mod) => {
              const ModIcon = mod.icon
              return (
                <div
                  key={mod.title}
                  className="rounded-2xl border border-border bg-card backdrop-blur-sm p-8"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#A8E54A]/15 dark:bg-[#BFFA60]/10 flex items-center justify-center mb-6">
                    <ModIcon size={20} className="text-[#6B9A2E] dark:text-[#BFFA60]" />
                  </div>
                  <h3 className="font-heading text-lg sm:text-xl font-medium text-text mb-3">
                    {mod.title}
                  </h3>
                  <p className="font-body text-sm sm:text-base text-muted leading-relaxed">
                    {mod.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CROSS-LINKS ── */}
      <section className="relative py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted">
            <span>Learn more:</span>
            <Link href="/pricing" className="underline hover:text-text transition-colors">Pricing</Link>
            <span className="opacity-30">|</span>
            <Link href="/demo-report" className="underline hover:text-text transition-colors">See a demo report</Link>
            <span className="opacity-30">|</span>
            <Link href="/faq" className="underline hover:text-text transition-colors">FAQ</Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          4. FINAL CTA
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-28 sm:py-36 overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 text-center">
          <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-bold text-text mb-4" style={{ lineHeight: '1.1' }}>
            Start your audit <span className="text-lime-gradient">today</span>
          </h2>
          <p className="text-muted text-base md:text-lg max-w-md mx-auto leading-relaxed mb-10">
            Your first audit is free. No credit card, no commitment. Actionable UX insights in minutes.
          </p>
          <SmartCta
            className="group inline-flex items-center gap-2.5 px-7 py-[1.2rem] rounded-full bg-white text-[#111114] text-base font-medium transition-all hover:bg-white/90 whitespace-nowrap min-h-[48px]"
          />
        </div>
      </section>
    </main>
  )
}
