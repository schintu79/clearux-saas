'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  Eye, Heart, Accessibility, Brain, Shield,
  TrendingUp, ArrowUpRight, Download,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   Product Mockup — Dark atmospheric glass-morphism cards
   simulating the ClearUX audit dashboard.
   ═══════════════════════════════════════════════════════════════ */

/* ── Hero Report Card — Large floating mockup for the hero ──── */
export function HeroReportMockup() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-5%' })

  const findings = [
    { severity: 'CRITICAL', color: 'bg-red-500 text-text', label: 'CTA invisible on mobile viewport', category: 'Foundation', opacity: 1 },
    { severity: 'HIGH', color: 'bg-orange-500 text-text', label: 'No structured data for AI agents', category: 'AI Readiness', opacity: 0.6 },
    { severity: 'MEDIUM', color: 'bg-amber-500/80 text-text', label: 'Low contrast on form labels', category: 'Visual Design', opacity: 0.35 },
  ]

  return (
    <motion.div
      ref={ref}
      className="relative w-full max-w-3xl mx-auto"
      initial={{ opacity: 0, y: 60 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
    >
      {/* Main card — dark glass with subtle indigo glow */}
      <div className="relative rounded-2xl sm:rounded-3xl bg-[rgba(255,255,255,0.03)] border border-border overflow-hidden backdrop-blur-xl shadow-none dark:shadow-[0_0_60px_-15px_rgba(99,102,241,0.15)]">
        {/* Top bar — browser chrome */}
        <div className="flex items-center justify-between px-5 sm:px-8 py-3.5 border-b border-border bg-card">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#22C55E]/60" />
          </div>
          <div className="flex-1 mx-8 hidden sm:block">
            <div className="max-w-sm mx-auto px-4 py-1.5 rounded-lg bg-card border border-border text-center">
              <span className="text-xs text-muted font-mono">fixpath.ai/audit/acme-com</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card">
              <Download size={12} className="text-muted" />
              <span className="text-[11px] text-muted font-medium">PDF</span>
            </div>
          </div>
        </div>

        {/* Findings content */}
        <div className="p-5 sm:p-8">
          <motion.p
            className="text-[10px] font-medium uppercase tracking-wider text-muted mb-4"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            Top findings by severity
          </motion.p>
          <div className="space-y-3">
            {findings.map((f, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-3 px-5 py-4 rounded-xl bg-[rgba(255,255,255,0.03)] border border-border"
                style={{ opacity: 0 }}
                initial={{ opacity: 0, x: -20 }}
                animate={isInView ? { opacity: f.opacity, x: 0 } : {}}
                transition={{ delay: 0.7 + i * 0.15, duration: 0.4 }}
              >
                <span className={`${f.color} text-[10px] sm:text-[11px] font-medium px-2.5 py-1 rounded flex-shrink-0`}>
                  {f.severity}
                </span>
                <span className="text-sm sm:text-base text-muted flex-1 truncate">{f.label}</span>
                <span className="text-[11px] text-muted hidden sm:block flex-shrink-0">{f.category}</span>
              </motion.div>
            ))}
          </div>
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
        className="rounded-2xl bg-[rgba(255,255,255,0.03)] border border-border p-6 sm:p-8 backdrop-blur-xl shadow-none dark:shadow-[0_0_60px_-15px_rgba(99,102,241,0.15)]"
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm font-medium text-text">Category Breakdown</p>
            <p className="text-xs text-muted">96 checkpoints across 6 modules</p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <TrendingUp size={12} className="text-emerald-400" />
            <span className="text-[11px] font-medium text-emerald-400">6 categories improved</span>
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
                <span className="text-sm text-muted w-32 sm:w-40 flex-shrink-0">{cat.label}</span>
                <div className="flex-1 h-2 rounded-full bg-card-hover overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${barColor(cat.status)}`}
                    initial={{ width: 0 }}
                    animate={isInView ? { width: `${cat.score}%` } : {}}
                    transition={{ duration: 0.8, delay: 0.5 + i * 0.08, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-sm font-medium text-text w-8 text-right">{cat.score}</span>
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
            <span className="bg-red-500 text-text text-[9px] font-medium px-2 py-1 rounded mt-0.5 flex-shrink-0">CRITICAL</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-text mb-1">Confirmshaming in cancel flow</p>
              <p className="text-xs text-muted leading-relaxed mb-3">
                Guilt-based language in opt-out label manipulates user decision. The cancel button reads &quot;No, I don&apos;t want to save money&quot; — a recognised dark pattern.
              </p>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-medium text-muted bg-card-hover px-2.5 py-1 rounded-lg">Ethical UX</span>
                <span className="text-[10px] font-medium text-muted bg-card-hover px-2.5 py-1 rounded-lg">High business impact</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-muted">
              <ArrowUpRight size={14} />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
