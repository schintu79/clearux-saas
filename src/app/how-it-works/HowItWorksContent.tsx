'use client'

import { motion } from 'framer-motion'
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
   AboutContent — Animated "How It Works" page
   ═══════════════════════════════════════════════════════════════ */

const PILLARS = [
  {
    icon: ShieldCheck,
    title: 'Ethical UX',
    color: '#EC4899',
    desc: 'Detects dark patterns, manipulative flows, confirmshaming, fake urgency, and guilt-driven copy. Ensures your product makes users feel safe, respected, and in control.',
  },
  {
    icon: Accessibility,
    title: 'Cognitive Accessibility',
    color: '#6366F1',
    desc: 'Evaluates cognitive load, sensory overwhelm, predictable navigation, and clear information hierarchy for users with ADHD, dyslexia, autism spectrum, and more.',
  },
  {
    icon: BrainCircuit,
    title: 'AI Readiness',
    color: '#22C55E',
    desc: 'Assesses whether your product is discoverable, navigable, and interpretable by LLMs and AI agents — structured data, semantic markup, and machine-readable content.',
  },
  {
    icon: HeartHandshake,
    title: 'Conversion Psychology',
    color: '#F59E0B',
    desc: 'Analyzes tone, microcopy, error messaging, delight moments, and persuasion patterns. The emotional experience users remember long after they close the tab.',
  },
]

const AUDIENCES = [
  {
    icon: BarChart3,
    title: 'Product Managers',
    color: '#6366F1',
    desc: 'Justify UX investment with data. Track findings from open to fixed, share results with stakeholders, and re-audit to show measurable improvement.',
  },
  {
    icon: Rocket,
    title: 'Founders & Startups',
    color: '#EC4899',
    desc: 'Get consultant-grade audits at a fraction of the cost, in minutes instead of weeks. No six-figure budget required.',
  },
  {
    icon: Tag,
    title: 'Agencies',
    color: '#22C55E',
    desc: 'White-label reports for clients, shareable result links for stakeholders, and re-audit tracking to prove the value of your work over time.',
  },
  {
    icon: Target,
    title: 'UX Designers',
    color: '#F59E0B',
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

export default function AboutContent() {
  return (
    <>
      {/* ═══════════════════════════════════════════════════════
          1. HERO — dark full-width with ambient aurora
          ═══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden py-28 sm:py-36 px-4 md:px-6 lg:px-8" style={{ background: '#080808' }}>
        {/* Ambient glows */}
        <div className="absolute top-[-10%] left-[15%] w-[600px] h-[500px] rounded-full bg-[#B9FF66]/[0.05] blur-[160px] pointer-events-none" />
        <div className="absolute top-[30%] right-[10%] w-[400px] h-[400px] rounded-full bg-[#6366F1]/[0.04] blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[5%] left-[40%] w-[350px] h-[350px] rounded-full bg-[#EC4899]/[0.03] blur-[120px] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/[0.06] border border-white/[0.08] mb-8">
              <div className="w-2 h-2 rounded-full animate-pulse bg-[#B9FF66]" />
              <span className="text-sm font-semibold tracking-wide text-white/60">How It Works</span>
            </div>
          </motion.div>

          <motion.h1
            className="font-heading font-semibold text-4xl sm:text-5xl md:text-6xl text-white mb-6"
            style={{ lineHeight: '1.1' }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            How ClearUX Works
          </motion.h1>

          <motion.p
            className="text-white/50 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
          >
            A human-centered AI audit that evaluates your product the way a senior UX researcher would — with empathy, evidence, and actionable clarity.
          </motion.p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          2. THREE-STEP PROCESS
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 px-4 md:px-6 lg:px-8 bg-surface overflow-hidden">
        <div className="absolute top-[10%] right-[5%] w-[500px] h-[500px] rounded-full bg-[#B9FF66]/[0.03] blur-[160px] pointer-events-none" />

        <div className="max-w-5xl mx-auto relative">
          <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <p className="text-[13px] font-semibold tracking-widest uppercase mb-4 text-text">The process</p>
            <h2 className="font-heading text-3xl sm:text-4xl md:text-[2.75rem] font-semibold text-text tracking-tight">
              Three steps to clarity
            </h2>
          </motion.div>

          <div className="space-y-20 sm:space-y-28">
            {STEPS.map((step, idx) => {
              const StepIcon = step.icon
              const isEven = idx % 2 === 1
              return (
                <motion.div
                  key={step.num}
                  className={`flex flex-col ${isEven ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-10 md:gap-16`}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  {/* Text side */}
                  <div className="flex-1 text-center md:text-left">
                    <motion.span
                      className="font-heading text-7xl sm:text-8xl font-bold text-text/[0.05] mb-4 leading-none block"
                      initial={{ opacity: 0, scale: 0.5 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
                    >
                      {step.num}
                    </motion.span>
                    <h3 className="font-heading text-2xl sm:text-3xl font-semibold text-text tracking-tight mb-4">
                      {step.title}
                    </h3>
                    <p className="text-muted text-base sm:text-lg leading-relaxed max-w-md">
                      {step.desc}
                    </p>
                  </div>

                  {/* Visual side — minimal dark card */}
                  <div className="flex-1 w-full max-w-sm">
                    <motion.div
                      className="rounded-2xl bg-[#111111] border border-white/[0.08] p-8 flex flex-col items-center justify-center aspect-[4/3]"
                      initial={{ opacity: 0, x: isEven ? -30 : 30 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                    >
                      <div className="w-14 h-14 rounded-2xl bg-[#B9FF66]/10 flex items-center justify-center mb-4">
                        <StepIcon size={28} className="text-[#B9FF66]" />
                      </div>
                      <p className="text-white/60 text-sm font-medium text-center">{step.title}</p>
                    </motion.div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          3. THE FOUR PILLARS
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 px-4 md:px-6 lg:px-8 bg-surface overflow-hidden">
        <div className="absolute bottom-[15%] left-[10%] w-[400px] h-[400px] rounded-full bg-[#6366F1]/[0.03] blur-[140px] pointer-events-none" />

        <div className="max-w-6xl mx-auto relative">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <p className="text-[13px] font-semibold tracking-widest uppercase mb-4 text-text">What we evaluate</p>
            <h2 className="font-heading text-3xl sm:text-4xl md:text-[2.75rem] font-semibold text-text tracking-tight">
              Four pillars of modern UX
            </h2>
            <p className="text-muted text-base sm:text-lg mt-4 max-w-2xl mx-auto leading-relaxed">
              64 checkpoints across four pillars that go beyond traditional audits — evaluating the dimensions most tools still ignore.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {PILLARS.map((pillar, idx) => {
              const PillarIcon = pillar.icon
              return (
                <motion.div
                  key={pillar.title}
                  className="rounded-2xl bg-card border border-border/30 p-8 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
                    style={{ background: `${pillar.color}15` }}
                  >
                    <PillarIcon size={22} style={{ color: pillar.color }} />
                  </div>
                  <h3 className="font-heading font-semibold text-xl text-text mb-3">{pillar.title}</h3>
                  <p className="text-muted text-[15px] leading-relaxed">{pillar.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          4. BUILT FOR
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 px-4 md:px-6 lg:px-8 bg-off overflow-hidden">
        <div className="max-w-6xl mx-auto relative">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <p className="text-[13px] font-semibold tracking-widest uppercase mb-4 text-text">Who we serve</p>
            <h2 className="font-heading text-3xl sm:text-4xl md:text-[2.75rem] font-semibold text-text tracking-tight">
              Built for people who ship products
            </h2>
            <p className="text-muted text-base mt-3 max-w-lg mx-auto">
              Not another enterprise tool. Built for teams that move fast.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {AUDIENCES.map((item, idx) => {
              const ItemIcon = item.icon
              return (
                <motion.div
                  key={item.title}
                  className="rounded-2xl bg-card border border-border/30 p-8 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
                    style={{ background: `${item.color}15` }}
                  >
                    <ItemIcon size={22} style={{ color: item.color }} />
                  </div>
                  <h3 className="font-heading font-semibold text-xl text-text mb-3">{item.title}</h3>
                  <p className="text-muted text-[15px] leading-relaxed">{item.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          5. LIME CTA BAND
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-28 sm:py-36 px-4 md:px-6 lg:px-8 overflow-hidden" style={{ background: '#B9FF66' }}>
        <div className="max-w-3xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <p className="text-[13px] font-semibold tracking-widest uppercase mb-4 text-[#111]/50">
              Start your audit today
            </p>
            <h2
              className="font-heading font-semibold text-4xl sm:text-5xl text-[#111] mb-6"
              style={{ lineHeight: '1.1' }}
            >
              Ready to see what<br className="hidden sm:block" /> you&apos;re missing?
            </h2>
            <p className="text-[#111]/60 text-lg mb-10 max-w-lg mx-auto">
              64 checkpoints. 16 categories. Results in minutes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-6 py-3 min-h-[48px] bg-[#111] text-[#B9FF66] text-[15px] rounded-xl font-semibold hover:brightness-110 hover:-translate-y-0.5 transition-all"
              >
                Start Free Audit
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 min-h-[44px] text-sm border-2 border-[#111]/20 text-[#111] rounded-xl font-semibold hover:bg-white/30 transition-all"
              >
                Contact us
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  )
}
