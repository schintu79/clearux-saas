'use client'

import { useRef, useState, useEffect } from 'react'
import { motion, useInView } from 'framer-motion'
import Link from 'next/link'
import {
  ListChecks, RefreshCw, Share2, TrendingUp, Search, Target,
  ArrowRight, CheckCircle, Download, Link2, Layers,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   "Beyond the Report" — 3 features, tight copy, animated visuals
   ═══════════════════════════════════════════════════════════════ */

/* Shared card shell — consistent width, padding, border, shadow
   Matches the pillar section's AnimatedMockCard sizing */
const CARD_OUTER = 'w-full mx-auto'
const CARD_INNER = 'rounded-2xl bg-card/80 dark:bg-card border border-border/30 dark:border-white/[0.05] p-7 sm:p-9 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none'
const CARD_HEADER = 'flex items-center justify-between mb-6'
const CARD_ICON_BOX = 'w-10 h-10 rounded-xl bg-text/5 flex items-center justify-center'

/* ── Visual 1: Live finding tracker ────────────────────────── */
function TrackerVisual({ inView }: { inView: boolean }) {
  const [step, setStep] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (!inView || started.current) return
    started.current = true
    const timers = [
      setTimeout(() => setStep(1), 300),
      setTimeout(() => setStep(2), 900),
      setTimeout(() => setStep(3), 1500),
      setTimeout(() => setStep(4), 2100),
      setTimeout(() => setStep(5), 2700),
    ]
    return () => timers.forEach(clearTimeout)
  }, [inView])

  const findings = [
    { label: 'CTA invisible on mobile', severity: 'Critical', initial: 'open', final: 'fixed' },
    { label: 'Confirmshaming in cancel flow', severity: 'Critical', initial: 'open', final: 'fixed' },
    { label: 'Touch targets below 44px', severity: 'High', initial: 'open', final: 'in_progress' },
    { label: 'No structured data for AI', severity: 'High', initial: 'open', final: 'open' },
    { label: 'Low contrast on form labels', severity: 'Medium', initial: 'open', final: 'fixed' },
  ]

  const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
    open: { label: 'Open', bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400' },
    in_progress: { label: 'In progress', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400' },
    fixed: { label: 'Fixed', bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-500' },
  }

  const sevColor: Record<string, string> = {
    Critical: 'bg-red-500',
    High: 'bg-orange-500',
    Medium: 'bg-amber-500',
  }

  const fixedCount = step >= 5 ? 3 : step >= 4 ? 2 : step >= 2 ? 1 : 0
  const total = findings.length
  const pct = Math.round((fixedCount / total) * 100)

  return (
    <div className={CARD_OUTER}>
      <div className={CARD_INNER}>
        {/* Header */}
        <div className={CARD_HEADER}>
          <div className="flex items-center gap-3">
            <div className={CARD_ICON_BOX}>
              <ListChecks size={20} className="text-text" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text">acme.com</p>
              <p className="text-xs text-muted">Resolution tracker</p>
            </div>
          </div>
          <motion.span
            className="font-heading text-3xl font-bold text-emerald-500"
            key={pct}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {pct}%
          </motion.span>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-border/30 dark:bg-white/[0.06] mb-6 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-emerald-500"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>

        {/* Finding rows */}
        <div className="space-y-2">
          {findings.map((f, i) => {
            const currentStatus = step > i ? f.final : f.initial
            const config = statusConfig[currentStatus]
            const isTransitioning = step === i + 1
            return (
              <motion.div
                key={i}
                className="flex items-center gap-3 py-2.5 px-3 rounded-lg"
                initial={{ opacity: 0, x: -10 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.1 + i * 0.08, duration: 0.3 }}
              >
                <span className={`${sevColor[f.severity]} text-white text-[9px] font-bold px-2 py-1 rounded flex-shrink-0 w-[56px] text-center`}>
                  {f.severity.toUpperCase()}
                </span>
                <span className="text-sm text-text flex-1 truncate">{f.label}</span>
                <motion.span
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${config.bg} ${config.text}`}
                  key={currentStatus}
                  initial={isTransitioning ? { scale: 0.8, opacity: 0 } : false}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  {config.label}
                </motion.span>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Visual 2: Score climbing ──────────────────────────────── */
function ScoreClimbVisual({ inView }: { inView: boolean }) {
  const [activeAudit, setActiveAudit] = useState(-1)
  const started = useRef(false)

  const audits = [
    { date: 'Jan', score: 42, label: 'Baseline' },
    { date: 'Mar', score: 61, label: 'Sprint 1' },
    { date: 'May', score: 78, label: 'Current' },
  ]

  useEffect(() => {
    if (!inView || started.current) return
    started.current = true
    const timers = [
      setTimeout(() => setActiveAudit(0), 400),
      setTimeout(() => setActiveAudit(1), 1100),
      setTimeout(() => setActiveAudit(2), 1800),
    ]
    return () => timers.forEach(clearTimeout)
  }, [inView])

  return (
    <div className={CARD_OUTER}>
      <div className={CARD_INNER}>
        {/* Header */}
        <div className={CARD_HEADER}>
          <div className="flex items-center gap-3">
            <div className={CARD_ICON_BOX}>
              <TrendingUp size={20} className="text-text" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text">Score Trend</p>
              <p className="text-xs text-muted">Across re-audits</p>
            </div>
          </div>
          <motion.span
            className="text-sm font-bold text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 rounded-full"
            initial={{ opacity: 0 }}
            animate={activeAudit >= 2 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            +36 pts
          </motion.span>
        </div>

        {/* Bar chart — score labels above, bars below, no overlap */}
        <div className="mb-6">
          {/* Score labels row */}
          <div className="flex gap-4 mb-2">
            {audits.map((a, i) => {
              const isVisible = activeAudit >= i
              return (
                <div key={i} className="flex-1 text-center">
                  <motion.span
                    className="text-base font-heading font-bold text-text"
                    initial={{ opacity: 0 }}
                    animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ delay: 0.3, duration: 0.3 }}
                  >
                    {a.score}
                  </motion.span>
                </div>
              )
            })}
          </div>
          {/* Bars row */}
          <div className="flex items-end gap-4 h-40">
            {audits.map((a, i) => {
              const isVisible = activeAudit >= i
              const barHeight = `${(a.score / 100) * 100}%`
              return (
                <div key={i} className="flex-1 h-full flex flex-col justify-end">
                  <motion.div
                    className={`w-full rounded-t-lg ${i === 2 ? 'bg-emerald-500' : i === 1 ? 'bg-text/60' : 'bg-text/25'}`}
                    initial={{ height: 0 }}
                    animate={isVisible ? { height: barHeight } : { height: 0 }}
                    transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.1 }}
                    style={{ minHeight: isVisible ? 8 : 0 }}
                  />
                </div>
              )
            })}
          </div>
          {/* Labels row */}
          <div className="flex gap-4 mt-2">
            {audits.map((a, i) => (
              <div key={i} className="flex-1 text-center">
                <p className="text-xs font-semibold text-text">{a.date}</p>
                <p className="text-[10px] text-muted">{a.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Re-audit modes — Dig Deeper */}
        <div className="pt-5 border-t border-border/30 dark:border-white/[0.06]">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">Choose how to dig deeper</p>
          <div className="space-y-2.5">
            {[
              { icon: RefreshCw, label: 'Verify fixes', desc: 'Re-check resolved issues only', color: '#22C55E', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
              { icon: Search, label: 'Deep scan', desc: 'Full re-audit, surface new issues', color: '#6366F1', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
              { icon: Target, label: 'Focus on pillars', desc: 'Target specific areas to improve', color: 'var(--brand)', bg: 'bg-off dark:bg-white/[0.04]' },
            ].map((m, i) => {
              const Icon = m.icon
              return (
                <motion.div
                  key={i}
                  className={`flex items-start gap-3 px-4 py-3 rounded-xl border border-border/30 dark:border-white/[0.06] ${m.bg}`}
                  initial={{ opacity: 0, x: -12 }}
                  animate={activeAudit >= 2 ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.5 + i * 0.12, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${m.color}15` }}>
                    <Icon size={16} style={{ color: m.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text leading-tight">{m.label}</p>
                    <p className="text-xs text-muted leading-snug mt-0.5">{m.desc}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Visual 3: Share link ──────────────────────────────────── */
function ShareVisual({ inView }: { inView: boolean }) {
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

  return (
    <div className={CARD_OUTER}>
      <div className={CARD_INNER}>
        {/* Header */}
        <div className={CARD_HEADER}>
          <div className="flex items-center gap-3">
            <div className={CARD_ICON_BOX}>
              <Share2 size={20} className="text-text" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text">Share Report</p>
              <p className="text-xs text-muted">One link, no account needed</p>
            </div>
          </div>
        </div>

        {/* Link being generated */}
        <motion.div
          className="rounded-xl border border-border/30 dark:border-white/[0.06] p-4 mb-4 bg-off/50 dark:bg-white/[0.03]"
          initial={{ opacity: 0 }}
          animate={step >= 1 ? { opacity: 1 } : {}}
          transition={{ duration: 0.4 }}
        >
          <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-2">Shareable link</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 rounded-lg bg-surface border border-border/30 dark:border-white/[0.06]">
              <motion.span
                className="text-xs font-mono text-text"
                initial={{ opacity: 0 }}
                animate={step >= 1 ? { opacity: 1 } : {}}
              >
                clearux.ai/s/a3x9k2
              </motion.span>
            </div>
            <motion.div
              className="px-4 py-2 rounded-lg bg-text text-surface dark:text-[#111] text-xs font-semibold flex-shrink-0"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Copy
            </motion.div>
          </div>
        </motion.div>

        {/* What stakeholders see */}
        <motion.div
          className="rounded-xl border border-border/30 dark:border-white/[0.06] p-4 bg-off/30 dark:bg-white/[0.02]"
          initial={{ opacity: 0, y: 10 }}
          animate={step >= 2 ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-3">Stakeholder view</p>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-text">acme.com</span>
            <motion.span
              className="font-heading text-3xl font-bold text-text"
              initial={{ opacity: 0 }}
              animate={step >= 2 ? { opacity: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              78
            </motion.span>
          </div>
          {/* Mini pillar bars */}
          <div className="space-y-3">
            {[
              { label: 'Foundation', value: 78 },
              { label: 'Human Exp.', value: 54 },
              { label: 'Inclusive', value: 71 },
              { label: 'Future', value: 65 },
            ].map((p, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-3"
                initial={{ opacity: 0 }}
                animate={step >= 2 ? { opacity: 1 } : {}}
                transition={{ delay: 0.3 + i * 0.08 }}
              >
                <span className="text-xs text-muted w-20 flex-shrink-0">{p.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-border/30 dark:bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-text/70"
                    initial={{ width: 0 }}
                    animate={step >= 2 ? { width: `${p.value}%` } : {}}
                    transition={{ duration: 0.6, delay: 0.4 + i * 0.08 }}
                  />
                </div>
                <span className="text-xs font-bold text-text w-6 text-right">{p.value}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Export options */}
        <motion.div
          className="flex gap-3 mt-4"
          initial={{ opacity: 0 }}
          animate={step >= 3 ? { opacity: 1 } : {}}
          transition={{ duration: 0.4 }}
        >
          {[
            { icon: Download, label: 'PDF' },
            { icon: Download, label: 'Word' },
            { icon: Link2, label: 'Revoke' },
          ].map((opt, i) => {
            const Icon = opt.icon
            return (
              <motion.div
                key={i}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/30 dark:border-white/[0.06] flex-1 justify-center"
                initial={{ opacity: 0, y: 5 }}
                animate={step >= 3 ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.1, duration: 0.3 }}
              >
                <Icon size={14} className="text-muted" />
                <span className="text-xs font-semibold text-text">{opt.label}</span>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </div>
  )
}

/* ── Main component ────────────────────────────────────────── */
const FEATURES = [
  {
    number: '01',
    title: 'Track every fix',
    description: 'Every finding gets a status. Your dashboard shows resolution progress in real-time. Proof the investment is paying off.',
  },
  {
    number: '02',
    title: 'Dig deeper. Watch your score climb.',
    description: 'Fix issues and re-audit the same URL to track real progress. Verify your fixes landed, run a full deep scan to surface new issues, or focus on specific pillars you want to improve. Every re-audit compares against your baseline so you can prove the impact.',
  },
  {
    number: '03',
    title: 'Share with anyone. No account needed.',
    description: 'One link gives stakeholders the score, pillar breakdown, and top recommendations. Export PDF or Word. Revoke anytime.',
  },
]

export default function BeyondTheReport() {
  const ref1 = useRef<HTMLDivElement>(null)
  const ref2 = useRef<HTMLDivElement>(null)
  const ref3 = useRef<HTMLDivElement>(null)

  const inView1 = useInView(ref1, { once: true, margin: '-20%' })
  const inView2 = useInView(ref2, { once: true, margin: '-20%' })
  const inView3 = useInView(ref3, { once: true, margin: '-20%' })

  const refs = [ref1, ref2, ref3]
  const visuals = [
    <TrackerVisual key="v1" inView={inView1} />,
    <ScoreClimbVisual key="v2" inView={inView2} />,
    <ShareVisual key="v3" inView={inView3} />,
  ]

  return (
    <section className="relative py-32 sm:py-40 px-4 md:px-6 lg:px-8 bg-surface overflow-hidden">
      {/* Subtle floating orbs */}
      <motion.div
        className="absolute top-[8%] left-[-4%] w-[350px] h-[350px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)', filter: 'blur(80px)' }}
        animate={{ y: [0, -25, 0], x: [0, 12, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-[12%] right-[-4%] w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.03) 0%, transparent 70%)', filter: 'blur(80px)' }}
        animate={{ y: [0, 18, 0], x: [0, -10, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
      />

      <div className="max-w-6xl mx-auto relative">
        {/* Section header — tight */}
        <motion.div
          className="text-center mb-20 sm:mb-28"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <p className="text-[13px] font-semibold tracking-widest uppercase mb-4 text-text">Beyond the report</p>
          <h2 className="font-heading text-3xl sm:text-4xl md:text-[2.75rem] font-semibold text-text mb-5 tracking-tight" style={{ lineHeight: '1.1' }}>
            Find it. Fix it. Prove it.
          </h2>
          <p className="text-muted text-base md:text-lg leading-relaxed max-w-xl mx-auto">
            Track fixes, measure improvement, share results — all from one dashboard.
          </p>
        </motion.div>

        {/* Feature steps */}
        <div className="space-y-28 sm:space-y-36">
          {FEATURES.map((feat, idx) => {
            const isEven = idx % 2 === 0
            return (
              <div
                key={idx}
                ref={refs[idx]}
                className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center"
              >
                {/* Text */}
                <motion.div
                  className={`flex flex-col justify-center ${!isEven ? 'lg:order-2' : ''}`}
                  initial={{ opacity: 0, x: isEven ? -40 : 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-15%' }}
                  transition={{ duration: 0.7 }}
                >
                  <motion.span
                    className="font-heading text-7xl sm:text-8xl font-bold text-text/[0.05] mb-3 leading-none"
                    initial={{ opacity: 0, scale: 0.5 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
                  >
                    {feat.number}
                  </motion.span>
                  <h3 className="font-heading text-2xl sm:text-3xl md:text-4xl font-semibold text-text mb-4 tracking-tight">
                    {feat.title}
                  </h3>
                  <p className="text-muted text-lg leading-relaxed max-w-md">
                    {feat.description}
                  </p>
                </motion.div>

                {/* Visual */}
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
      </div>
    </section>
  )
}
