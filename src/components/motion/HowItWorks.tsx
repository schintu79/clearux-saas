'use client'

import { useRef, useState, useEffect } from 'react'
import { motion, useScroll, useTransform, useInView } from 'framer-motion'
import {
  Search, Brain, BarChart3, CheckCircle, AlertTriangle,
  ArrowRight, Zap, Shield, Eye, Heart, Accessibility, Globe2,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   "How ClearUX Works" — Scroll-driven animated walkthrough
   3 steps that animate as user scrolls through the section
   ═══════════════════════════════════════════════════════════════ */

/* ── Step 1: Animated URL typing ───────────────────────────── */
function TypewriterUrl({ inView }: { inView: boolean }) {
  const [text, setText] = useState('')
  const fullText = 'acme.com'
  const started = useRef(false)

  useEffect(() => {
    if (!inView || started.current) return
    started.current = true
    let i = 0
    const interval = setInterval(() => {
      i++
      setText(fullText.slice(0, i))
      if (i >= fullText.length) clearInterval(interval)
    }, 100)
    return () => clearInterval(interval)
  }, [inView])

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Browser chrome mockup */}
      <div className="rounded-t-xl bg-[#1a1a1a] border border-white/[0.08] border-b-0 px-4 py-3 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
        </div>
        <div className="flex-1 mx-4 h-7 rounded-md bg-white/[0.06] flex items-center px-3">
          <span className="text-[11px] text-white/30 font-mono">clearux.ai/audit</span>
        </div>
      </div>
      {/* Input area */}
      <div className="rounded-b-xl bg-[#111111] border border-white/[0.08] border-t-0 p-8">
        <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-4">Enter your website URL</p>
        <div className="flex gap-3">
          <div className="flex-1 px-4 py-3.5 rounded-xl bg-white/[0.06] border border-white/[0.10] flex items-center">
            <span className="text-white text-base font-mono">
              {text}
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                className="inline-block w-[2px] h-5 bg-[#B9FF66] ml-0.5 align-middle"
              />
            </span>
          </div>
          <motion.div
            className="px-5 py-3.5 rounded-xl bg-[#B9FF66] text-[#111] text-sm font-semibold flex items-center gap-2 flex-shrink-0"
            animate={text.length >= fullText.length ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <Search size={14} />
            Audit
          </motion.div>
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
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-xl bg-[#111111] border border-white/[0.08] p-8">
        {/* Header with progress */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-10 h-10 rounded-lg bg-[#B9FF66]/10 flex items-center justify-center"
              animate={inView ? { rotate: 360 } : {}}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Brain size={20} className="text-[#B9FF66]" />
            </motion.div>
            <div>
              <p className="text-white text-sm font-semibold">Scanning acme.com</p>
              <p className="text-white/40 text-xs">64 checkpoints across 4 pillars</p>
            </div>
          </div>
          <span className="text-[#B9FF66] font-heading text-2xl font-bold">{progress}%</span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-white/[0.06] mb-6 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[#B9FF66]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Checkpoint grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {CHECKPOINTS.map((cp, idx) => {
            const Icon = cp.icon
            const isActive = progress > (idx + 1) * 12
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.4, delay: cp.delay }}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all duration-500 ${
                  isActive
                    ? 'bg-[#B9FF66]/[0.08] border-[#B9FF66]/20'
                    : 'bg-white/[0.02] border-white/[0.06]'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-[#B9FF66]' : 'text-white/30'} />
                <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-white/30'}`}>
                  {cp.label}
                </span>
                {isActive && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    className="ml-auto"
                  >
                    <CheckCircle size={12} className="text-[#B9FF66]" />
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
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-xl bg-[#111111] border border-white/[0.08] p-8">
        {/* Score header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1">Overall Score</p>
            <p className="text-white/60 text-xs">acme.com</p>
          </div>
          <motion.div
            className="relative w-20 h-20"
            initial={{ scale: 0, rotate: -90 }}
            animate={inView ? { scale: 1, rotate: 0 } : {}}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.3 }}
          >
            <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <motion.circle
                cx="40" cy="40" r="34" fill="none" stroke="#B9FF66" strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 34}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                animate={inView ? { strokeDashoffset: 2 * Math.PI * 34 * (1 - score / 100) } : {}}
                transition={{ duration: 1.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-heading text-2xl font-bold text-white">
              {score}
            </span>
          </motion.div>
        </div>

        {/* Pillar mini bars */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6">
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
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-white/50">{p.label}</span>
                <span className="text-[11px] font-bold text-white">{p.value}</span>
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

        {/* Findings */}
        <div className="space-y-2">
          {findings.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 1.4 + i * 0.15, duration: 0.4 }}
              className="flex items-start gap-2.5 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]"
            >
              <span className={`${f.color} text-white text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0`}>
                {f.severity}
              </span>
              <div>
                <p className="text-xs font-medium text-white leading-snug">{f.label}</p>
                <p className="text-[10px] text-white/40 mt-0.5">{f.cat}</p>
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
    title: 'Enter your URL',
    description: 'Paste any website URL. No setup, no code snippets, no browser extensions.',
  },
  {
    number: '02',
    title: 'AI scans 64 checkpoints',
    description: 'Our AI crawls your site and evaluates every page against 4 pillars of UX quality.',
  },
  {
    number: '03',
    title: 'Get actionable findings',
    description: 'Findings ranked by severity and business impact. Track fixes, re-audit to prove improvement.',
  },
]

export default function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const step1Ref = useRef<HTMLDivElement>(null)
  const step2Ref = useRef<HTMLDivElement>(null)
  const step3Ref = useRef<HTMLDivElement>(null)

  const step1InView = useInView(step1Ref, { once: true, margin: '-20%' })
  const step2InView = useInView(step2Ref, { once: true, margin: '-20%' })
  const step3InView = useInView(step3Ref, { once: true, margin: '-20%' })

  const stepVisuals = [
    <TypewriterUrl key="s1" inView={step1InView} />,
    <ScanningGrid key="s2" inView={step2InView} />,
    <ResultsReveal key="s3" inView={step3InView} />,
  ]
  const stepRefs = [step1Ref, step2Ref, step3Ref]
  const stepInView = [step1InView, step2InView, step3InView]

  return (
    <section ref={sectionRef} className="relative py-32 sm:py-40 px-4 md:px-6 lg:px-8 bg-surface overflow-hidden">
      {/* Decorative orbs */}
      <motion.div
        className="absolute top-[10%] left-[-5%] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(185,255,102,0.04) 0%, transparent 70%)', filter: 'blur(80px)' }}
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
          <p className="text-[13px] font-semibold tracking-widest uppercase mb-4 text-text">How it works</p>
          <h2 className="font-heading text-3xl sm:text-4xl md:text-[2.75rem] font-semibold text-text mb-5 tracking-tight" style={{ lineHeight: '1.1' }}>
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
                    className="font-heading text-7xl sm:text-8xl font-bold text-text/[0.05] mb-4 leading-none"
                    initial={{ opacity: 0, scale: 0.5 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
                  >
                    {step.number}
                  </motion.span>
                  <h3 className="font-heading text-2xl sm:text-3xl md:text-4xl font-semibold text-text mb-4 tracking-tight">
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
  )
}
