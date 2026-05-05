'use client'

import { useRef, useState, useEffect } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  Eye, Heart, Accessibility, Brain, Shield,
  CheckCircle, TrendingUp, ArrowUpRight, FileText, Download,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   Product Mockup — Dark atmospheric glass-morphism cards
   simulating the ClearUX audit dashboard.
   ═══════════════════════════════════════════════════════════════ */

/* ── Hero Report Card — Large floating mockup for the hero ──── */
export function HeroReportMockup() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-5%' })
  const [score, setScore] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (!isInView || started.current) return
    started.current = true
    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / 1800, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setScore(Math.round(eased * 72))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [isInView])

  const pillars = [
    { label: 'Foundation', score: 78, color: '#6B5B95' },
    { label: 'Human Experience', score: 54, color: '#EC4899' },
    { label: 'Inclusive Design', score: 71, color: '#F59E0B' },
    { label: 'Future Readiness', score: 65, color: '#22C55E' },
  ]

  const findings = [
    { severity: 'CRITICAL', color: 'bg-red-500', label: 'CTA invisible on mobile viewport', category: 'Foundation' },
    { severity: 'CRITICAL', color: 'bg-red-500', label: 'Confirmshaming in cancel flow', category: 'Ethical UX' },
    { severity: 'HIGH', color: 'bg-orange-500', label: 'Touch targets below 44px minimum', category: 'Accessibility' },
    { severity: 'HIGH', color: 'bg-orange-500', label: 'No structured data for AI agents', category: 'AI Readiness' },
    { severity: 'MEDIUM', color: 'bg-amber-500', label: 'Low contrast on form labels', category: 'Visual Design' },
  ]

  const circumference = 2 * Math.PI * 52

  return (
    <motion.div
      ref={ref}
      className="relative w-full max-w-5xl mx-auto"
      initial={{ opacity: 0, y: 60 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
    >
      {/* Main card — dark glass with subtle indigo glow */}
      <div className="relative rounded-2xl sm:rounded-3xl bg-[rgba(255,255,255,0.03)] border border-white/[0.06] overflow-hidden backdrop-blur-xl shadow-[0_0_60px_-15px_rgba(99,102,241,0.15)]">
        {/* Top bar — browser chrome */}
        <div className="flex items-center justify-between px-5 sm:px-8 py-3.5 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#22C55E]/60" />
          </div>
          <div className="flex-1 mx-8 hidden sm:block">
            <div className="max-w-sm mx-auto px-4 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-center">
              <span className="text-xs text-white/40 font-mono">clearux.ai/audit/acme-com</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.04]">
              <Download size={12} className="text-white/40" />
              <span className="text-[11px] text-white/40 font-medium">PDF</span>
            </div>
          </div>
        </div>

        {/* Dashboard content */}
        <div className="p-5 sm:p-8">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-8">
            <div>
              <motion.p
                className="text-xs text-white/30 uppercase tracking-wider font-semibold mb-1"
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ delay: 0.5 }}
              >
                UX Audit Report
              </motion.p>
              <motion.h3
                className="font-heading text-xl sm:text-2xl font-bold text-white mb-1"
                initial={{ opacity: 0, y: 10 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                acme.com
              </motion.h3>
              <motion.p
                className="text-xs text-white/30"
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ delay: 0.7 }}
              >
                5 pages analysed &middot; 64 checkpoints &middot; 4 pillars
              </motion.p>
            </div>

            {/* Score ring */}
            <motion.div
              className="relative w-[120px] h-[120px] flex-shrink-0"
              initial={{ scale: 0, rotate: -90 }}
              animate={isInView ? { scale: 1, rotate: 0 } : {}}
              transition={{ type: 'spring', stiffness: 150, damping: 20, delay: 0.8 }}
            >
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                <motion.circle
                  cx="60" cy="60" r="52" fill="none" stroke="#818CF8" strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={isInView ? { strokeDashoffset: circumference * (1 - score / 100) } : {}}
                  transition={{ duration: 1.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-heading text-3xl font-bold text-white leading-none">{score}</span>
                <span className="text-[10px] text-white/30 mt-1">/ 100</span>
              </div>
            </motion.div>
          </div>

          {/* Pillar scores */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
            {pillars.map((p, i) => (
              <motion.div
                key={i}
                className="rounded-xl bg-[rgba(255,255,255,0.03)] border border-white/[0.06] p-3 sm:p-4"
                initial={{ opacity: 0, y: 15 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 1 + i * 0.1, duration: 0.4 }}
              >
                <p className="text-[10px] sm:text-xs text-white/30 mb-2 truncate">{p.label}</p>
                <div className="flex items-end justify-between mb-2">
                  <span className="font-heading text-xl sm:text-2xl font-bold text-white">{Math.round(score * p.score / 72)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: p.color }}
                    initial={{ width: 0 }}
                    animate={isInView ? { width: `${p.score}%` } : {}}
                    transition={{ duration: 1, delay: 1.2 + i * 0.1, ease: 'easeOut' }}
                  />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Findings list */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 1.5, duration: 0.5 }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-3">Top findings by severity</p>
            <div className="space-y-2">
              {findings.map((f, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-[rgba(255,255,255,0.03)] border border-white/[0.06]"
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 1.6 + i * 0.1, duration: 0.35 }}
                >
                  <span className={`${f.color} text-white text-[9px] sm:text-[10px] font-bold px-2 py-1 rounded flex-shrink-0`}>
                    {f.severity}
                  </span>
                  <span className="text-xs sm:text-sm text-white/70 flex-1 truncate">{f.label}</span>
                  <span className="text-[10px] text-white/30 hidden sm:block flex-shrink-0">{f.category}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}

/* ── Full Report Showcase — detailed report preview (dark) ──── */
export function ReportShowcase() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-10%' })

  const categories = [
    { icon: Eye, label: 'Visual Design', score: 82, status: 'good' },
    { icon: Shield, label: 'Trust Signals', score: 65, status: 'warning' },
    { icon: Heart, label: 'Ethical UX', score: 38, status: 'poor' },
    { icon: Brain, label: 'Cognitive Load', score: 55, status: 'warning' },
    { icon: Accessibility, label: 'WCAG Compliance', score: 64, status: 'warning' },
    { icon: Brain, label: 'AI Readiness', score: 72, status: 'good' },
  ]

  const statusColor = (s: string) =>
    s === 'good' ? 'text-emerald-400' : s === 'warning' ? 'text-amber-400' : 'text-red-400'
  const statusBg = (s: string) =>
    s === 'good' ? 'bg-emerald-500/10' : s === 'warning' ? 'bg-amber-500/10' : 'bg-red-500/10'
  const barColor = (s: string) =>
    s === 'good' ? 'bg-emerald-500' : s === 'warning' ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div ref={ref} className="relative">
      <motion.div
        className="rounded-2xl bg-[rgba(255,255,255,0.03)] border border-white/[0.06] p-6 sm:p-8 backdrop-blur-xl shadow-[0_0_60px_-15px_rgba(99,102,241,0.15)]"
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm font-semibold text-white">Category Breakdown</p>
            <p className="text-xs text-white/30">16 categories across 4 pillars</p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <TrendingUp size={12} className="text-emerald-400" />
            <span className="text-[11px] font-bold text-emerald-400">6 categories improved</span>
          </div>
        </div>

        <div className="space-y-4">
          {categories.map((cat, i) => {
            const Icon = cat.icon
            return (
              <motion.div
                key={i}
                className="flex items-center gap-4"
                initial={{ opacity: 0, x: -20 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.4 }}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusBg(cat.status)}`}>
                  <Icon size={14} className={statusColor(cat.status)} />
                </div>
                <span className="text-sm text-white/50 w-32 sm:w-40 flex-shrink-0">{cat.label}</span>
                <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${barColor(cat.status)}`}
                    initial={{ width: 0 }}
                    animate={isInView ? { width: `${cat.score}%` } : {}}
                    transition={{ duration: 0.8, delay: 0.5 + i * 0.08, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-sm font-bold text-white w-8 text-right">{cat.score}</span>
              </motion.div>
            )
          })}
        </div>

        {/* Finding detail card */}
        <motion.div
          className="mt-6 rounded-xl bg-red-500/10 border border-red-500/20 p-4"
          initial={{ opacity: 0, y: 15 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1.2, duration: 0.5 }}
        >
          <div className="flex items-start gap-3">
            <span className="bg-red-500 text-white text-[9px] font-bold px-2 py-1 rounded mt-0.5 flex-shrink-0">CRITICAL</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white mb-1">Confirmshaming in cancel flow</p>
              <p className="text-xs text-white/50 leading-relaxed mb-3">
                Guilt-based language in opt-out label manipulates user decision. The cancel button reads &quot;No, I don&apos;t want to save money&quot; — a recognised dark pattern.
              </p>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-medium text-white/50 bg-white/[0.06] px-2.5 py-1 rounded-lg">Ethical UX</span>
                <span className="text-[10px] font-medium text-white/50 bg-white/[0.06] px-2.5 py-1 rounded-lg">High business impact</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-white/30">
              <ArrowUpRight size={14} />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
