'use client'

import { useRef, useState, useEffect } from 'react'
import { motion, useInView } from 'framer-motion'
import Link from 'next/link'
import {
  Scale, Brain, Zap, BarChart3, CheckCircle, X, AlertTriangle,
  ArrowRight, Eye, Globe2, Sparkles, MousePointerClick,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   "Why ClearUX" — Scroll-driven animated differentiators
   Each bullet point gets a live animated visual on white card
   ═══════════════════════════════════════════════════════════════ */

/* ── Visual 1: Dark Pattern Detection ──────────────────────── */
function DarkPatternVisual({ inView }: { inView: boolean }) {
  const [step, setStep] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (!inView || started.current) return
    started.current = true
    const timers = [
      setTimeout(() => setStep(1), 400),   // Show the UI
      setTimeout(() => setStep(2), 1200),   // Highlight dark pattern
      setTimeout(() => setStep(3), 2000),   // Show flag
    ]
    return () => timers.forEach(clearTimeout)
  }, [inView])

  return (
    <div className="w-full mx-auto">
      <div className="rounded-2xl bg-white border border-[#111]/10 p-7 sm:p-9 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#111]/5 flex items-center justify-center">
            <Scale size={20} className="text-[#111]" />
          </div>
          <p className="text-sm font-semibold text-[#111]">Dark Pattern Scanner</p>
        </div>

        {/* Mock cancel flow */}
        <div className="rounded-xl border border-[#111]/10 p-5 mb-4 bg-[#FAFAFA]">
          <p className="text-sm font-semibold text-[#111] mb-1.5">Cancel subscription?</p>
          <p className="text-[11px] text-[#111]/50 mb-4 leading-relaxed">Are you sure you want to leave? You&apos;ll lose access to all features.</p>

          {/* The dark pattern buttons */}
          <div className="space-y-2">
            <motion.div
              className="relative"
              animate={step >= 2 ? { boxShadow: '0 0 0 2px #EF4444, 0 0 12px rgba(239,68,68,0.2)' } : {}}
              transition={{ duration: 0.4 }}
              style={{ borderRadius: 8 }}
            >
              <div className="w-full py-2.5 px-4 rounded-lg bg-[#111] text-white text-xs font-semibold text-center">
                Keep my subscription
              </div>
            </motion.div>

            <motion.div
              className="relative"
              animate={step >= 2 ? { boxShadow: '0 0 0 2px #EF4444, 0 0 12px rgba(239,68,68,0.2)' } : {}}
              transition={{ duration: 0.4, delay: 0.15 }}
              style={{ borderRadius: 8 }}
            >
              <div className="w-full py-2.5 px-4 rounded-lg border border-[#111]/10 text-[#111]/30 text-xs text-center">
                No, I don&apos;t want to save money
              </div>
              {/* Scan line */}
              {step >= 2 && (
                <motion.div
                  className="absolute inset-0 rounded-lg pointer-events-none"
                  initial={{ background: 'transparent' }}
                  animate={{ background: ['rgba(239,68,68,0.08)', 'rgba(239,68,68,0.03)', 'rgba(239,68,68,0.08)'] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </motion.div>
          </div>
        </div>

        {/* Detection result */}
        <motion.div
          className="p-3.5 rounded-xl bg-red-50 border border-red-200"
          initial={{ opacity: 0, y: 10, height: 0, padding: 0, marginTop: 0 }}
          animate={step >= 3 ? { opacity: 1, y: 0, height: 'auto', padding: '0.875rem', marginTop: '0px' } : {}}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <div className="flex items-start gap-2">
            <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0">CRITICAL</span>
            <div>
              <p className="text-[11px] font-semibold text-[#111] leading-snug">Confirmshaming detected</p>
              <p className="text-[10px] text-[#111]/50 mt-0.5">Guilt-based language in opt-out label manipulates user decision</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

/* ── Visual 2: Cognitive Accessibility ─────────────────────── */
function CognitiveVisual({ inView }: { inView: boolean }) {
  const [progress, setProgress] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (!inView || started.current) return
    started.current = true
    let p = 0
    const interval = setInterval(() => {
      p += 2
      setProgress(p)
      if (p >= 100) clearInterval(interval)
    }, 30)
    return () => clearInterval(interval)
  }, [inView])

  const metrics = [
    { label: 'Cognitive load', value: 78, status: 'warning', desc: 'High information density' },
    { label: 'Reading level', value: 92, status: 'good', desc: 'Grade 8 — accessible' },
    { label: 'Focus guidance', value: 45, status: 'poor', desc: 'Competing visual elements' },
    { label: 'Sensory overload', value: 62, status: 'warning', desc: 'Auto-playing media detected' },
  ]

  const statusColor = (s: string) =>
    s === 'good' ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
      : s === 'warning' ? 'text-amber-600 bg-amber-50 border-amber-200'
        : 'text-red-600 bg-red-50 border-red-200'

  const barColor = (s: string) =>
    s === 'good' ? 'bg-emerald-500' : s === 'warning' ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="w-full mx-auto">
      <div className="rounded-2xl bg-white border border-[#111]/10 p-7 sm:p-9 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#111]/5 flex items-center justify-center">
            <Brain size={20} className="text-[#111]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111]">Cognitive Analysis</p>
            <p className="text-xs text-[#111]/40">ADHD, Dyslexia, Autism spectrum</p>
          </div>
        </div>

        <div className="space-y-3.5">
          {metrics.map((m, i) => {
            const animatedValue = Math.min(Math.round((progress / 100) * m.value), m.value)
            const isVisible = progress > i * 20
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -15 }}
                animate={isVisible ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-[#111]">{m.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-[#111]">{animatedValue}</span>
                    {progress >= 80 && (
                      <motion.span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${statusColor(m.status)}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      >
                        {m.status === 'good' ? 'PASS' : m.status === 'warning' ? 'WARN' : 'FAIL'}
                      </motion.span>
                    )}
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-[#111]/[0.06] overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${barColor(m.status)}`}
                    initial={{ width: 0 }}
                    animate={isVisible ? { width: `${m.value}%` } : {}}
                    transition={{ duration: 0.8, delay: 0.2 + i * 0.1, ease: 'easeOut' }}
                  />
                </div>
                {progress >= 90 && (
                  <motion.p
                    className="text-[9px] text-[#111]/40 mt-0.5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    {m.desc}
                  </motion.p>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Visual 3: AI Agent Readiness ──────────────────────────── */
function AIReadinessVisual({ inView }: { inView: boolean }) {
  const [step, setStep] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (!inView || started.current) return
    started.current = true
    const timers = [
      setTimeout(() => setStep(1), 300),
      setTimeout(() => setStep(2), 1000),
      setTimeout(() => setStep(3), 1700),
      setTimeout(() => setStep(4), 2400),
    ]
    return () => timers.forEach(clearTimeout)
  }, [inView])

  const checks = [
    { label: 'Schema.org structured data', found: false, icon: X },
    { label: 'Product pricing in metadata', found: false, icon: X },
    { label: 'FAQ markup for LLMs', found: true, icon: CheckCircle },
    { label: 'OpenGraph & semantic HTML', found: true, icon: CheckCircle },
  ]

  return (
    <div className="w-full mx-auto">
      <div className="rounded-2xl bg-white border border-[#111]/10 p-7 sm:p-9 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3 mb-6">
          <motion.div
            className="w-10 h-10 rounded-xl bg-[#111]/5 flex items-center justify-center"
            animate={step >= 1 && step < 4 ? { rotate: [0, 5, -5, 0] } : {}}
            transition={{ duration: 0.5, repeat: step < 4 ? Infinity : 0, repeatDelay: 1 }}
          >
            <Zap size={20} className="text-[#111]" />
          </motion.div>
          <div>
            <p className="text-sm font-semibold text-[#111]">AI Agent Readiness</p>
            <p className="text-xs text-[#111]/40">How ChatGPT, Perplexity & agents see you</p>
          </div>
        </div>

        {/* Simulated AI agent "reading" */}
        <div className="rounded-xl border border-[#111]/10 p-4 mb-4 bg-[#FAFAFA]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full bg-[#111] flex items-center justify-center">
              <Sparkles size={10} className="text-[#B9FF66]" />
            </div>
            <span className="text-[10px] font-semibold text-[#111]/60">AI Agent parsing acme.com...</span>
          </div>

          {/* Structured data checks */}
          <div className="space-y-2">
            {checks.map((check, i) => {
              const isShown = step > i
              const Icon = check.icon
              return (
                <motion.div
                  key={i}
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={isShown ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.3 }}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={isShown ? { scale: 1 } : {}}
                    transition={{ type: 'spring', stiffness: 500, damping: 20, delay: 0.1 }}
                  >
                    {check.found ? (
                      <CheckCircle size={14} className="text-emerald-500" />
                    ) : (
                      <X size={14} className="text-red-500" />
                    )}
                  </motion.div>
                  <span className={`text-[11px] ${check.found ? 'text-[#111]' : 'text-[#111]/50 line-through'}`}>
                    {check.label}
                  </span>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Result */}
        <motion.div
          className="p-3.5 rounded-xl bg-orange-50 border border-orange-200"
          initial={{ opacity: 0, y: 10 }}
          animate={step >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-start gap-2">
            <span className="bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0">HIGH</span>
            <div>
              <p className="text-[11px] font-semibold text-[#111] leading-snug">AI agents can&apos;t extract pricing</p>
              <p className="text-[10px] text-[#111]/50 mt-0.5">Missing structured data means you&apos;re invisible to AI recommendations</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

/* ── Visual 4: Conversion Psychology ───────────────────────── */
function ConversionVisual({ inView }: { inView: boolean }) {
  const [step, setStep] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (!inView || started.current) return
    started.current = true
    const timers = [
      setTimeout(() => setStep(1), 400),
      setTimeout(() => setStep(2), 1200),
      setTimeout(() => setStep(3), 2000),
    ]
    return () => timers.forEach(clearTimeout)
  }, [inView])

  const funnel = [
    { label: 'Landed on page', users: 1000, pct: 100 },
    { label: 'Scrolled to CTA', users: 620, pct: 62 },
    { label: 'Clicked CTA', users: 180, pct: 18 },
    { label: 'Completed signup', users: 45, pct: 4.5 },
  ]

  return (
    <div className="w-full mx-auto">
      <div className="rounded-2xl bg-white border border-[#111]/10 p-7 sm:p-9 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#111]/5 flex items-center justify-center">
            <BarChart3 size={20} className="text-[#111]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111]">Conversion Psychology</p>
            <p className="text-xs text-[#111]/40">Where users drop off & why</p>
          </div>
        </div>

        {/* Funnel visualization */}
        <div className="space-y-2 mb-4">
          {funnel.map((stage, i) => {
            const isShown = step >= 1
            const isDropoff = i === 1 // biggest drop-off point
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -15 }}
                animate={isShown ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.4, delay: i * 0.12 }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-[#111]/60">{stage.label}</span>
                  <span className="text-[10px] font-bold text-[#111]">{stage.pct}%</span>
                </div>
                <div className="h-6 rounded-md bg-[#111]/[0.04] overflow-hidden relative">
                  <motion.div
                    className={`h-full rounded-md ${i < 2 ? 'bg-[#111]' : i === 2 ? 'bg-amber-500' : 'bg-red-500'}`}
                    initial={{ width: 0 }}
                    animate={isShown ? { width: `${stage.pct}%` } : {}}
                    transition={{ duration: 0.8, delay: 0.3 + i * 0.15, ease: 'easeOut' }}
                  />
                  {/* Drop-off indicator */}
                  {step >= 2 && i > 0 && (
                    <motion.div
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 + i * 0.1, type: 'spring', stiffness: 300 }}
                    >
                      <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${
                        i === 1 ? 'bg-orange-100 text-orange-600' :
                        i === 2 ? 'bg-red-100 text-red-600' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {i === 1 ? '-38%' : i === 2 ? '-44%' : '-13.5%'}
                      </span>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Finding */}
        <motion.div
          className="p-3.5 rounded-xl bg-amber-50 border border-amber-200"
          initial={{ opacity: 0, y: 10 }}
          animate={step >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-start gap-2">
            <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0">HIGH</span>
            <div>
              <p className="text-[11px] font-semibold text-[#111] leading-snug">CTA below the fold on mobile</p>
              <p className="text-[10px] text-[#111]/50 mt-0.5">38% of users never see the primary action. Move CTA above 600px viewport line.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

/* ── Main section ──────────────────────────────────────────── */
const DIFFERENTIATORS = [
  {
    number: '01',
    title: 'Dark pattern detection',
    subtitle: 'What others miss entirely',
    description: 'Confirmshaming, forced continuity, trick questions, hidden costs — we detect manipulative UX patterns that no accessibility scanner or analytics tool even looks for.',
    competitors: 'Hotjar, Lighthouse, axe — none of them check for this.',
  },
  {
    number: '02',
    title: 'Cognitive accessibility',
    subtitle: 'Beyond WCAG compliance',
    description: 'We evaluate how your site performs for users with ADHD, dyslexia, and autism spectrum — testing cognitive load, reading complexity, sensory overload, and focus guidance.',
    competitors: 'WAVE and axe check technical WCAG. Nobody checks cognitive load.',
  },
  {
    number: '03',
    title: 'AI agent readiness',
    subtitle: 'The audit nobody else offers',
    description: 'Can ChatGPT accurately describe your product? Can an AI agent navigate your checkout? We test how LLMs and AI agents understand and interact with your site.',
    competitors: 'This category didn\'t exist 18 months ago. We built it.',
  },
  {
    number: '04',
    title: 'Conversion psychology',
    subtitle: 'Where the money is',
    description: 'We analyse CTA placement, friction points, trust signal positioning, and user decision psychology. Every finding ties back to revenue impact.',
    competitors: 'Analytics show what happened. We show what\'s wrong.',
  },
]

export default function WhyClearUX() {
  const ref1 = useRef<HTMLDivElement>(null)
  const ref2 = useRef<HTMLDivElement>(null)
  const ref3 = useRef<HTMLDivElement>(null)
  const ref4 = useRef<HTMLDivElement>(null)

  const inView1 = useInView(ref1, { once: true, margin: '-20%' })
  const inView2 = useInView(ref2, { once: true, margin: '-20%' })
  const inView3 = useInView(ref3, { once: true, margin: '-20%' })
  const inView4 = useInView(ref4, { once: true, margin: '-20%' })

  const refs = [ref1, ref2, ref3, ref4]
  const inViews = [inView1, inView2, inView3, inView4]
  const visuals = [
    <DarkPatternVisual key="v1" inView={inView1} />,
    <CognitiveVisual key="v2" inView={inView2} />,
    <AIReadinessVisual key="v3" inView={inView3} />,
    <ConversionVisual key="v4" inView={inView4} />,
  ]

  return (
    <section className="py-32 sm:py-40 px-4 md:px-6 lg:px-8" style={{ background: '#B9FF66' }}>
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <p className="text-[13px] font-semibold tracking-widest uppercase mb-4 text-[#111]/50">What others miss</p>
          <h2 className="font-heading text-3xl sm:text-4xl md:text-[2.75rem] font-semibold text-[#111] mb-5 tracking-tight" style={{ lineHeight: '1.1' }}>
            Why ClearUX
          </h2>
          <p className="text-[#111]/60 text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
            User-behavior tools show what happened. Accessibility scanners check WCAG boxes. UX consultants cost $5K&ndash;15K and take weeks. ClearUX is the only audit that covers all four — in minutes, for $99.
          </p>
        </motion.div>

        {/* Differentiator steps */}
        <div className="space-y-24 sm:space-y-32 mt-20">
          {DIFFERENTIATORS.map((diff, idx) => {
            const isEven = idx % 2 === 0
            return (
              <div
                key={idx}
                ref={refs[idx]}
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
                    className="font-heading text-7xl sm:text-8xl font-bold text-[#111]/[0.06] mb-2 leading-none"
                    initial={{ opacity: 0, scale: 0.5 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
                  >
                    {diff.number}
                  </motion.span>
                  <p className="font-heading text-sm sm:text-base font-semibold text-[#111] mb-1 tracking-tight">{diff.subtitle}</p>
                  <h3 className="font-heading text-2xl sm:text-3xl md:text-4xl font-semibold text-[#111] mb-4 tracking-tight">
                    {diff.title}
                  </h3>
                  <p className="text-[#111]/70 text-base leading-relaxed mb-4 max-w-md">
                    {diff.description}
                  </p>
                  <p className="text-[11px] font-medium text-[#111]/40 italic">
                    {diff.competitors}
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
                  {visuals[idx]}
                </motion.div>
              </div>
            )
          })}
        </div>

        {/* Bottom CTA */}
        <motion.div
          className="text-center mt-24"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-[#111] text-lg font-semibold mb-6">All four. In every audit. For $99.</p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-[#111] text-[#B9FF66] text-[15px] font-semibold px-8 py-4 min-h-[48px] rounded-xl transition-all hover:brightness-110 hover:-translate-y-0.5"
          >
            Start free audit
            <ArrowRight size={16} />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
