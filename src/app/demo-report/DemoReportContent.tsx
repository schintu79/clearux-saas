'use client'

import { useState } from 'react'
import Link from 'next/link'
import SmartCta from '@/components/ui/SmartCta'
import {
  ArrowRight,
  TrendingUp,
  Download,
  Share2,
  RefreshCw,
  Search,
  Globe2,
  Fingerprint,
  Layers,
  Eye,
  Target,
  Type,
  MousePointerClick,
  Shield,
  Smartphone,
  Lightbulb,
  Accessibility,
  Code2,
  Rocket,
  Users,
  Palette,
  PenTool,
  FileText,
  LayoutGrid,
  MessageSquare,
} from 'lucide-react'

/* ══════════════════════════════════════════════════════════════
   SHARED HELPERS
   ══════════════════════════════════════════════════════════════ */

function scoreColor(s: number) {
  if (s >= 70) return 'text-emerald-600 dark:text-emerald-400'
  if (s >= 40) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function scoreBg(s: number) {
  if (s >= 70) return 'bg-emerald-500'
  if (s >= 40) return 'bg-amber-500'
  return 'bg-red-500'
}

function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)
  const color = score >= 70 ? '#22C55E' : score >= 40 ? '#EAB308' : '#EF4444'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-heading text-2xl font-light text-text">{score}</span>
      </div>
    </div>
  )
}

function SeverityDot({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-blue-500',
  }
  return <span className={`w-2 h-2 rounded-full ${colors[severity] || colors.medium}`} />
}

/* ══════════════════════════════════════════════════════════════
   WEBSITE AUDIT DEMO DATA
   ══════════════════════════════════════════════════════════════ */

const WEBSITE_MODULES = [
  { name: 'Foundation', score: 81, icon: Layers, color: 'text-[#6366F1]', bg: 'bg-[#6366F1]/10' },
  { name: 'Human Experience', score: 71, icon: Users, color: 'text-pink-500', bg: 'bg-pink-500/10' },
  { name: 'Inclusive Design', score: 67, icon: Accessibility, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { name: 'Future Readiness', score: 52, icon: Rocket, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { name: 'Brand Consistency', score: 78, icon: Fingerprint, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { name: 'SEO Structure', score: 73, icon: Code2, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
]

const WEBSITE_FINDINGS = [
  { severity: 'critical', title: 'No structured data (Schema.org) detected', category: 'Future Readiness' },
  { severity: 'critical', title: 'Missing alt text on 12 product images', category: 'Inclusive Design' },
  { severity: 'high', title: 'Primary CTA below the fold on mobile', category: 'Human Experience' },
  { severity: 'high', title: 'Trust signals missing from checkout page', category: 'Foundation' },
  { severity: 'medium', title: 'Touch targets under 44px on mobile navigation', category: 'Inclusive Design' },
  { severity: 'medium', title: 'Reading level exceeds grade 10 on pricing', category: 'Human Experience' },
  { severity: 'low', title: 'No semantic HTML landmarks detected', category: 'SEO Structure' },
]

/* ══════════════════════════════════════════════════════════════
   BRAND IDENTITY AUDIT DEMO DATA
   ══════════════════════════════════════════════════════════════ */

const BRAND_MODULES = [
  { name: 'Visual Consistency', score: 88, icon: Palette, color: 'text-[#6366F1]', bg: 'bg-[#6366F1]/10' },
  { name: 'Tone of Voice', score: 74, icon: MessageSquare, color: 'text-pink-500', bg: 'bg-pink-500/10' },
  { name: 'Professionalism', score: 91, icon: Shield, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { name: 'Value Proposition', score: 69, icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { name: 'Structure & Organisation', score: 82, icon: LayoutGrid, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { name: 'Competitive Positioning', score: 71, icon: TrendingUp, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  { name: 'Wording Quality', score: 77, icon: Type, color: 'text-rose-500', bg: 'bg-rose-500/10' },
]

const BRAND_FINDINGS = [
  { severity: 'high', title: 'Value proposition lacks supporting proof points', category: 'Value Proposition' },
  { severity: 'high', title: 'Tone shifts between formal and casual across documents', category: 'Tone of Voice' },
  { severity: 'medium', title: 'Competitive positioning is generic — no clear differentiator', category: 'Competitive Positioning' },
  { severity: 'medium', title: 'Secondary colour usage inconsistent across brand assets', category: 'Visual Consistency' },
  { severity: 'low', title: 'Headline copy relies on cliches in 3 documents', category: 'Wording Quality' },
]

/* ══════════════════════════════════════════════════════════════
   DESIGN AUDIT DEMO DATA
   ══════════════════════════════════════════════════════════════ */

const DESIGN_MODULES = [
  { name: 'Visual Hierarchy', score: 76, icon: Eye, color: 'text-[#6366F1]', bg: 'bg-[#6366F1]/10' },
  { name: 'Component Consistency', score: 83, icon: Layers, color: 'text-pink-500', bg: 'bg-pink-500/10' },
  { name: 'Accessibility', score: 62, icon: Accessibility, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { name: 'Responsive Design', score: 71, icon: Smartphone, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { name: 'Interaction Design', score: 79, icon: MousePointerClick, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { name: 'Design System Alignment', score: 85, icon: PenTool, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
]

const DESIGN_FINDINGS = [
  { severity: 'critical', title: 'Colour contrast fails WCAG AA on 4 text elements', category: 'Accessibility' },
  { severity: 'high', title: 'No visible focus states on interactive components', category: 'Accessibility' },
  { severity: 'high', title: 'Information hierarchy unclear on dashboard view', category: 'Visual Hierarchy' },
  { severity: 'medium', title: 'Touch targets under 44px on mobile breakpoint', category: 'Responsive Design' },
  { severity: 'medium', title: 'Button component has 3 inconsistent variants', category: 'Component Consistency' },
  { severity: 'low', title: 'Loading state missing on data table component', category: 'Interaction Design' },
]

/* ══════════════════════════════════════════════════════════════
   AUDIT TYPE TABS
   ══════════════════════════════════════════════════════════════ */

type AuditType = 'website' | 'brand' | 'design'

const AUDIT_TYPES = [
  { key: 'website' as const, label: 'Website audit', icon: Globe2, site: 'acme.com', score: 71 },
  { key: 'brand' as const, label: 'Brand identity audit', icon: Fingerprint, site: 'Stripe Rebrand Guidelines', score: 79 },
  { key: 'design' as const, label: 'Design audit', icon: PenTool, site: 'Checkout Redesign v2.1', score: 76 },
]

/* ══════════════════════════════════════════════════════════════
   REPORT MOCKUP COMPONENT
   ══════════════════════════════════════════════════════════════ */

function ReportMockup({
  auditType,
  site,
  score,
  modules,
  findings,
}: {
  auditType: AuditType
  site: string
  score: number
  modules: { name: string; score: number; icon: any; color: string; bg: string }[]
  findings: { severity: string; title: string; category: string }[]
}) {
  const criticalCount = findings.filter(f => f.severity === 'critical').length
  const highCount = findings.filter(f => f.severity === 'high').length

  return (
    <div className="space-y-4">
      {/* Score card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="h-1 bg-[var(--volt)]" />
        <div className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <ScoreRing score={score} />
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <h3 className="text-lg font-medium font-heading text-text mb-0.5">{site}</h3>
              <p className="text-xs text-muted mb-3">
                {findings.length} findings across {modules.length} modules
              </p>

              {/* Issue summary */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-4">
                {criticalCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {criticalCount} critical
                  </span>
                )}
                {highCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> {highCount} high
                  </span>
                )}
                <span className="text-[11px] text-muted">
                  {findings.length - criticalCount - highCount} more
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <span className="flex items-center gap-1.5 bg-surface border border-border text-text text-[11px] font-medium px-2.5 py-1.5 rounded-lg">
                  <Download size={11} /> PDF
                </span>
                <span className="flex items-center gap-1.5 bg-surface border border-border text-text text-[11px] font-medium px-2.5 py-1.5 rounded-lg">
                  <Download size={11} /> Word
                </span>
                <span className="flex items-center gap-1.5 bg-surface border border-border text-text text-[11px] font-medium px-2.5 py-1.5 rounded-lg">
                  <Share2 size={11} /> Share
                </span>
                <span className="flex items-center gap-1.5 bg-surface border border-border text-text text-[11px] font-medium px-2.5 py-1.5 rounded-lg">
                  <RefreshCw size={11} /> Re-audit
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Module scores grid */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h4 className="text-sm font-medium text-text mb-4">Module scores</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {modules.map((mod) => {
            const Icon = mod.icon
            return (
              <div key={mod.name} className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border">
                <div className={`w-8 h-8 rounded-lg ${mod.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={14} className={mod.color} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text truncate">{mod.name}</p>
                  <div className="w-full bg-border/50 rounded-full h-1 mt-1">
                    <div className={`h-full rounded-full ${scoreBg(mod.score)}`} style={{ width: `${mod.score}%`, opacity: 0.8 }} />
                  </div>
                </div>
                <span className={`text-sm font-medium flex-shrink-0 ${scoreColor(mod.score)}`}>{mod.score}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top findings */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-text">Top findings</h4>
          <span className="text-[11px] text-muted">Ranked by severity</span>
        </div>
        <div className="space-y-2">
          {findings.slice(0, 5).map((finding, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-surface border border-border">
              <SeverityDot severity={finding.severity} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text leading-snug">{finding.title}</p>
                <p className="text-[11px] text-muted mt-0.5">{finding.category}</p>
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted flex-shrink-0">
                {finding.severity}
              </span>
            </div>
          ))}
        </div>
        {findings.length > 5 && (
          <p className="text-xs text-muted mt-3 text-center">
            + {findings.length - 5} more findings in the full report
          </p>
        )}
      </div>

      {/* Recommendation preview */}
      <div className="rounded-xl border border-[var(--volt)]/20 bg-[var(--volt)]/[0.03] p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--volt)]/10 flex items-center justify-center flex-shrink-0">
            <Lightbulb size={14} className="text-[var(--volt)]" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-text mb-1">Top recommendation</h4>
            <p className="text-sm text-muted leading-relaxed">
              {auditType === 'website' && 'Add JSON-LD structured data for Organization, Product, and FAQPage schemas. This is the highest-impact fix — essential for AI discoverability and expected to improve your Future Readiness score by 25+ points.'}
              {auditType === 'brand' && 'Add specific proof points (metrics, case studies, testimonials) to support each value proposition claim. Generic statements reduce trust and make differentiation harder.'}
              {auditType === 'design' && 'Fix colour contrast on the 4 failing text elements — they currently sit at 3.2:1 ratio against WCAG AA minimum of 4.5:1. This blocks accessibility compliance.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════���══
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */

export default function DemoReportContent() {
  const [activeType, setActiveType] = useState<AuditType>('website')

  return (
    <main id="main-content" className="relative flex-1">
      {/* Background */}
      <div className="fixed inset-0" aria-hidden="true">
        <img src="/gradients/bg-hero.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-80 hidden dark:block" />
        <div className="absolute inset-0 bg-gradient-to-b from-surface via-transparent to-surface" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto pt-20 sm:pt-36 pb-16 px-4 sm:px-6">
        {/* ── Page header ── */}
        <div className="text-center mb-12">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-muted mb-4">
            Sample reports
          </p>
          <h1 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] font-bold text-text mb-4" style={{ lineHeight: '1.1' }}>
            See what ClearUX <span className="text-lime-gradient">delivers.</span>
          </h1>
          <p className="text-muted text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Three audit types, one standard of depth. Explore how each report surfaces actionable insights with evidence, severity rankings, and specific recommendations.
          </p>
        </div>

        {/* ── Audit type tabs ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mb-10">
          {AUDIT_TYPES.map((type) => {
            const Icon = type.icon
            const isActive = activeType === type.key
            return (
              <button
                key={type.key}
                onClick={() => setActiveType(type.key)}
                className={`flex-1 flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left ${
                  isActive
                    ? 'border-[var(--volt)]/40 bg-[var(--volt)]/[0.05] shadow-sm'
                    : 'border-border bg-card hover:border-border hover:bg-card'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isActive ? 'bg-[var(--volt)]/15' : 'bg-surface'
                }`}>
                  <Icon size={16} className={isActive ? 'text-[var(--volt)]' : 'text-muted'} strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${isActive ? 'text-text' : 'text-muted'}`}>{type.label}</p>
                  <p className="text-[11px] text-muted truncate">{type.site}</p>
                </div>
                {isActive && (
                  <span className="ml-auto text-sm font-medium text-[var(--volt)] flex-shrink-0">{type.score}/100</span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Report mockup ── */}
        {activeType === 'website' && (
          <ReportMockup
            auditType="website"
            site="acme.com"
            score={71}
            modules={WEBSITE_MODULES}
            findings={WEBSITE_FINDINGS}
          />
        )}

        {activeType === 'brand' && (
          <ReportMockup
            auditType="brand"
            site="Stripe Rebrand Guidelines"
            score={79}
            modules={BRAND_MODULES}
            findings={BRAND_FINDINGS}
          />
        )}

        {activeType === 'design' && (
          <ReportMockup
            auditType="design"
            site="Checkout Redesign v2.1"
            score={76}
            modules={DESIGN_MODULES}
            findings={DESIGN_FINDINGS}
          />
        )}

        {/* ── What you get strip ── */}
        <div className="mt-10 rounded-xl border border-border bg-card p-5 sm:p-6">
          <h3 className="text-sm font-medium text-text mb-4">Every audit includes</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: FileText, label: 'PDF and Word exports', desc: 'Professional reports ready for stakeholders' },
              { icon: Share2, label: 'Shareable link', desc: 'One link for your full report — no account needed to view' },
              { icon: RefreshCw, label: 'Re-audit and track', desc: 'Verify fixes and watch your score improve over time' },
              { icon: Search, label: 'Dig deeper mode', desc: 'Run a deeper analysis on specific modules for more findings' },
            ].map((item, i) => {
              const Icon = item.icon
              return (
                <div key={i} className="flex flex-col gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[var(--volt)]/10 flex items-center justify-center">
                    <Icon size={14} className="text-[var(--volt)]" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-medium text-text">{item.label}</p>
                  <p className="text-xs text-muted leading-relaxed">{item.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          FINAL CTA
          ══════════════════════════════════════════════════ */}
      <section className="relative z-10 py-28 sm:py-36 overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 text-center">
          <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-bold text-text mb-4" style={{ lineHeight: '1.1' }}>
            Ready for your own <span className="text-lime-gradient">report?</span>
          </h2>
          <p className="text-muted text-base md:text-lg max-w-md mx-auto leading-relaxed mb-10">
            Your first audit is free. No credit card, no commitment — actionable insights in minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <SmartCta iconSize={15} />
            <Link
              href="/how-it-works"
              className="group inline-flex items-center justify-center gap-2.5 px-7 py-[1.2rem] rounded-full border border-border text-text text-base font-medium transition-all hover:border-border whitespace-nowrap min-h-[48px]"
            >
              How it works
              <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
