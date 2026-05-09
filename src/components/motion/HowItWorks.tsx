'use client'

import { useRef, useState, useEffect } from 'react'
import { motion, useInView } from 'framer-motion'
import Link from 'next/link'
import {
  Search, Brain, BarChart3, CheckCircle,
  ArrowRight, Zap, Shield, Eye, Heart, Accessibility, Globe2,
  MousePointerClick, Layout, ScanLine, FileText,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   "How ClearUX Works" — Scroll-driven animated walkthrough
   3 steps with animated visuals. Dark UI cards mimic the app.
   ═══════════════════════════════════════════════════════════════ */

/* ── Shared dark card shell ────────────────────────────────── */
const CARD_OUTER = 'w-full mx-auto'
const CARD_INNER = 'rounded-2xl bg-[#111111] border border-white/[0.08] p-7 sm:p-9'
const CARD_HEADER = 'flex items-center justify-between mb-6'
const CARD_ICON_BOX = 'w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center'

/* ── Step 1: Page Capture — URL submitted, site pages detected ─ */
function PageCaptureVisual({ inView }: { inView: boolean }) {
  const [step, setStep] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (!inView || started.current) return
    started.current = true
    const timers = [
      setTimeout(() => setStep(1), 300),   // Show URL bar filled
      setTimeout(() => setStep(2), 900),   // Show pages being discovered
      setTimeout(() => setStep(3), 1500),  // All pages found
      setTimeout(() => setStep(4), 2100),  // Crawl starting indicator
    ]
    return () => timers.forEach(clearTimeout)
  }, [inView])

  const pages = [
    { path: '/', label: 'Homepage', icon: Layout },
    { path: '/pricing', label: 'Pricing', icon: FileText },
    { path: '/signup', label: 'Sign Up', icon: MousePointerClick },
    { path: '/checkout', label: 'Checkout', icon: BarChart3 },
    { path: '/about', label: 'About', icon: Eye },
  ]

  return (
    <div className={CARD_OUTER}>
      <div className={CARD_INNER}>
        {/* Header */}
        <div className={CARD_HEADER}>
          <div className="flex items-center gap-3">
            <div className={CARD_ICON_BOX}>
              <ScanLine size={20} className="text-[#34D399]" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Site Crawl</p>
              <p className="text-xs text-white/40">Discovering pages</p>
            </div>
          </div>
          {step >= 3 && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-xs font-medium text-[#34D399] bg-[#10B981]/10 px-3 py-1.5 rounded-full"
            >
              {pages.length} pages found
            </motion.span>
          )}
        </div>

        {/* URL bar — already filled */}
        <motion.div
          className="flex gap-2 mb-6"
          initial={{ opacity: 0 }}
          animate={step >= 1 ? { opacity: 1 } : {}}
          transition={{ duration: 0.4 }}
        >
          <div className="flex-1 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.10] flex items-center">
            <span className="text-sm text-white/70 font-mono">acme.com</span>
          </div>
          <motion.div
            className="px-5 py-3 rounded-xl bg-[#10B981] text-[#111] text-sm font-medium flex items-center gap-2 flex-shrink-0"
            animate={step >= 1 ? { scale: [1, 1.04, 1] } : {}}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Search size={15} />
            Audit
          </motion.div>
        </motion.div>

        {/* Pages being discovered */}
        <div className="space-y-2">
          {pages.map((page, i) => {
            const Icon = page.icon
            const isVisible = step >= 2 && i <= (step === 2 ? 2 : pages.length - 1)
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={isVisible ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.35, delay: i * 0.08 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
              >
                <Icon size={15} className="text-white/30 flex-shrink-0" />
                <span className="text-sm text-white/50 font-mono">{page.path}</span>
                <span className="text-xs text-white/30 ml-auto">{page.label}</span>
                {step >= 4 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15, delay: i * 0.06 }}
                  >
                    <CheckCircle size={14} className="text-[#34D399]" />
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Step 2: Scanning animation ────────────────────────────── */
const CHECKPOINTS = [
  { icon: Eye, label: 'Visual Design', delay: 0 },
  { icon: Shield, label: 'Trust Signals', delay: 0.15 },
  { icon: Heart, label: 'Dark Patterns', delay: 0.3 },
  { icon: Brain, label: 'Cognitive Load', delay: 0.45 },
  { icon: Accessibility, label: 'WCAG Check', delay: 0.6 },
  { icon: Globe2, label: 'AI Readiness', delay: 0.75 },
  { icon: Zap, label: 'Performance', delay: 0.9 },
  { icon: BarChart3, label: 'Conversion', delay: 1.05 },
]

function ScanningGrid({ inView }: { inView: boolean }) {
  const [progress, setProgress] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (!inView || started.current) return
    started.current = true
    let p = 0
    const interval = setInterval(() => {
      p += 1
      setProgress(p)
      if (p >= 100) clearInterval(interval)
    }, 25)
    return () => clearInterval(interval)
  }, [inView])

  return (
    <div className={CARD_OUTER}>
      <div className={CARD_INNER}>
        {/* Header with progress */}
        <div className={CARD_HEADER}>
          <div className="flex items-center gap-3">
            <motion.div
              className={CARD_ICON_BOX}
              animate={inView ? { rotate: 360 } : {}}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Brain size={20} className="text-[#34D399]" />
            </motion.div>
            <div>
              <p className="text-sm font-medium text-white">Analysing acme.com</p>
              <p className="text-xs text-white/40">96 checkpoints across 6 modules</p>
            </div>
          </div>
          <span className="text-[#34D399] font-heading text-3xl font-medium">{progress}%</span>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-white/[0.06] mb-6 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[#10B981]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Checkpoint grid */}
        <div className="grid grid-cols-2 gap-3">
          {CHECKPOINTS.map((cp, idx) => {
            const Icon = cp.icon
            const isActive = progress > (idx + 1) * 12
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.4, delay: cp.delay }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300 ${
                  isActive
                    ? 'bg-[#10B981]/[0.08] border-[#10B981]/20'
                    : 'bg-white/[0.02] border-white/[0.06]'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-[#34D399]' : 'text-white/30'} />
                <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-white/30'}`}>
                  {cp.label}
                </span>
                {isActive && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    className="ml-auto"
                  >
                    <CheckCircle size={14} className="text-[#34D399]" />
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Step 3: Results reveal ────────────────────────────────── */
function ResultsReveal({ inView }: { inView: boolean }) {
  const [score, setScore] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (!inView || started.current) return
    started.current = true
    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / 1500, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setScore(Math.round(eased * 72))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [inView])

  const findings = [
    { severity: 'CRITICAL', color: 'bg-red-500', label: 'Confirmshaming in cancel flow', cat: 'Ethical UX' },
    { severity: 'HIGH', color: 'bg-orange-500', label: 'Touch targets below 44px minimum', cat: 'Accessibility' },
    { severity: 'HIGH', color: 'bg-orange-500', label: 'No structured data for AI agents', cat: 'AI Readiness' },
  ]

  return (
    <div className={CARD_OUTER}>
      <div className={CARD_INNER}>
        {/* Header */}
        <div className={CARD_HEADER}>
          <div className="flex items-center gap-3">
            <div className={CARD_ICON_BOX}>
              <BarChart3 size={20} className="text-[#34D399]" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Audit Complete</p>
              <p className="text-xs text-white/40">acme.com</p>
            </div>
          </div>
          <motion.div
            className="relative w-20 h-20"
            initial={{ scale: 0, rotate: -90 }}
            animate={inView ? { scale: 1, rotate: 0 } : {}}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.3 }}
          >
            <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
              <motion.circle
                cx="40" cy="40" r="34" fill="none" stroke="#10B981" strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 34}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                animate={inView ? { strokeDashoffset: 2 * Math.PI * 34 * (1 - score / 100) } : {}}
                transition={{ duration: 1.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-heading text-2xl font-medium text-white">
              {score}
            </span>
          </motion.div>
        </div>

        {/* Pillar mini bars */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-6">
          {[
            { label: 'Foundation', value: 78 },
            { label: 'Human Exp.', value: 54 },
            { label: 'Inclusive', value: 71 },
            { label: 'Future', value: 65 },
          ].map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.8 + i * 0.1, duration: 0.4 }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-white/50">{p.label}</span>
                <span className="text-xs font-medium text-white">{p.value}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-white/80"
                  initial={{ width: 0 }}
                  animate={inView ? { width: `${p.value}%` } : {}}
                  transition={{ duration: 0.8, delay: 1 + i * 0.1, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Top findings */}
        <div className="space-y-2.5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/30 mb-3">Top findings</p>
          {findings.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 1.4 + i * 0.15, duration: 0.4 }}
              className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]"
            >
              <span className={`${f.color} text-white text-[10px] font-medium px-2 py-1 rounded mt-0.5 flex-shrink-0`}>
                {f.severity}
              </span>
              <div>
                <p className="text-sm font-medium text-white leading-snug">{f.label}</p>
                <p className="text-xs text-white/40 mt-0.5">{f.cat}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Main component ────────────────────────────────────────── */
const STEPS = [
  {
    number: '01',
    title: 'Paste your URL',
    description: 'Enter any website. ClearUX crawls every key page automatically — no code, no setup.',
  },
  {
    number: '02',
    title: 'Our AI runs 96 checkpoints',
    description: 'Each page is evaluated against four UX pillars: ethical design, cognitive accessibility, AI readiness, and conversion psychology.',
  },
  {
    number: '03',
    title: 'Get your report',
    description: 'A ranked list of findings by severity and business impact — with clear, actionable fixes for each one.',
  },
]

export default function HowItWorks() {
  const step1Ref = useRef<HTMLDivElement>(null)
  const step2Ref = useRef<HTMLDivElement>(null)
  const step3Ref = useRef<HTMLDivElement>(null)

  const step1InView = useInView(step1Ref, { once: true, margin: '-20%' })
  const step2InView = useInView(step2Ref, { once: true, margin: '-20%' })
  const step3InView = useInView(step3Ref, { once: true, margin: '-20%' })

  const stepVisuals = [
    <PageCaptureVisual key="s1" inView={step1InView} />,
    <ScanningGrid key="s2" inView={step2InView} />,
    <ResultsReveal key="s3" inView={step3InView} />,
  ]
  const stepRefs = [step1Ref, step2Ref, step3Ref]

  return (
    <>
    <section className="relative py-32 sm:py-40 px-4 md:px-6 lg:px-8 bg-surface overflow-hidden">
      {/* Decorative orbs */}
      <motion.div
        className="absolute top-[10%] left-[-5%] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)', filter: 'blur(80px)' }}
        animate={{ y: [0, -30, 0], x: [0, 15, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-[15%] right-[-5%] w-[350px] h-[350px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.03) 0%, transparent 70%)', filter: 'blur(80px)' }}
        animate={{ y: [0, 20, 0], x: [0, -10, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />

      <div className="max-w-6xl mx-auto relative">
        {/* Section header */}
        <motion.div
          className="text-center mb-20 sm:mb-28"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <p className="text-[13px] font-medium tracking-widest uppercase mb-4 text-text">How it works</p>
          <h2 className="font-heading text-3xl sm:text-4xl md:text-[2.75rem] font-medium text-text mb-5" style={{ lineHeight: '1.1' }}>
            Three steps. Under 10 minutes.<br className="hidden sm:block" />
            <span className="text-muted">Zero setup required.</span>
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="space-y-28 sm:space-y-36">
          {STEPS.map((step, idx) => {
            const isEven = idx % 2 === 0
            return (
              <div
                key={idx}
                ref={stepRefs[idx]}
                className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center"
              >
                {/* Text side */}
                <motion.div
                  className={`flex flex-col justify-center ${!isEven ? 'lg:order-2' : ''}`}
                  initial={{ opacity: 0, x: isEven ? -40 : 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-15%' }}
                  transition={{ duration: 0.7 }}
                >
                  <motion.span
                    className="font-heading text-7xl sm:text-8xl font-medium text-text/[0.05] mb-4 leading-none"
                    initial={{ opacity: 0, scale: 0.5 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
                  >
                    {step.number}
                  </motion.span>
                  <h3 className="font-heading text-2xl sm:text-3xl md:text-4xl font-medium text-text mb-4">
                    {step.title}
                  </h3>
                  <p className="text-muted text-lg leading-relaxed max-w-md">
                    {step.description}
                  </p>
                </motion.div>

                {/* Visual side */}
                <motion.div
                  className={`${!isEven ? 'lg:order-1' : ''}`}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-10%' }}
                  transition={{ duration: 0.7, delay: 0.2 }}
                >
                  {stepVisuals[idx]}
                </motion.div>
              </div>
            )
          })}
        </div>

      </div>
    </section>

      {/* Full-width lime CTA band — visual break */}
      <section className="w-full py-24 sm:py-32 px-4 md:px-6 lg:px-8" style={{ background: '#10B981' }}>
        <motion.div
          className="text-center max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <h3 className="font-heading text-2xl sm:text-3xl md:text-4xl font-medium text-white mb-3" style={{ lineHeight: '1.15' }}>
            Ready to see what you&apos;re missing?
          </h3>
          <p className="text-white/70 text-sm sm:text-base mb-8 max-w-md mx-auto">
            Your first audit is free. Results in under 10 minutes.
          </p>
          <Link
            href="/register"
            className="group inline-flex items-center gap-3 bg-[#111] text-[#34D399] text-base sm:text-lg font-medium px-10 sm:px-14 py-4 sm:py-5 rounded-2xl transition-all duration-300 hover:shadow-[0_8px_40px_rgba(0,0,0,0.3)] hover:-translate-y-1"
          >
            Start free audit
            <ArrowRight size={20} className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </section>
    </>
  )
}
