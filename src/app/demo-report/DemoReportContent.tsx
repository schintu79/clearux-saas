'use client'

import Link from 'next/link'
import {
  ArrowRight,
  ShieldAlert,
  Brain,
  Sparkles,
  Target,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Info,
  TrendingUp,
} from 'lucide-react'

/* ── Demo data ────────────────────────────────────────── */
const DEMO_SCORE = 71
const DEMO_SITE = 'acme.com'

const CATEGORIES = [
  { name: 'Visual Design', score: 82, pillar: 'Foundation' },
  { name: 'Value Proposition', score: 75, pillar: 'Foundation' },
  { name: 'Navigation', score: 88, pillar: 'Foundation' },
  { name: 'Content Quality', score: 79, pillar: 'Foundation' },
  { name: 'CTAs & Conversion', score: 64, pillar: 'Human Experience' },
  { name: 'Trust & Credibility', score: 58, pillar: 'Human Experience' },
  { name: 'Ethical UX', score: 91, pillar: 'Human Experience' },
  { name: 'Emotional Design', score: 72, pillar: 'Human Experience' },
  { name: 'Accessibility', score: 55, pillar: 'Inclusive Design' },
  { name: 'Cognitive Accessibility', score: 68, pillar: 'Inclusive Design' },
  { name: 'Digital Wellbeing', score: 85, pillar: 'Inclusive Design' },
  { name: 'Mobile Experience', score: 61, pillar: 'Inclusive Design' },
  { name: 'Performance', score: 77, pillar: 'Future Readiness' },
  { name: 'AI Discoverability', score: 42, pillar: 'Future Readiness' },
  { name: 'AI Agent Readiness', score: 38, pillar: 'Future Readiness' },
  { name: 'Cultural Sensitivity', score: 90, pillar: 'Future Readiness' },
]

const DEMO_FINDINGS = [
  {
    severity: 'critical',
    title: 'Missing alt text on 12 product images',
    category: 'Accessibility',
    description: 'Screen readers cannot describe these images to visually impaired users. This also hurts SEO image indexing.',
    fix: 'Add descriptive alt attributes to all <img> elements. Use the product name and key visual details.',
  },
  {
    severity: 'critical',
    title: 'No structured data (Schema.org) detected',
    category: 'AI Discoverability',
    description: 'AI assistants and search engines cannot reliably parse your product information, pricing, or FAQs.',
    fix: 'Add JSON-LD structured data for Organization, Product, and FAQPage schemas.',
  },
  {
    severity: 'high',
    title: 'Primary CTA below the fold on mobile',
    category: 'CTAs & Conversion',
    description: 'The main call-to-action button requires scrolling on screens under 768px, reducing conversion rates by an estimated 15-25%.',
    fix: 'Move the primary CTA into the first viewport on mobile. Consider a sticky CTA bar.',
  },
  {
    severity: 'high',
    title: 'Trust signals missing from checkout page',
    category: 'Trust & Credibility',
    description: 'No security badges, payment icons, or guarantee messaging visible during the checkout flow.',
    fix: 'Add SSL badge, accepted payment icons, and a satisfaction guarantee near the checkout button.',
  },
  {
    severity: 'medium',
    title: 'Touch targets under 44px on mobile navigation',
    category: 'Mobile Experience',
    description: 'Navigation links measure 32px tap targets, below WCAG 2.5.5 minimum of 44px, causing mis-taps on mobile.',
    fix: 'Increase all interactive elements to minimum 44x44px touch targets with adequate spacing.',
  },
  {
    severity: 'medium',
    title: 'Reading level exceeds grade 10 on pricing page',
    category: 'Cognitive Accessibility',
    description: 'Complex sentence structure and jargon make the pricing page harder to understand for a general audience.',
    fix: 'Simplify copy to grade 8 reading level. Replace jargon with plain language. Use shorter sentences.',
  },
  {
    severity: 'low',
    title: 'No semantic HTML landmarks detected',
    category: 'AI Agent Readiness',
    description: 'The page lacks <main>, <nav>, and <article> elements, making it harder for AI agents to parse content structure.',
    fix: 'Wrap content in semantic HTML5 elements: <main> for primary content, <nav> for navigation, <article> for standalone content.',
  },
]

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)
  const color = score >= 80 ? '#84CC16' : score >= 60 ? '#EAB308' : '#EF4444'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={6} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-heading text-3xl font-light text-white">{score}</span>
      </div>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { bg: string; text: string; icon: typeof AlertTriangle }> = {
    critical: { bg: 'bg-red-500/10', text: 'text-red-400', icon: AlertTriangle },
    high: { bg: 'bg-orange-500/10', text: 'text-orange-400', icon: AlertTriangle },
    medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: Info },
    low: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: Info },
  }
  const c = config[severity] || config.medium
  const Icon = c.icon

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <Icon size={12} />
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  )
}

/* ── Main component ───────────────────────────────────── */
export default function DemoReportContent() {
  const pillars = ['Foundation', 'Human Experience', 'Inclusive Design', 'Future Readiness']
  const pillarIcons: Record<string, typeof Eye> = {
    'Foundation': Eye,
    'Human Experience': Target,
    'Inclusive Design': Brain,
    'Future Readiness': Sparkles,
  }

  return (
    <main id="main-content" className="relative flex-1">
      {/* Background */}
      <div className="absolute inset-0" aria-hidden="true">
        <img src="/gradients/bg-hero.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#111114] via-transparent to-[#111114]" />
      </div>

      {/* ── Header ── */}
      <section className="relative z-10 pt-28 sm:pt-36 pb-16">
        <div className="max-w-5xl mx-auto px-6 sm:px-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-3 py-1 rounded-full bg-[#84CC16]/10 text-[#84CC16] text-xs font-medium">
              Sample Report
            </span>
            <span className="text-xs text-white/40">Visual demo only</span>
          </div>
          <h1 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] font-light text-white mb-3" style={{ lineHeight: '1.1' }}>
            UX Audit: <span className="text-lime-gradient">{DEMO_SITE}</span>
          </h1>
          <p className="text-base text-white/60 leading-relaxed max-w-2xl">
            This is a visual demonstration of what your ClearUX audit report looks like. Real reports include interactive findings, downloadable PDF and Word documents, and progress tracking.
          </p>
        </div>
      </section>

      {/* ── Overall Score ── */}
      <section className="relative z-10 pb-16">
        <div className="max-w-5xl mx-auto px-6 sm:px-10">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-8 sm:p-10">
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <ScoreRing score={DEMO_SCORE} size={140} />
              <div className="flex-1 text-center sm:text-left">
                <h2 className="font-heading text-2xl font-medium text-white mb-2">Overall Score: {DEMO_SCORE}/100</h2>
                <p className="text-sm text-white/60 leading-relaxed mb-4">
                  7 findings across 16 categories. 2 critical issues require immediate attention. Estimated improvement potential: +20-25 points with critical fixes.
                </p>
                <div className="flex flex-wrap gap-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-red-400"><AlertTriangle size={12} /> 2 Critical</span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-orange-400"><AlertTriangle size={12} /> 2 High</span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-yellow-400"><Info size={12} /> 2 Medium</span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-blue-400"><Info size={12} /> 1 Low</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Category Scores by Pillar ── */}
      <section className="relative z-10 pb-16">
        <div className="max-w-5xl mx-auto px-6 sm:px-10">
          <h2 className="font-heading text-xl font-medium text-white mb-6">Scores by Category</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {pillars.map((pillar) => {
              const PillarIcon = pillarIcons[pillar]
              const cats = CATEGORIES.filter(c => c.pillar === pillar)
              const avg = Math.round(cats.reduce((sum, c) => sum + c.score, 0) / cats.length)
              return (
                <div key={pillar} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-lg bg-[#84CC16]/10 flex items-center justify-center">
                      <PillarIcon size={18} className="text-[#84CC16]" />
                    </div>
                    <div>
                      <h3 className="font-heading text-sm font-medium text-white">{pillar}</h3>
                      <p className="text-xs text-white/40">Avg: {avg}/100</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {cats.map((cat) => {
                      const color = cat.score >= 80 ? 'bg-[#84CC16]' : cat.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      return (
                        <div key={cat.name}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-white/60">{cat.name}</span>
                            <span className="text-xs font-medium text-white/80">{cat.score}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/[0.06]">
                            <div className={`h-full rounded-full ${color}`} style={{ width: `${cat.score}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Findings ── */}
      <section className="relative z-10 pb-16">
        <div className="max-w-5xl mx-auto px-6 sm:px-10">
          <h2 className="font-heading text-xl font-medium text-white mb-6">Top Findings</h2>
          <div className="space-y-4">
            {DEMO_FINDINGS.map((finding, i) => (
              <div key={i} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-6">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <SeverityBadge severity={finding.severity} />
                  <span className="text-xs text-white/40">{finding.category}</span>
                </div>
                <h3 className="font-heading text-base font-medium text-white mb-2">{finding.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed mb-4">{finding.description}</p>
                <div className="rounded-xl bg-[#84CC16]/[0.05] border border-[#84CC16]/10 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-[#84CC16] mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-[#84CC16]/80 leading-relaxed"><span className="font-medium text-[#84CC16]">Fix:</span> {finding.fix}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 pb-24 sm:pb-32">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 text-center">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-10 sm:p-14">
            <TrendingUp size={32} className="text-[#84CC16] mx-auto mb-4" />
            <h2 className="font-heading text-2xl sm:text-3xl font-light text-white mb-3">
              Ready to audit <span className="text-lime-gradient">your site?</span>
            </h2>
            <p className="text-base text-white/60 leading-relaxed max-w-lg mx-auto mb-8">
              Get the same depth of analysis for your own website. Your first audit is free — no credit card required.
            </p>
            <Link
              href="/register"
              className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-white text-[#111114] text-base font-medium transition-all hover:bg-white/90 min-h-[52px]"
            >
              Start Free Audit
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
