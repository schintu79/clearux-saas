'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  TrendingUp,
  Download,
  Share2,
  RefreshCw,
  Search,
  ChevronDown,
  Eye,
  Target,
  Map,
  Type,
  MousePointerClick,
  Shield,
  Heart,
  Brain,
  Sparkles,
  Smartphone,
  Gauge,
  Globe,
  Zap,
  Lightbulb,
  Accessibility,
  Scale,
  ExternalLink,
  Copy,
} from 'lucide-react'

/* ══════════════════════════════════════════════════════════════
   DEMO DATA — mirrors real dashboard structure
   ══════════════════════════════════════════════════════════════ */

const DEMO_SCORE = 71
const DEMO_SITE = 'acme.com'
const DEMO_URL = 'https://www.acme.com'
const DEMO_DATE = 'May 5, 2026, 02:14 PM'
const DEMO_TOTAL_ISSUES = 7

const PILLAR_CONFIG = [
  {
    name: 'Foundation',
    gradient: 'from-[#6366F1] to-[#5A4A84]',
    gradientSubtle: 'from-[#6366F1]/5 to-[#6366F1]/10',
    border: 'border-[#6366F1]/20',
    iconBg: 'bg-[#6366F1]/10',
    iconColor: 'text-[#6366F1]',
    badgeBg: 'bg-[#6366F1]',
    scoreBg: 'bg-[#6366F1]',
    range: [0, 4] as [number, number],
  },
  {
    name: 'Human Experience',
    gradient: 'from-pink-500 to-pink-600',
    gradientSubtle: 'from-pink-500/5 to-pink-500/10',
    border: 'border-pink-500/20',
    iconBg: 'bg-pink-500/10',
    iconColor: 'text-pink-500',
    badgeBg: 'bg-pink-500',
    scoreBg: 'bg-pink-500',
    range: [4, 8] as [number, number],
  },
  {
    name: 'Inclusive Design',
    gradient: 'from-amber-500 to-amber-600',
    gradientSubtle: 'from-amber-500/5 to-amber-500/10',
    border: 'border-amber-500/20',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    badgeBg: 'bg-amber-500',
    scoreBg: 'bg-amber-500',
    range: [8, 12] as [number, number],
  },
  {
    name: 'Future Readiness',
    gradient: 'from-[#22C55E] to-[#236B43]',
    gradientSubtle: 'from-[#22C55E]/5 to-[#22C55E]/10',
    border: 'border-[#22C55E]/20',
    iconBg: 'bg-[#22C55E]/10',
    iconColor: 'text-[#22C55E]',
    badgeBg: 'bg-[#22C55E]',
    scoreBg: 'bg-[#22C55E]',
    range: [12, 16] as [number, number],
  },
]

const PILLAR_ICONS = [Scale, Heart, Accessibility, Brain]

const CATEGORY_ICONS = [
  Eye, Target, Map, Type,
  MousePointerClick, Shield, AlertTriangle, Heart,
  Accessibility, Brain, Sparkles, Smartphone,
  Gauge, Search, Zap, Globe,
]

const CATEGORIES = [
  { name: 'Visual Design', score: 82, summary: 'Clean layout with consistent spacing. Typography hierarchy is clear but could use stronger visual anchors on key pages.' },
  { name: 'Value Proposition', score: 75, summary: 'Hero messaging is clear but lacks supporting evidence. Consider adding metrics or testimonials above the fold.' },
  { name: 'Navigation', score: 88, summary: 'Well-structured navigation with clear labels. Mobile hamburger menu is accessible and keyboard-navigable.' },
  { name: 'Content Quality', score: 79, summary: 'Copy is generally well-written but some pages exceed grade 10 reading level. Simplify pricing and legal pages.' },
  { name: 'CTAs & Conversion', score: 64, summary: 'Primary CTA is below the fold on mobile. Button contrast is adequate but could be stronger.' },
  { name: 'Trust & Credibility', score: 58, summary: 'Missing security badges on checkout. No visible reviews or testimonials on the pricing page.' },
  { name: 'Ethical UX', score: 91, summary: 'No dark patterns detected. Cancellation flow is transparent. Cookie consent is properly implemented.' },
  { name: 'Emotional Design', score: 72, summary: 'Microcopy is functional but lacks personality. Error messages could be more helpful and encouraging.' },
  { name: 'Accessibility', score: 55, summary: 'Missing alt text on 12 images. Some interactive elements lack ARIA labels. Color contrast passes AA but fails AAA.' },
  { name: 'Cognitive Accessibility', score: 68, summary: 'Reading level too high on pricing page. Some forms lack clear error messaging and progress indicators.' },
  { name: 'Digital Wellbeing', score: 85, summary: 'No autoplay videos. Notifications are non-intrusive. Session timeouts are generous and well-communicated.' },
  { name: 'Mobile Experience', score: 61, summary: 'Touch targets under 44px in navigation. Some horizontal scroll on small screens. Forms could be better optimized.' },
  { name: 'Performance', score: 77, summary: 'LCP is 2.8s (should be under 2.5s). Images are mostly optimized but hero image could be lazy-loaded.' },
  { name: 'AI Discoverability', score: 42, summary: 'No structured data detected. Missing JSON-LD schemas for Organization, Product, and FAQ.' },
  { name: 'AI Agent Readiness', score: 38, summary: 'No semantic HTML landmarks. Missing <main>, <nav>, <article> elements. AI agents cannot reliably parse content.' },
  { name: 'Cultural Sensitivity', score: 90, summary: 'Content is inclusive and culturally neutral. No problematic imagery or language detected.' },
]

const DEMO_FINDINGS = [
  {
    severity: 'critical' as const,
    title: 'Missing alt text on 12 product images',
    category: 'Accessibility',
    pillarIdx: 2,
    description: 'Screen readers cannot describe these images to visually impaired users. This also hurts SEO image indexing.',
    recommendation: 'Add descriptive alt attributes to all <img> elements. Use the product name and key visual details.',
    impact: 'Fixing this could improve your Accessibility score by 15-20 points and boost SEO rankings.',
    page_url: 'https://www.acme.com/products',
  },
  {
    severity: 'critical' as const,
    title: 'No structured data (Schema.org) detected',
    category: 'AI Discoverability',
    pillarIdx: 3,
    description: 'AI assistants and search engines cannot reliably parse your product information, pricing, or FAQs.',
    recommendation: 'Add JSON-LD structured data for Organization, Product, and FAQPage schemas.',
    impact: 'Essential for AI discoverability. Expected +25 point improvement in AI Discoverability score.',
    page_url: 'https://www.acme.com',
  },
  {
    severity: 'high' as const,
    title: 'Primary CTA below the fold on mobile',
    category: 'CTAs & Conversion',
    pillarIdx: 1,
    description: 'The main call-to-action button requires scrolling on screens under 768px, reducing conversion rates by an estimated 15-25%.',
    recommendation: 'Move the primary CTA into the first viewport on mobile. Consider a sticky CTA bar.',
    impact: 'Could increase mobile conversion rate by 15-25% based on industry benchmarks.',
    page_url: 'https://www.acme.com',
  },
  {
    severity: 'high' as const,
    title: 'Trust signals missing from checkout page',
    category: 'Trust & Credibility',
    pillarIdx: 1,
    description: 'No security badges, payment icons, or guarantee messaging visible during the checkout flow.',
    recommendation: 'Add SSL badge, accepted payment icons, and a satisfaction guarantee near the checkout button.',
    impact: 'Trust signals can reduce cart abandonment by 10-15%.',
    page_url: 'https://www.acme.com/checkout',
  },
  {
    severity: 'medium' as const,
    title: 'Touch targets under 44px on mobile navigation',
    category: 'Mobile Experience',
    pillarIdx: 2,
    description: 'Navigation links measure 32px tap targets, below WCAG 2.5.5 minimum of 44px, causing mis-taps on mobile.',
    recommendation: 'Increase all interactive elements to minimum 44x44px touch targets with adequate spacing.',
    impact: 'Improving touch targets reduces frustration and improves mobile task completion rates.',
    page_url: 'https://www.acme.com',
  },
  {
    severity: 'medium' as const,
    title: 'Reading level exceeds grade 10 on pricing page',
    category: 'Cognitive Accessibility',
    pillarIdx: 2,
    description: 'Complex sentence structure and jargon make the pricing page harder to understand for a general audience.',
    recommendation: 'Simplify copy to grade 8 reading level. Replace jargon with plain language. Use shorter sentences.',
    impact: 'Simpler copy improves comprehension and can increase pricing page conversion by 8-12%.',
    page_url: 'https://www.acme.com/pricing',
  },
  {
    severity: 'low' as const,
    title: 'No semantic HTML landmarks detected',
    category: 'AI Agent Readiness',
    pillarIdx: 3,
    description: 'The page lacks <main>, <nav>, and <article> elements, making it harder for AI agents to parse content structure.',
    recommendation: 'Wrap content in semantic HTML5 elements: <main> for primary content, <nav> for navigation, <article> for standalone content.',
    impact: 'Semantic HTML improves both accessibility scores and AI agent compatibility.',
    page_url: 'https://www.acme.com',
  },
]

// Demo score trend data (3 audits)
const DEMO_TREND = [
  { date: '2026-03-12', score: 54 },
  { date: '2026-04-08', score: 63 },
  { date: '2026-05-05', score: 71 },
]

// Demo checkpoints per category (4 each = 64 total)
const DEMO_CHECKPOINTS: Record<string, string[]> = {
  'Visual Design': ['Consistent typography', 'Color harmony', 'Visual hierarchy', 'White space balance'],
  'Value Proposition': ['Hero messaging clarity', 'Benefit communication', 'Supporting evidence', 'Differentiation'],
  'Navigation': ['Menu structure', 'Breadcrumb trails', 'Search functionality', 'Keyboard navigation'],
  'Content Quality': ['Reading level', 'Grammar & spelling', 'Content freshness', 'Tone consistency'],
  'CTAs & Conversion': ['CTA visibility', 'Button contrast', 'Action-oriented copy', 'Above-fold placement'],
  'Trust & Credibility': ['Security badges', 'Social proof', 'Contact information', 'Privacy policy'],
  'Ethical UX': ['Dark pattern scan', 'Cancellation transparency', 'Consent mechanisms', 'Fair pricing display'],
  'Emotional Design': ['Microcopy quality', 'Error message tone', 'Delight moments', 'Loading state feedback'],
  'Accessibility': ['Alt text coverage', 'ARIA labels', 'Color contrast (AA)', 'Focus indicators'],
  'Cognitive Accessibility': ['Reading level check', 'Form error messaging', 'Progress indicators', 'Information chunking'],
  'Digital Wellbeing': ['Autoplay behavior', 'Notification frequency', 'Session management', 'Dark mode support'],
  'Mobile Experience': ['Touch target sizing', 'Responsive layout', 'Form optimization', 'Scroll behavior'],
  'Performance': ['Largest Contentful Paint', 'Image optimization', 'Bundle size', 'Caching strategy'],
  'AI Discoverability': ['JSON-LD schemas', 'Open Graph tags', 'Sitemap.xml', 'robots.txt'],
  'AI Agent Readiness': ['Semantic HTML', 'Landmark elements', 'Heading hierarchy', 'Link text quality'],
  'Cultural Sensitivity': ['Inclusive language', 'Diverse imagery', 'Localization readiness', 'Cultural neutrality'],
}

/* ══════════════════════════════════════════════════════════════
   Helper components
   ══════════════════════════════════════════════════════════════ */

function scoreColor(s: number) {
  if (s >= 70) return 'text-emerald-400'
  if (s >= 40) return 'text-amber-400'
  return 'text-red-400'
}

function scoreLabel(s: number) {
  if (s >= 90) return 'Excellent'
  if (s >= 70) return 'Good'
  if (s >= 50) return 'Needs Work'
  return 'Critical'
}

function ScoreRing({ score, size = 110 }: { score: number; size?: number }) {
  const strokeWidth = 7
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)
  const color = score >= 70 ? '#22C55E' : score >= 40 ? '#EAB308' : '#EF4444'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
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
  const config: Record<string, { dot: string; text: string }> = {
    critical: { dot: 'bg-red-500', text: 'text-red-400' },
    high: { dot: 'bg-orange-500', text: 'text-orange-400' },
    medium: { dot: 'bg-yellow-500', text: 'text-yellow-400' },
    low: { dot: 'bg-blue-500', text: 'text-blue-400' },
  }
  const c = config[severity] || config.medium

  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider ${c.text}`}>
      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      {severity}
    </span>
  )
}

/* ── Score Over Time Chart (static SVG demo) ── */
function DemoScoreChart() {
  const [expanded, setExpanded] = useState(false)

  const W = 480, H = 140, PAD_L = 34, PAD_R = 16, PAD_T = 20, PAD_B = 26
  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_T - PAD_B
  const minScore = 40, maxScore = 85
  const range = maxScore - minScore

  const points = DEMO_TREND.map((t, i) => ({
    x: PAD_L + (i / (DEMO_TREND.length - 1)) * chartW,
    y: PAD_T + chartH - ((t.score - minScore) / range) * chartH,
    score: t.score,
    date: t.date,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = `${pathD} L ${points[points.length - 1].x} ${PAD_T + chartH} L ${points[0].x} ${PAD_T + chartH} Z`

  const gridLines = 3
  const gridScores = Array.from({ length: gridLines + 1 }, (_, i) => Math.round(minScore + (range * i) / gridLines))

  return (
    <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-2.5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-7 h-7 rounded-lg bg-[#6366F1]/10 flex items-center justify-center flex-shrink-0">
          <TrendingUp size={14} className="text-[#6366F1]" />
        </div>
        <div className="flex-1 text-left">
          <span className="text-sm font-medium text-white">Score Over Time</span>
          <span className="text-[10px] text-white/40 ml-2">3 audits · {DEMO_SITE}</span>
        </div>
        <span className="text-xs font-medium text-emerald-400">+17 pts</span>
        <ChevronDown size={14} className={`text-white/40 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-white/[0.04]">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
            {gridScores.map((s, i) => {
              const y = PAD_T + chartH - ((s - minScore) / range) * chartH
              return (
                <g key={i}>
                  <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" strokeDasharray="3,3" />
                  <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.35)" fontFamily="DM Sans">{s}</text>
                </g>
              )
            })}
            <defs>
              <linearGradient id="demoAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366F1" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#6366F1" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={areaD} fill="url(#demoAreaGrad)" />
            <path d={pathD} fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => {
              const isLast = i === points.length - 1
              return (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r={isLast ? 4 : 3} fill={isLast ? '#6366F1' : 'transparent'} stroke="#6366F1" strokeWidth="2" />
                  {isLast && (
                    <g>
                      <rect x={p.x - 13} y={p.y - 20} width="26" height="14" rx="4" fill="#6366F1" />
                      <text x={p.x} y={p.y - 10.5} textAnchor="middle" fontSize="8" fontWeight="500" fill="white" fontFamily="DM Sans">{p.score}</text>
                    </g>
                  )}
                </g>
              )
            })}
            {points.map((p, i) => {
              const d = new Date(p.date)
              const label = `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`
              return (
                <text key={i} x={p.x} y={H - 4} textAnchor="middle" fontSize="7.5" fill="rgba(255,255,255,0.35)" fontFamily="DM Sans">{label}</text>
              )
            })}
          </svg>
        </div>
      )}
    </div>
  )
}

/* ── Checkpoint Health Panel ── */
function DemoCheckpointHealth() {
  const [expandedCat, setExpandedCat] = useState<string | null>(null)

  return (
    <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-[#84CC16]" />
          <h3 className="text-xs font-medium text-white">64-Checkpoint Health</h3>
          <span className="text-[10px] text-white/40 ml-auto">7 issues across 16 categories</span>
        </div>
      </div>
      <div className="divide-y divide-white/[0.03]">
        {CATEGORIES.map((cat, catIdx) => {
          const checkpoints = DEMO_CHECKPOINTS[cat.name] || []
          const catFindings = DEMO_FINDINGS.filter(f => f.category === cat.name)
          const failCount = Math.min(catFindings.length, checkpoints.length)
          const passCount = checkpoints.length - failCount
          const isExpanded = expandedCat === cat.name

          return (
            <div key={catIdx}>
              <button
                onClick={() => setExpandedCat(isExpanded ? null : cat.name)}
                className="w-full px-5 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors text-left"
              >
                <span className={`text-[11px] font-medium w-6 text-right ${scoreColor(cat.score)}`}>{cat.score}</span>
                <span className="text-[11px] font-medium text-white flex-1 truncate">{cat.name}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {passCount > 0 && <span className="text-[9px] font-medium text-emerald-400">{passCount} pass</span>}
                  {failCount > 0 && <span className="text-[9px] font-medium text-red-500">{failCount} fail</span>}
                </div>
                <ChevronDown size={12} className={`text-white/40 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
              {isExpanded && (
                <div className="px-5 pb-3 space-y-1.5">
                  {checkpoints.map((checkpoint, i) => {
                    const hasFinding = i < failCount
                    return (
                      <div key={i} className={`flex items-start gap-2.5 py-1.5 px-3 rounded-lg ${hasFinding ? 'bg-red-900/[0.08]' : 'bg-emerald-500/[0.05]'}`}>
                        {hasFinding ? (
                          <AlertTriangle size={11} className="text-red-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 size={11} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                        )}
                        <p className={`text-[11px] font-medium flex-1 ${hasFinding ? 'text-red-400' : 'text-emerald-400'}`}>
                          {checkpoint}
                        </p>
                        <span className={`text-[9px] font-medium flex-shrink-0 ${hasFinding ? 'text-red-500' : 'text-emerald-500'}`}>
                          {hasFinding ? 'Fail' : 'Pass'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Finding Card (collapsible) ── */
function DemoFindingCard({ finding }: { finding: typeof DEMO_FINDINGS[0] }) {
  const [open, setOpen] = useState(false)
  const pillar = PILLAR_CONFIG[finding.pillarIdx]

  const sevConfig: Record<string, { border: string; bg: string; dot: string; text: string }> = {
    critical: { border: 'border-white/[0.06]', bg: 'bg-white/[0.02]', dot: 'bg-red-500', text: 'text-red-400' },
    high: { border: 'border-white/[0.06]', bg: 'bg-white/[0.02]', dot: 'bg-orange-500', text: 'text-orange-400' },
    medium: { border: 'border-white/[0.06]', bg: 'bg-white/[0.02]', dot: 'bg-yellow-500', text: 'text-yellow-400' },
    low: { border: 'border-white/[0.06]', bg: 'bg-white/[0.02]', dot: 'bg-blue-500', text: 'text-blue-400' },
  }
  const sev = sevConfig[finding.severity] || sevConfig.medium

  return (
    <div className={`rounded-xl border ${sev.border} ${sev.bg} overflow-hidden transition-all`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className={`w-2 h-2 rounded-full ${sev.dot} flex-shrink-0 mt-1.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <SeverityBadge severity={finding.severity} />
            <span className="inline-flex items-center gap-1 text-[11px] text-white/40 max-w-[260px] truncate">
              <ExternalLink size={10} className="flex-shrink-0" />
              {finding.page_url.replace('https://www.', '')}
            </span>
          </div>
          <h4 className="font-medium text-white text-sm leading-snug">{finding.title}</h4>
        </div>
        <ChevronDown size={16} className={`text-white/40 flex-shrink-0 mt-1 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-white/[0.04] mx-4 space-y-3">
          <p className="text-white/50 text-sm leading-relaxed pt-3">{finding.description}</p>

          {finding.recommendation && (
            <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.04]">
              <div className="flex gap-2.5">
                <Lightbulb size={14} className={`flex-shrink-0 mt-0.5 ${pillar.iconColor}`} />
                <div>
                  <p className="text-[11px] font-medium text-white mb-1">Recommendation</p>
                  <p className="text-sm text-white/50 leading-relaxed">{finding.recommendation}</p>
                </div>
              </div>
            </div>
          )}

          {finding.impact && (
            <div className="flex items-start gap-2.5 p-3 bg-emerald-500/[0.05] rounded-lg border border-emerald-500/15">
              <TrendingUp size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-medium text-white mb-0.5">Expected Impact</p>
                <p className="text-sm text-emerald-400 leading-relaxed">{finding.impact}</p>
              </div>
            </div>
          )}

          {/* Status toggle (demo only — non-functional) */}
          <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-white uppercase tracking-wide">Status</span>
              <div className="flex flex-wrap gap-1.5">
                {['Open', 'In Progress', 'Fixed', 'Backlog'].map((s, i) => (
                  <span
                    key={s}
                    className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg ${
                      i === 0
                        ? 'bg-white/[0.04] text-white/60 ring-1 ring-white/10'
                        : 'text-white/30'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-gray-400' : 'bg-white/10'}`} />
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════════════ */

export default function DemoReportContent() {
  const [activeTab, setActiveTab] = useState<'overview' | 'findings' | 'pages'>('overview')

  const severityCounts = {
    critical: DEMO_FINDINGS.filter(f => f.severity === 'critical').length,
    high: DEMO_FINDINGS.filter(f => f.severity === 'high').length,
    medium: DEMO_FINDINGS.filter(f => f.severity === 'medium').length,
    low: DEMO_FINDINGS.filter(f => f.severity === 'low').length,
  }

  return (
    <main id="main-content" className="relative flex-1">
      {/* Background */}
      <div className="absolute inset-0" aria-hidden="true">
        <img src="/gradients/bg-hero.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#111114] via-transparent to-[#111114]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto pt-28 sm:pt-36 pb-16 px-4 sm:px-6">
        {/* ── Sample report banner ── */}
        <div className="flex items-center gap-3 mb-6">
          <span className="px-3 py-1 rounded-full bg-[#84CC16]/10 text-[#84CC16] text-xs font-medium">
            Sample Report
          </span>
          <span className="text-xs text-white/40">This is a visual demo of the ClearUX dashboard</span>
        </div>

        {/* ── Back link (demo) ── */}
        <div className="flex items-center gap-1.5 text-sm text-white/40 mb-6">
          <span className="text-white/30">&#8592;</span>
          <span>Back to {DEMO_SITE} Audits</span>
        </div>

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-medium font-heading text-white mb-1 truncate">
              {DEMO_SITE}
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-white/40 text-sm">{DEMO_DATE}</p>
              <span className="inline-flex items-center gap-1 text-xs text-[#84CC16]">
                <ExternalLink size={11} />
                Visit site
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 border border-white/[0.08]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="3" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="8" cy="13" r="1.5"/></svg>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════
            HERO SCORE CARD
            ════════════════════════════════════════════════ */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden mb-6">
          {/* Brand accent */}
          <div className="h-1.5 bg-[#84CC16]" />

          <div className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
              <div className="flex-shrink-0">
                <ScoreRing score={DEMO_SCORE} size={110} />
              </div>

              <div className="flex-1 min-w-0 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1 flex-wrap">
                  <h2 className="text-xl font-medium font-heading text-white">Overall Score</h2>
                  <span className={`text-sm font-medium px-2.5 py-0.5 rounded-full ${
                    DEMO_SCORE >= 70 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {scoreLabel(DEMO_SCORE)}
                  </span>
                </div>

                {/* Pillar mini-scores */}
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-4 gap-y-1.5 mt-3">
                  {PILLAR_CONFIG.map((pillar) => {
                    const cats = CATEGORIES.slice(pillar.range[0], pillar.range[1])
                    const avg = Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length)
                    return (
                      <div key={pillar.name} className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${pillar.badgeBg}`} />
                        <span className="text-xs text-white/40">{pillar.name}</span>
                        <span className={`text-xs font-medium ${scoreColor(avg)}`}>{avg}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="flex items-center justify-center gap-1.5 bg-white/[0.02] border border-white/[0.08] text-white text-xs font-medium px-3 py-2 rounded-lg cursor-default">
                    <Download size={12} /> PDF
                  </span>
                  <span className="flex items-center justify-center gap-1.5 bg-white/[0.02] border border-white/[0.08] text-white text-xs font-medium px-3 py-2 rounded-lg cursor-default">
                    <Download size={12} /> Word
                  </span>
                  <span className="flex items-center justify-center gap-1.5 bg-white/[0.02] border border-white/[0.08] text-white text-xs font-medium px-3 py-2 rounded-lg cursor-default">
                    <RefreshCw size={12} /> Re-audit
                  </span>
                  <span className="flex items-center justify-center gap-1.5 bg-white/[0.02] border border-white/[0.08] text-white text-xs font-medium px-3 py-2 rounded-lg cursor-default">
                    <Search size={12} /> Dig Deeper
                  </span>
                  <span className="flex items-center justify-center gap-1.5 bg-white/[0.02] border border-white/[0.08] text-white text-xs font-medium px-3 py-2 rounded-lg cursor-default">
                    <Share2 size={12} /> Share
                  </span>
                </div>
                <p className="text-[11px] text-white/30 mt-2">1 credit per audit</p>
              </div>
            </div>

            {/* Issue summary strip */}
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3 mt-5 pt-4 border-t border-white/[0.04]">
              <span className="text-sm font-medium text-white">{DEMO_TOTAL_ISSUES} issues found</span>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                {severityCounts.critical > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {severityCounts.critical} critical
                  </span>
                )}
                {severityCounts.high > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> {severityCounts.high} high
                  </span>
                )}
                {severityCounts.medium > 0 && (
                  <span className="text-[11px] text-white/40 bg-white/[0.04] px-2 py-0.5 rounded-full">{severityCounts.medium} medium</span>
                )}
                {severityCounts.low > 0 && (
                  <span className="text-[11px] text-white/40 bg-white/[0.04] px-2 py-0.5 rounded-full">{severityCounts.low} low</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Score Over Time ── */}
        <DemoScoreChart />

        {/* ── Improvement tip ── */}
        <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#84CC16]/[0.05] border border-[#84CC16]/20">
          <RefreshCw size={15} className="text-[#84CC16] flex-shrink-0" />
          <p className="text-xs text-white/50">
            <span className="font-medium text-white/70">Track your progress</span> — update finding statuses as you fix them, dismiss false positives with a reason, then re-audit to compare your score.
          </p>
        </div>

        {/* ── Screenshot placeholder ── */}
        <div className="mb-6 rounded-xl overflow-hidden border border-white/[0.06]">
          <div className="h-48 bg-gradient-to-br from-white/[0.03] to-white/[0.01] flex items-center justify-center">
            <div className="text-center">
              <Globe size={32} className="text-white/20 mx-auto mb-2" />
              <p className="text-xs text-white/30">Homepage screenshot captured during audit</p>
            </div>
          </div>
          <div className="px-4 py-2 bg-white/[0.02] border-t border-white/[0.03]">
            <p className="text-xs text-white/30">Homepage captured</p>
          </div>
        </div>

        {/* ── Tab Navigation ── */}
        <div className="flex items-center gap-1 bg-white/[0.04] rounded-xl p-1 mb-6">
          {(['overview', 'findings', 'pages'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-sm font-medium py-2.5 rounded-lg transition-all ${
                activeTab === tab
                  ? 'bg-white/[0.06] text-white shadow-sm'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {tab === 'overview' && 'Overview'}
              {tab === 'findings' && `Findings (${DEMO_FINDINGS.length})`}
              {tab === 'pages' && 'Pages (5)'}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════
            TAB: OVERVIEW
            ════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <>
            {/* Executive Summary */}
            <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h3 className="text-sm font-medium text-white mb-2">Executive Summary</h3>
              <p className="text-sm text-white/50 leading-relaxed">
                Acme.com scores {DEMO_SCORE}/100 overall with strong ethical UX practices and navigation structure, but significant gaps in accessibility, AI readiness, and trust signals. Two critical issues — missing alt text and no structured data — should be addressed immediately for the highest impact. Fixing the 2 critical and 2 high-severity findings could improve the overall score by an estimated 20-25 points.
              </p>
            </div>

            {/* 64-Checkpoint Health */}
            <DemoCheckpointHealth />

            {/* Pillar sections */}
            {PILLAR_CONFIG.map((pillar, pIdx) => {
              const pillarCats = CATEGORIES.slice(pillar.range[0], pillar.range[1])
              const avgScore = Math.round(pillarCats.reduce((s, c) => s + c.score, 0) / pillarCats.length)
              const pillarFindings = DEMO_FINDINGS.filter(f => f.pillarIdx === pIdx)
              const PillarIcon = PILLAR_ICONS[pIdx]

              return (
                <div key={pillar.name} className="mb-8">
                  {/* Pillar header */}
                  <div className={`rounded-xl bg-gradient-to-r ${pillar.gradientSubtle} border ${pillar.border} p-5 mb-4`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${pillar.gradient} flex items-center justify-center`}>
                          <PillarIcon size={18} className="text-white" />
                        </div>
                        <div>
                          <h2 className="font-heading font-medium text-lg text-white">{pillar.name}</h2>
                          <p className="text-xs text-white/40">4 categories evaluated</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-medium font-heading ${scoreColor(avgScore)}`}>{avgScore}</p>
                        <p className="text-[11px] text-white/40">{scoreLabel(avgScore)}</p>
                      </div>
                    </div>

                    {/* Category score bars */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {pillarCats.map((cat, relIdx) => {
                        const globalIdx = pillar.range[0] + relIdx
                        const Icon = CATEGORY_ICONS[globalIdx]
                        return (
                          <div key={globalIdx} className="bg-white/[0.04] backdrop-blur-sm rounded-lg p-3 border border-white/[0.04]">
                            <div className="flex items-center gap-2.5 mb-1.5">
                              <div className={`w-6 h-6 rounded-md ${pillar.iconBg} flex items-center justify-center flex-shrink-0`}>
                                <Icon size={12} className={pillar.iconColor} />
                              </div>
                              <p className="text-xs font-medium text-white truncate flex-1">{cat.name}</p>
                              <span className={`text-xs font-medium flex-shrink-0 ${scoreColor(cat.score)}`}>{cat.score}</span>
                            </div>
                            <div className="w-full bg-white/[0.06] rounded-full h-1.5">
                              <div
                                className={`h-full rounded-full ${pillar.scoreBg}`}
                                style={{ width: `${cat.score}%`, opacity: cat.score >= 70 ? 0.8 : cat.score >= 40 ? 0.7 : 0.9 }}
                              />
                            </div>
                            {cat.summary && (
                              <p className="text-[10px] text-white/35 mt-2 line-clamp-2 leading-relaxed">{cat.summary}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Findings for this pillar */}
                  {pillarFindings.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <span className={`text-xs font-medium ${pillar.iconColor}`}>{pillarFindings[0].category}</span>
                        <span className="text-[11px] text-white/40">{pillarFindings.length} finding{pillarFindings.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="space-y-2">
                        {pillarFindings.map((finding, i) => (
                          <DemoFindingCard key={i} finding={finding} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* ════════════════════════════════════════════════
            TAB: FINDINGS
            ════════════════════════════════════════════════ */}
        {activeTab === 'findings' && (
          <div className="space-y-2">
            {DEMO_FINDINGS.map((finding, i) => (
              <DemoFindingCard key={i} finding={finding} />
            ))}
          </div>
        )}

        {/* ════════════════════════════════════════════════
            TAB: PAGES
            ════════════════════════════════════════════════ */}
        {activeTab === 'pages' && (
          <div className="space-y-3">
            {[
              { url: 'https://www.acme.com', title: 'Home — Acme', status: 200, time: 1240 },
              { url: 'https://www.acme.com/products', title: 'Products — Acme', status: 200, time: 1890 },
              { url: 'https://www.acme.com/pricing', title: 'Pricing — Acme', status: 200, time: 980 },
              { url: 'https://www.acme.com/about', title: 'About — Acme', status: 200, time: 760 },
              { url: 'https://www.acme.com/checkout', title: 'Checkout — Acme', status: 200, time: 2100 },
            ].map((page, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                  <Globe size={16} className="text-white/30" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{page.title}</p>
                  <p className="text-xs text-white/30 truncate">{page.url}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-emerald-400 font-medium">{page.status}</span>
                  <span className="text-xs text-white/30">{page.time}ms</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ════════════════════════════════════════════════
            FINAL CTA
            ════════════════════════════════════════════════ */}
        <section className="mt-16 mb-8">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-10 sm:p-14 text-center">
            <TrendingUp size={32} className="text-[#84CC16] mx-auto mb-4" />
            <h2 className="font-heading text-2xl sm:text-3xl font-light text-white mb-3">
              Ready to audit <span className="text-lime-gradient">your site?</span>
            </h2>
            <p className="text-base text-white/50 leading-relaxed max-w-lg mx-auto mb-8">
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
        </section>
      </div>
    </main>
  )
}
