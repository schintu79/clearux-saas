'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SectionMarker } from '@/components/marketing/SectionMarker'
import { ArrowRightIcon } from '@/components/marketing/icons'
import { Coda } from '@/components/marketing/Coda'

/* ── Helpers ── */

function scoreColor(s: number) {
  if (s >= 70) return 'text-ok'
  if (s >= 40) return 'text-warn'
  return 'text-severe'
}

function scoreBg(s: number) {
  if (s >= 70) return 'bg-ok'
  if (s >= 40) return 'bg-warn'
  return 'bg-severe'
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const strokeWidth = 5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)
  const color = score >= 70 ? 'var(--ok)' : score >= 40 ? 'var(--warn)' : 'var(--severe)'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--rule)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-serif text-[24px] text-ink">{score}</span>
      </div>
    </div>
  )
}

function SeverityDot({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-severe',
    high: 'bg-warn',
    medium: 'bg-signal',
    low: 'bg-ok',
  }
  return <span className={`w-2 h-2 rounded-full ${colors[severity] || colors.medium}`} />
}

/* ── Demo Data ── */

const WEBSITE_MODULES = [
  { name: 'Foundation', score: 81 },
  { name: 'Human Experience', score: 71 },
  { name: 'Inclusive Design', score: 67 },
  { name: 'Future Readiness', score: 52 },
  { name: 'Brand Consistency', score: 78 },
  { name: 'SEO Structure', score: 73 },
]

const WEBSITE_FINDINGS = [
  {
    severity: 'critical',
    title: 'No structured data (Schema.org) detected',
    category: 'Future Readiness',
    observation: 'We crawled all 47 public pages and found zero JSON-LD, Microdata, or RDFa markup. Search engines and AI assistants have no machine-readable context about your products, pricing, or FAQs.',
    impact: 'Without structured data, your pages are invisible to AI-powered search (Google SGE, Perplexity, ChatGPT browse). Rich results (star ratings, pricing, FAQ dropdowns) cannot appear — reducing click-through rate by an estimated 20-35% on eligible pages.',
    fix: 'Add JSON-LD blocks for Organization (homepage), Product (each product page), and FAQPage (FAQ section). Use Google\'s Structured Data Markup Helper to generate the initial code, then validate with the Rich Results Test. Estimated effort: 2-4 hours for a developer.',
  },
  { severity: 'critical', title: 'Missing alt text on 12 product images', category: 'Inclusive Design' },
  { severity: 'high', title: 'Primary CTA below the fold on mobile', category: 'Human Experience' },
  { severity: 'high', title: 'Trust signals missing from checkout page', category: 'Foundation' },
  { severity: 'medium', title: 'Touch targets under 44px on mobile navigation', category: 'Inclusive Design' },
  { severity: 'medium', title: 'Reading level exceeds grade 10 on pricing', category: 'Human Experience' },
  { severity: 'low', title: 'No semantic HTML landmarks detected', category: 'SEO Structure' },
]

const BRAND_MODULES = [
  { name: 'Visual Consistency', score: 88 },
  { name: 'Tone of Voice', score: 74 },
  { name: 'Professionalism', score: 91 },
  { name: 'Value Proposition', score: 69 },
  { name: 'Structure & Organisation', score: 82 },
  { name: 'Competitive Positioning', score: 71 },
  { name: 'Wording Quality', score: 77 },
]

const BRAND_FINDINGS = [
  {
    severity: 'high',
    title: 'Value proposition lacks supporting proof points',
    category: 'Value Proposition',
    observation: 'Across 14 reviewed brand documents, value proposition statements rely on generic claims ("best-in-class", "industry-leading") with zero supporting evidence. No case studies, metrics, or customer testimonials back up the claims.',
    impact: 'Unsupported claims erode trust with sophisticated buyers. Research shows B2B prospects are 63% more likely to shortlist vendors who prove claims with specific numbers. Without proof points, your brand reads as aspirational rather than credible.',
    fix: 'Attach one concrete proof point per claim — a metric, customer quote, or case study reference. Example: replace "industry-leading uptime" with "99.97% uptime over 24 months, verified by an independent monitor." Audit all 14 docs systematically.',
  },
  { severity: 'high', title: 'Tone shifts between formal and casual across documents', category: 'Tone of Voice' },
  { severity: 'medium', title: 'Competitive positioning is generic — no clear differentiator', category: 'Competitive Positioning' },
  { severity: 'medium', title: 'Secondary colour usage inconsistent across brand assets', category: 'Visual Consistency' },
  { severity: 'low', title: 'Headline copy relies on cliches in 3 documents', category: 'Wording Quality' },
]

const DESIGN_MODULES = [
  { name: 'Visual Hierarchy', score: 76 },
  { name: 'Component Consistency', score: 83 },
  { name: 'Accessibility', score: 62 },
  { name: 'Responsive Design', score: 71 },
  { name: 'Interaction Design', score: 79 },
  { name: 'Design System Alignment', score: 85 },
]

const DESIGN_FINDINGS = [
  {
    severity: 'critical',
    title: 'Colour contrast fails WCAG AA on 4 text elements',
    category: 'Accessibility',
    observation: 'Four text elements use a 3.2:1 contrast ratio against their backgrounds — below the WCAG AA minimum of 4.5:1. Affected: the secondary button label, placeholder text in the search field, the breadcrumb trail, and the disabled-state helper text.',
    impact: 'Roughly 1 in 12 men and 1 in 200 women have colour vision deficiency. Low-contrast text is unreadable for these users and strains everyone else. WCAG AA compliance is also a legal requirement in many jurisdictions — failure exposes liability.',
    fix: 'Darken the affected text colours to meet 4.5:1 minimum. For the secondary button, change #9CA3AF to #6B7280. For placeholder text, use #6B7280 instead of #D1D5DB. Test with the WebAIM contrast checker before shipping.',
  },
  { severity: 'high', title: 'No visible focus states on interactive components', category: 'Accessibility' },
  { severity: 'high', title: 'Information hierarchy unclear on dashboard view', category: 'Visual Hierarchy' },
  { severity: 'medium', title: 'Touch targets under 44px on mobile breakpoint', category: 'Responsive Design' },
  { severity: 'medium', title: 'Button component has 3 inconsistent variants', category: 'Component Consistency' },
  { severity: 'low', title: 'Loading state missing on data table component', category: 'Interaction Design' },
]

type AuditType = 'website' | 'brand' | 'design'

const AUDIT_TYPES = [
  { key: 'website' as const, label: 'Website audit', site: 'acme.com', score: 71 },
  { key: 'brand' as const, label: 'Brand identity', site: 'Stripe Rebrand Guidelines', score: 79 },
  { key: 'design' as const, label: 'Design audit', site: 'Checkout Redesign v2.1', score: 76 },
]

const RECOMMENDATIONS: Record<AuditType, string> = {
  website: 'Add JSON-LD structured data for Organization, Product, and FAQPage schemas. This is the highest-impact fix — essential for AI discoverability and expected to improve your Future Readiness score by 25+ points.',
  brand: 'Add specific proof points (metrics, case studies, testimonials) to support each value proposition claim. Generic statements reduce trust and make differentiation harder.',
  design: 'Fix colour contrast on the 4 failing text elements — they currently sit at 3.2:1 ratio against WCAG AA minimum of 4.5:1. This blocks accessibility compliance.',
}

/* ── Report Mockup ── */
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
  modules: { name: string; score: number }[]
  findings: { severity: string; title: string; category: string; observation?: string; impact?: string; fix?: string }[]
}) {
  const criticalCount = findings.filter(f => f.severity === 'critical').length
  const highCount = findings.filter(f => f.severity === 'high').length

  return (
    <div className="space-y-6">
      {/* Score card */}
      <div className="border border-ink">
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <ScoreRing score={score} size={88} />
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <h3 className="font-sans text-[22px] text-ink font-medium tracking-[-0.01em] mb-0.5">{site}</h3>
            <p className="font-mono text-[11px] text-m-muted tracking-[0.06em] uppercase mb-4">
              {findings.length} findings · {modules.length} modules
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-5">
              {criticalCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono tracking-[0.06em] uppercase text-severe">
                  <span className="w-2 h-2 rounded-full bg-severe" /> {criticalCount} critical
                </span>
              )}
              {highCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono tracking-[0.06em] uppercase text-warn">
                  <span className="w-2 h-2 rounded-full bg-warn" /> {highCount} high
                </span>
              )}
              <span className="text-[11px] font-mono text-m-muted tracking-[0.06em] uppercase">
                {findings.length - criticalCount - highCount} more
              </span>
            </div>
          </div>
        </div>
        <div className="border-t border-rule px-6 sm:px-8 py-3.5 flex flex-wrap gap-2">
          {['PDF', 'Word', 'Share', 'Re-audit'].map((action) => (
            <span key={action} className="flex items-center gap-1.5 border border-rule text-ink text-[11px] font-mono tracking-[0.06em] uppercase px-3.5 py-1.5 hover:bg-paper-2 transition-colors cursor-default">
              {action}
            </span>
          ))}
        </div>
      </div>

      {/* Module scores */}
      <div className="border border-ink">
        <div className="px-6 py-4 border-b border-rule">
          <h4 className="font-mono text-[11px] tracking-[0.1em] uppercase text-m-muted">Module scores</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod, i) => (
            <div key={mod.name} className={`flex items-center gap-4 px-5 py-4 border-b border-rule ${i % 3 !== 2 ? 'lg:border-r' : ''} ${i % 2 !== 1 ? 'sm:max-lg:border-r' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-sans font-medium text-ink mb-1.5">{mod.name}</p>
                <div className="w-full bg-rule/50 h-[3px] rounded-full">
                  <div className={`h-full rounded-full ${scoreBg(mod.score)}`} style={{ width: `${mod.score}%`, opacity: 0.75 }} />
                </div>
              </div>
              <span className={`font-mono text-[16px] font-medium flex-shrink-0 ${scoreColor(mod.score)}`}>{mod.score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top findings */}
      <div className="border border-ink">
        <div className="px-6 py-4 border-b border-rule flex items-center justify-between">
          <h4 className="font-mono text-[11px] tracking-[0.1em] uppercase text-m-muted">Top findings</h4>
          <span className="font-mono text-[10px] text-m-muted tracking-[0.08em] uppercase">Ranked by severity</span>
        </div>
        <div>
          {findings.slice(0, 5).map((finding, i) => (
            <div key={i} className={`flex items-start gap-3.5 px-6 py-4 ${i < Math.min(findings.length, 5) - 1 ? 'border-b border-rule' : ''}`}>
              <span className="mt-1.5"><SeverityDot severity={finding.severity} /></span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-sans text-ink leading-[1.45]">{finding.title}</p>
                <p className="text-[11px] font-mono text-m-muted tracking-[0.04em] mt-1">{finding.category}</p>
              </div>
              <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-m-muted flex-shrink-0 mt-0.5">
                {finding.severity}
              </span>
            </div>
          ))}
        </div>
        {findings.length > 5 && (
          <div className="px-6 py-3 border-t border-rule">
            <p className="font-mono text-[11px] text-m-muted text-center tracking-[0.06em] uppercase">
              + {findings.length - 5} more findings in the full report
            </p>
          </div>
        )}
      </div>

      {/* Finding anatomy — expanded first finding */}
      {findings[0]?.observation && (
        <div className="border border-ink">
          <div className="px-6 py-4 border-b border-rule">
            <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-signal block mb-2">Anatomy of a finding</span>
            <div className="flex items-center gap-3">
              <SeverityDot severity={findings[0].severity} />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-sans font-medium text-ink">{findings[0].title}</p>
                <p className="text-[11px] font-mono text-m-muted tracking-[0.04em] mt-0.5">{findings[0].category} · {findings[0].severity}</p>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-rule">
            <div className="p-6">
              <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-m-muted block mb-3">What we observed</span>
              <p className="font-sans text-[13px] text-ink-2 leading-[1.65]">{findings[0].observation}</p>
            </div>
            <div className="p-6">
              <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-severe block mb-3">Business impact</span>
              <p className="font-sans text-[13px] text-ink-2 leading-[1.65]">{findings[0].impact}</p>
            </div>
            <div className="p-6">
              <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-ok block mb-3">The fix</span>
              <p className="font-sans text-[13px] text-ink-2 leading-[1.65]">{findings[0].fix}</p>
            </div>
          </div>
        </div>
      )}

      {/* Top recommendation */}
      <div className="border border-signal/30 bg-signal/5 p-6">
        <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-signal mb-3 block">Top recommendation</span>
        <p className="font-sans text-[14px] text-ink-2 leading-[1.65]">
          {RECOMMENDATIONS[auditType]}
        </p>
      </div>
    </div>
  )
}

/* ── Main Component ── */
export default function DemoReportContent() {
  const [activeType, setActiveType] = useState<AuditType>('website')

  const dataMap = {
    website: { site: 'acme.com', score: 71, modules: WEBSITE_MODULES, findings: WEBSITE_FINDINGS },
    brand: { site: 'Stripe Rebrand Guidelines', score: 79, modules: BRAND_MODULES, findings: BRAND_FINDINGS },
    design: { site: 'Checkout Redesign v2.1', score: 76, modules: DESIGN_MODULES, findings: DESIGN_FINDINGS },
  }

  const active = dataMap[activeType]

  return (
    <main>
      {/* Hero */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="01" label="Sample reports" />
          <h1 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-4" style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}>
            See what ClearUX <em className="italic text-signal">delivers.</em>
          </h1>
          <p className="text-[18px] leading-[1.55] text-ink-2 max-w-[600px] font-sans">
            Three audit types, one standard of depth. Explore how each report surfaces actionable insights with evidence, severity rankings, and specific recommendations.
          </p>
        </div>
      </section>

      {/* Report explorer */}
      <section className="py-[80px] border-b border-rule max-sm:py-12">
        <div className="max-w-[1080px] mx-auto px-8 max-sm:px-5">
          {/* Audit type tabs */}
          <div className="flex gap-0 border border-ink mb-10 max-sm:flex-col">
            {AUDIT_TYPES.map((type, i) => {
              const isActive = activeType === type.key
              return (
                <button
                  key={type.key}
                  onClick={() => setActiveType(type.key)}
                  className={`flex-1 px-5 py-4 text-left transition-all ${
                    i < AUDIT_TYPES.length - 1 ? 'sm:border-r border-ink max-sm:border-b' : ''
                  } ${isActive ? 'bg-ink text-paper' : 'hover:bg-paper-2'}`}
                >
                  <p className={`text-[14px] font-sans font-medium ${isActive ? 'text-paper' : 'text-ink'}`}>{type.label}</p>
                  <p className={`text-[11px] font-mono tracking-[0.04em] mt-0.5 ${isActive ? 'text-paper/60' : 'text-m-muted'}`}>{type.site}</p>
                </button>
              )
            })}
          </div>

          <ReportMockup
            auditType={activeType}
            site={active.site}
            score={active.score}
            modules={active.modules}
            findings={active.findings}
          />

          {/* What you get */}
          <div className="border border-ink mt-8 p-6">
            <h3 className="font-mono text-[11px] tracking-[0.1em] uppercase text-m-muted mb-5">Every audit includes</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'PDF + Word exports', desc: 'Professional reports ready for stakeholders' },
                { label: 'Shareable link', desc: 'One link for your full report — no account needed to view' },
                { label: 'Re-audit and track', desc: 'Verify fixes and watch your score improve over time' },
                { label: 'Dig deeper mode', desc: 'Run a deeper analysis on specific modules for more findings' },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-[14px] font-sans font-medium text-ink mb-1">{item.label}</p>
                  <p className="text-[13px] font-sans text-ink-2 leading-[1.5]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <Coda />
    </main>
  )
}
