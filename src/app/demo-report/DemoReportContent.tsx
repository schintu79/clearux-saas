'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SectionMarker } from '@/components/marketing/SectionMarker'
import { Coda } from '@/components/marketing/Coda'

/* ── Helpers ── */

function scoreColor(s: number): string {
  if (s >= 70) return 'var(--ok)'
  if (s >= 40) return 'var(--warn)'
  return 'var(--severe)'
}

function scoreClass(s: number) {
  if (s >= 70) return 'text-ok'
  if (s >= 40) return 'text-warn'
  return 'text-severe'
}

function scoreBgClass(s: number) {
  if (s >= 70) return 'bg-ok'
  if (s >= 40) return 'bg-warn'
  return 'bg-severe'
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

function SeverityText({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'text-severe',
    high: 'text-warn',
    medium: 'text-signal',
    low: 'text-ok',
  }
  return <span className={`text-[11px] font-medium uppercase tracking-wider ${colors[severity] || colors.medium}`}>{severity}</span>
}

/* ── Mini ScoreRing for report previews ── */
function MiniScoreRing({ score, size = 100 }: { score: number; size?: number }) {
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)
  const color = scoreColor(score)

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--rule)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-serif text-ink" style={{ fontSize: size * 0.28 }}>{score}</span>
      </div>
    </div>
  )
}

/* ── Demo Data ── */

const MODULE_TINTS = [
  { dot: '#6366F1' }, // Foundation — indigo
  { dot: '#EC4899' }, // Human Experience — pink
  { dot: '#10B981' }, // Inclusive Design — emerald
  { dot: '#F59E0B' }, // Future Readiness — amber
  { dot: '#3B82F6' }, // Brand Consistency — blue
  { dot: '#06B6D4' }, // SEO Structure — teal
]

const BRAND_TINTS = [
  { dot: '#6366F1' }, // Visual Consistency — indigo
  { dot: '#EC4899' }, // Tone of Voice — pink
  { dot: '#10B981' }, // Professionalism — emerald
  { dot: '#F59E0B' }, // Value Proposition — amber
  { dot: '#3B82F6' }, // Structure — blue
  { dot: '#06B6D4' }, // Wording — teal
]

const WEBSITE_MODULES = [
  { name: 'Foundation', score: 81 },
  { name: 'Human Experience', score: 71 },
  { name: 'Inclusive Design', score: 67 },
  { name: 'Future Readiness', score: 52 },
  { name: 'Brand Consistency', score: 78 },
  { name: 'SEO Structure', score: 73 },
]

const WEBSITE_FINDINGS = [
  { severity: 'critical', title: 'No structured data (Schema.org) detected', category: 'Future Readiness',
    observation: 'We crawled all 47 public pages and found zero JSON-LD, Microdata, or RDFa markup. Search engines and AI assistants have no machine-readable context about your products, pricing, or FAQs.',
    impact: 'Without structured data, your pages are invisible to AI-powered search (Google SGE, Perplexity, ChatGPT browse). Rich results (star ratings, pricing, FAQ dropdowns) cannot appear — reducing click-through rate by an estimated 20-35% on eligible pages.',
    fix: 'Add JSON-LD blocks for Organization (homepage), Product (each product page), and FAQPage (FAQ section). Use Google\'s Structured Data Markup Helper to generate the initial code, then validate with the Rich Results Test.' },
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
  { name: 'Structure', score: 82 },
  { name: 'Wording Quality', score: 77 },
]

const BRAND_FINDINGS = [
  { severity: 'high', title: 'Value proposition lacks supporting proof points', category: 'Value Proposition',
    observation: 'Across 14 reviewed brand documents, value proposition statements rely on generic claims ("best-in-class", "industry-leading") with zero supporting evidence.',
    impact: 'Unsupported claims erode trust with sophisticated buyers. Research shows B2B prospects are 63% more likely to shortlist vendors who prove claims with specific numbers.',
    fix: 'Attach one concrete proof point per claim — a metric, customer quote, or case study reference. Example: replace "industry-leading uptime" with "99.97% uptime over 24 months."' },
  { severity: 'high', title: 'Tone shifts between formal and casual across documents', category: 'Tone of Voice' },
  { severity: 'medium', title: 'Competitive positioning is generic — no clear differentiator', category: 'Value Proposition' },
  { severity: 'medium', title: 'Secondary colour usage inconsistent across brand assets', category: 'Visual Consistency' },
  { severity: 'low', title: 'Headline copy relies on cliches in 3 documents', category: 'Wording Quality' },
]

type AuditType = 'website' | 'brand'

const AUDIT_TYPES = [
  { key: 'website' as const, label: 'Website audit', site: 'acme.com', score: 71 },
  { key: 'brand' as const, label: 'Brand identity', site: 'Stripe Rebrand Guidelines', score: 79 },
]

/* ── Product-realistic Report Preview ── */
function ReportPreview({
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
  const mediumCount = findings.filter(f => f.severity === 'medium' || f.severity === 'low').length
  const tints = auditType === 'brand' ? BRAND_TINTS : MODULE_TINTS
  const expandedFinding = findings[0]

  return (
    <div className="space-y-5">
      {/* ── Card 1: Hero score card (matches real product) ── */}
      <div className="rounded-xl border border-rule overflow-hidden bg-paper shadow-sm">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <MiniScoreRing score={score} size={110} />
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1 flex-wrap">
                <h3 className="font-sans text-[20px] text-ink font-medium tracking-[-0.01em]">{site}</h3>
              </div>
              <p className="font-mono text-[11px] text-m-muted tracking-[0.06em] uppercase mb-3">
                {findings.length} findings · {modules.length} {auditType === 'brand' ? 'categories' : 'modules'}
              </p>
              {/* Module mini-scores with colored dots */}
              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                {modules.map((mod, i) => (
                  <div key={mod.name} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tints[i]?.dot || '#6366F1' }} />
                    <span className="text-xs text-m-muted">{mod.name}</span>
                    <span className={`text-xs font-medium ${scoreClass(mod.score)}`}>{mod.score}</span>
                  </div>
                ))}
              </div>
              {/* Severity breakdown */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3">
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
                {mediumCount > 0 && (
                  <span className="text-[11px] font-mono text-m-muted tracking-[0.06em] uppercase">
                    {mediumCount} more
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Action strip */}
        <div className="border-t border-rule px-6 sm:px-8 py-3.5 flex flex-wrap gap-2">
          {['PDF', 'Word', 'Re-audit', 'Share'].map((action) => (
            <span key={action} className="flex items-center gap-1.5 border border-rule text-ink text-[11px] font-mono tracking-[0.06em] uppercase px-3.5 py-1.5 rounded-lg cursor-default hover:bg-paper-2 transition-colors">
              {action}
            </span>
          ))}
        </div>
      </div>

      {/* ── Card 2: Stat cards (matches real product DashboardStatCards) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Critical', count: criticalCount, colorVar: '--severe', dot: 'bg-severe' },
          { label: 'High', count: highCount, colorVar: '--warn', dot: 'bg-warn' },
          { label: 'Medium + Low', count: mediumCount, colorVar: '--warn', dot: 'bg-signal' },
          { label: 'Passed', count: Math.max(0, (auditType === 'website' ? 96 : 64) - findings.length), colorVar: '--ok', dot: 'bg-ok' },
        ].map(card => (
          <div key={card.label} className="rounded-xl border p-4"
            style={{ background: `color-mix(in srgb, var(${card.colorVar}) 8%, transparent)`, borderColor: `color-mix(in srgb, var(${card.colorVar}) 20%, transparent)` }}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${card.dot}`} />
              <span className="text-xs font-medium" style={{ color: `var(${card.colorVar})` }}>{card.label}</span>
            </div>
            <p className="text-2xl font-medium font-sans" style={{ color: `var(${card.colorVar})` }}>{card.count}</p>
          </div>
        ))}
      </div>

      {/* ── Card 3: Module score breakdown (matches real product) ── */}
      <div className="rounded-xl border border-rule overflow-hidden bg-paper shadow-sm">
        <div className="px-5 py-4 border-b border-rule">
          <h4 className="text-sm font-medium text-ink">{auditType === 'brand' ? 'Category scores' : 'Module scores'}</h4>
        </div>
        <div className="divide-y divide-rule">
          {modules.map((mod, i) => {
            const tint = tints[i]?.dot || '#6366F1'
            return (
              <div key={mod.name} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tint }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-sans font-medium text-ink mb-1.5">{mod.name}</p>
                  <div className="w-full bg-rule/40 h-[3px] rounded-full">
                    <div className="h-full rounded-full transition-all" style={{ width: `${mod.score}%`, backgroundColor: tint, opacity: 0.7 }} />
                  </div>
                </div>
                <span className={`font-mono text-[15px] font-medium flex-shrink-0 ${scoreClass(mod.score)}`}>{mod.score}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Card 4: Finding cards (matches real product FindingCard) ── */}
      <div className="rounded-xl border border-rule overflow-hidden bg-paper shadow-sm">
        <div className="px-5 py-4 border-b border-rule flex items-center justify-between">
          <h4 className="text-sm font-medium text-ink">Top findings</h4>
          <span className="font-mono text-[10px] text-m-muted tracking-[0.08em] uppercase">Ranked by severity</span>
        </div>
        <div className="divide-y divide-rule/40">
          {findings.map((finding, i) => (
            <div key={i}>
              <div className="flex items-start gap-3 p-4 sm:px-5">
                <span className="mt-1.5"><SeverityDot severity={finding.severity} /></span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <SeverityText severity={finding.severity} />
                  </div>
                  <p className="font-medium text-ink text-sm leading-snug">{finding.title}</p>
                  <p className="font-mono text-[10px] text-m-muted tracking-[0.06em] uppercase mt-1">
                    Category: {finding.category}
                  </p>
                </div>
              </div>
              {/* Expanded detail for first finding — shows real product anatomy */}
              {i === 0 && finding.observation && (
                <div className="px-5 pb-5 pt-0 border-t border-rule/20 mx-4 space-y-3">
                  <p className="text-m-muted text-sm leading-relaxed pt-3">{finding.observation}</p>
                  {/* Recommendation card */}
                  <div className="p-3 bg-paper-2/60 rounded-lg border border-rule/30">
                    <div className="flex gap-2.5">
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={tints[i]?.dot || '#F59E0B'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
                        <line x1="9" y1="18" x2="15" y2="18" /><line x1="10" y1="22" x2="14" y2="22" />
                        <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
                      </svg>
                      <div>
                        <p className="text-[11px] font-medium text-ink mb-1">Recommendation</p>
                        <p className="text-sm text-m-muted leading-relaxed">{finding.fix}</p>
                      </div>
                    </div>
                  </div>
                  {/* Impact card */}
                  {finding.impact && (
                    <div className="flex items-start gap-2.5 p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/15">
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
                      </svg>
                      <div>
                        <p className="text-[11px] font-medium text-ink mb-0.5">Expected impact</p>
                        <p className="text-sm text-emerald-700 leading-relaxed">{finding.impact}</p>
                      </div>
                    </div>
                  )}
                  {/* Status controls */}
                  <div className="flex items-center gap-2 pt-1 border-t border-rule/20 mt-3">
                    <span className="text-[11px] text-m-muted mr-1">Status:</span>
                    {['Open', 'In progress', 'Fixed'].map(s => (
                      <span key={s} className={`text-[11px] font-medium px-2 py-1 rounded-md border ${s === 'Open' ? 'bg-paper-2 border-rule text-ink' : 'border-transparent text-m-muted'}`}>
                        {s}
                      </span>
                    ))}
                    <span className="ml-auto text-[11px] text-m-muted hover:text-ink cursor-default">Dismiss</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Card 5: Executive summary (matches real product) ── */}
      <div className="rounded-xl border border-rule overflow-hidden bg-paper shadow-sm p-5">
        <p className="text-xs font-medium text-m-muted uppercase tracking-wider mb-2">Executive summary</p>
        <p className="text-sm text-ink/80 leading-relaxed">
          {auditType === 'website'
            ? 'The website demonstrates solid foundational UX with clean navigation and consistent visual design. Key weaknesses centre on future readiness — zero structured data means AI-powered search engines cannot surface your content. Inclusive design needs attention: 12 images lack alt text and mobile touch targets fall below WCAG minimums. Addressing the 2 critical and 2 high-severity findings will have the highest impact on overall score improvement.'
            : 'The brand identity materials show strong visual consistency and professional production quality. The primary weakness is in value proposition — claims lack concrete supporting evidence, which undermines credibility with sophisticated buyers. Tone of voice shifts between documents suggest missing brand voice guidelines. Addressing these gaps will strengthen competitive positioning and improve trust metrics across all customer touchpoints.'}
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
            Explore a sample audit report. Every card, score, and finding below matches what you see in the real product — same layout, same depth, same evidence.
          </p>
        </div>
      </section>

      {/* Report explorer */}
      <section className="py-[80px] border-b border-rule max-sm:py-12">
        <div className="max-w-[1080px] mx-auto px-8 max-sm:px-5">
          {/* Audit type tabs */}
          <div className="flex gap-0 border border-rule rounded-xl overflow-hidden mb-10 max-sm:flex-col">
            {AUDIT_TYPES.map((type, i) => {
              const isActive = activeType === type.key
              return (
                <button
                  key={type.key}
                  onClick={() => setActiveType(type.key)}
                  className={`flex-1 px-5 py-4 text-left transition-all ${
                    i < AUDIT_TYPES.length - 1 ? 'sm:border-r border-rule max-sm:border-b' : ''
                  } ${isActive ? 'bg-ink text-paper' : 'hover:bg-paper-2'}`}
                >
                  <p className={`text-[14px] font-sans font-medium ${isActive ? 'text-paper' : 'text-ink'}`}>{type.label}</p>
                  <p className={`text-[11px] font-mono tracking-[0.04em] mt-0.5 ${isActive ? 'text-paper/60' : 'text-m-muted'}`}>{type.site}</p>
                </button>
              )
            })}
          </div>

          <ReportPreview
            auditType={activeType}
            site={active.site}
            score={active.score}
            modules={active.modules}
            findings={active.findings}
          />

          {/* What you get */}
          <div className="rounded-xl border border-rule mt-8 p-6 bg-paper shadow-sm">
            <h3 className="font-mono text-[11px] tracking-[0.1em] uppercase text-m-muted mb-5">Every audit includes</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'PDF + Word exports', desc: 'Professional reports ready for stakeholders' },
                { label: 'Shareable link', desc: 'One link for your full report — no account needed to view' },
                { label: 'Re-audit and track', desc: 'Verify fixes and watch your score improve over time' },
                { label: 'Finding status tracking', desc: 'Mark findings as open, in progress, or fixed' },
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
