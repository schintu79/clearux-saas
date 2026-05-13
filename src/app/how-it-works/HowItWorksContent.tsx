'use client'

import { useRef } from 'react'
import { SectionMarker } from '@/components/marketing/SectionMarker'
import { Button } from '@/components/marketing/Button'
import { ArrowRightIcon } from '@/components/marketing/icons'
import { Coda } from '@/components/marketing/Coda'
import { useTheme } from '@/context/ThemeContext'

/* ═══════════════════════════════════════════════════════════════
   SCROLLABLE HIGHLIGHT CARDS — SimilarWeb-style horizontal strip
   ═══════════════════════════════════════════════════════════════ */

interface HighlightCard {
  label: string
  title: string
  desc: string
  visual: React.ReactNode
}

function ScrollStrip({ cards, marker, markerLabel, heading, headingAccent, subtitle }: {
  cards: HighlightCard[]
  marker: string
  markerLabel: string
  heading: string
  headingAccent: string
  subtitle: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -380 : 380, behavior: 'smooth' })
  }

  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16 overflow-hidden">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <div className="flex items-end justify-between gap-6 mb-12 max-sm:mb-8 max-sm:flex-col max-sm:items-start">
          <div className="max-w-[640px]">
            <SectionMarker number={marker} label={markerLabel} />
            <h2 className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.025em] mb-4" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
              {heading} <em className="italic text-signal">{headingAccent}</em>
            </h2>
            <p className="text-[17px] leading-[1.55] text-ink-2 font-sans">{subtitle}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => scroll('left')} className="w-10 h-10 rounded-full border border-rule flex items-center justify-center text-ink hover:bg-paper-2 transition-colors" aria-label="Scroll left">
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <button onClick={() => scroll('right')} className="w-10 h-10 rounded-full border border-rule flex items-center justify-center text-ink hover:bg-paper-2 transition-colors" aria-label="Scroll right">
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable card row — edge-to-edge but starts at max-w-mkt */}
      <div ref={scrollRef} className="flex gap-5 overflow-x-auto px-8 max-sm:px-5 pb-4 snap-x snap-mandatory scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {/* Left spacer to align with max-w-mkt */}
        <div className="flex-shrink-0" style={{ width: 'max(0px, calc((100vw - 1200px) / 2 - 32px))' }} />
        {cards.map((card, i) => (
          <div key={i} className="flex-shrink-0 w-[340px] max-sm:w-[300px] snap-start border border-rule rounded-xl overflow-hidden bg-paper hover:border-signal/30 transition-colors group">
            {/* Visual area */}
            <div className="h-[220px] border-b border-rule bg-paper-2/50 p-5 flex items-center justify-center overflow-hidden">
              {card.visual}
            </div>
            {/* Text */}
            <div className="p-5">
              <span className="text-[10px] font-mono tracking-[0.08em] uppercase text-signal font-semibold block mb-2">{card.label}</span>
              <h3 className="font-sans text-[16px] font-semibold text-ink mb-2 leading-snug">{card.title}</h3>
              <p className="font-sans text-[13px] text-ink-2 leading-[1.55]">{card.desc}</p>
            </div>
          </div>
        ))}
        {/* Right spacer */}
        <div className="flex-shrink-0 w-8" />
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   VISUAL MOCKUP COMPONENTS — reflecting actual dashboard
   ═══════════════════════════════════════════════════════════════ */

/* ── Score ring mockup ────────────────────────── */
function MockScoreRing({ score, size = 60, color }: { score: number; size?: number; color: string }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--rule)" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-serif text-ink font-normal" style={{ fontSize: size * 0.3 }}>{score}</span>
      </div>
    </div>
  )
}

/* ── AI Probe Result mockup (dashboard-accurate) ── */
function MockProbeCard() {
  const probes = [
    { q: 'What is acme.com?', grade: 'Correct', color: 'var(--ok)' },
    { q: 'What products do they offer?', grade: 'Partial', color: 'var(--warn)' },
    { q: 'What is the pricing?', grade: 'Hallucinated', color: 'var(--severe)' },
    { q: 'Who founded the company?', grade: 'Correct', color: 'var(--ok)' },
  ]
  return (
    <div className="w-full border border-rule rounded-lg bg-paper text-left overflow-hidden" style={{ fontSize: 0 }}>
      <div className="px-3 py-2 border-b border-rule flex items-center gap-1.5">
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--signal)" strokeWidth={1.5}><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" /><path d="M9 22h6" /></svg>
        <span className="text-[10px] font-sans font-semibold text-ink">What AI knows about your site</span>
      </div>
      {probes.map((p, i) => (
        <div key={i} className="px-3 py-2 flex items-center justify-between gap-2" style={{ borderTop: i > 0 ? '1px solid var(--rule)' : 'none' }}>
          <span className="text-[10px] font-sans text-ink">{p.q}</span>
          <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ color: p.color, background: `color-mix(in srgb, ${p.color} 12%, transparent)` }}>{p.grade}</span>
        </div>
      ))}
    </div>
  )
}

/* ── AI vs Human panel mockup ── */
function MockAIvsHuman() {
  return (
    <div className="w-full border border-rule rounded-lg bg-paper overflow-hidden" style={{ fontSize: 0 }}>
      <div className="grid grid-cols-2">
        <div className="p-3 border-r border-rule">
          <div className="flex items-center gap-1 mb-1.5">
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="var(--signal)" strokeWidth={1.5}><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" /></svg>
            <span className="text-[8px] font-semibold text-m-muted tracking-[0.04em] uppercase">How AI reads this</span>
          </div>
          <p className="text-[9px] text-ink-2 leading-[1.5]">The CTA button uses vague text. AI models can&apos;t determine the action behind &ldquo;Click here.&rdquo;</p>
        </div>
        <div className="p-3">
          <div className="flex items-center gap-1 mb-1.5">
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth={1.5}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx={9} cy={7} r={4} /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            <span className="text-[8px] font-semibold text-m-muted tracking-[0.04em] uppercase">How a human sees this</span>
          </div>
          <p className="text-[9px] text-ink-2 leading-[1.5]">Users hesitate because the button label doesn&apos;t tell them what happens next. Conversion drops 22%.</p>
        </div>
      </div>
    </div>
  )
}

/* ── AI Readability Map mockup ── */
function MockReadabilityMap() {
  const pages = [
    { path: '/', score: 92, color: 'var(--ok)' },
    { path: '/pricing', score: 78, color: 'var(--ok)' },
    { path: '/about', score: 45, color: 'var(--warn)' },
    { path: '/docs', score: 31, color: 'var(--severe)' },
  ]
  return (
    <div className="w-full border border-rule rounded-lg bg-paper overflow-hidden" style={{ fontSize: 0 }}>
      <div className="px-3 py-2 border-b border-rule flex items-center gap-1.5">
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--signal)" strokeWidth={1.5}><circle cx={12} cy={12} r={10} /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
        <span className="text-[10px] font-sans font-semibold text-ink">AI readability by page</span>
      </div>
      {pages.map((pg, i) => (
        <div key={i} className="px-3 py-2 flex items-center gap-2" style={{ borderTop: i > 0 ? '1px solid var(--rule)' : 'none' }}>
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="var(--m-muted)" strokeWidth={1.5}><circle cx={12} cy={12} r={10} /><path d="M2 12h20" /></svg>
          <span className="text-[10px] text-ink flex-1">{pg.path}</span>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: pg.color, background: `color-mix(in srgb, ${pg.color} 12%, transparent)` }}>
            AI {pg.score}%
          </span>
        </div>
      ))}
    </div>
  )
}

/* ── Citation Audit mockup ── */
function MockCitationAudit() {
  const citations = [
    { page: 'Homepage', type: 'Cited', icon: 'check', color: 'var(--ok)' },
    { page: 'Pricing page', type: 'Cited', icon: 'check', color: 'var(--ok)' },
    { page: 'About page', type: 'Ignored', icon: 'warn', color: 'var(--warn)' },
    { page: 'Blog post #3', type: 'Ignored', icon: 'warn', color: 'var(--warn)' },
  ]
  return (
    <div className="w-full border border-rule rounded-lg bg-paper overflow-hidden" style={{ fontSize: 0 }}>
      <div className="px-3 py-2 border-b border-rule flex items-center gap-1.5">
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--signal)" strokeWidth={1.5}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8M16 17H8M10 9H8" /></svg>
        <span className="text-[10px] font-sans font-semibold text-ink">AI citation audit</span>
        <span className="ml-auto text-[8px] text-m-muted">2 cited / 2 ignored</span>
      </div>
      {citations.map((c, i) => (
        <div key={i} className="px-3 py-2 flex items-center gap-2" style={{ borderTop: i > 0 ? '1px solid var(--rule)' : 'none' }}>
          {c.icon === 'check' ? (
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={c.color} strokeWidth={2}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>
          ) : (
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={c.color} strokeWidth={2}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1={12} y1={9} x2={12} y2={13} /><line x1={12} y1={17} x2={12.01} y2={17} /></svg>
          )}
          <span className="text-[10px] text-ink flex-1">{c.page}</span>
          <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: c.color, background: `color-mix(in srgb, ${c.color} 12%, transparent)` }}>{c.type}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Model Benchmark mockup ── */
function MockModelBenchmark() {
  const models = [
    { name: 'Claude', score: 82, accurate: 7, partial: 2, wrong: 1 },
    { name: 'GPT-4o', score: 68, accurate: 5, partial: 3, wrong: 2 },
    { name: 'Gemini', score: 74, accurate: 6, partial: 2, wrong: 2 },
  ]
  return (
    <div className="w-full border border-rule rounded-lg bg-paper overflow-hidden" style={{ fontSize: 0 }}>
      <div className="px-3 py-2 border-b border-rule flex items-center gap-1.5">
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--signal)" strokeWidth={1.5}><line x1={18} y1={20} x2={18} y2={10} /><line x1={12} y1={20} x2={12} y2={4} /><line x1={6} y1={20} x2={6} y2={14} /></svg>
        <span className="text-[10px] font-sans font-semibold text-ink">AI accuracy by model</span>
      </div>
      <div className="p-3 space-y-2.5">
        {models.map((m, i) => {
          const color = m.score >= 70 ? 'var(--ok)' : m.score >= 40 ? 'var(--warn)' : 'var(--severe)'
          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-ink">{m.name}</span>
                <span className="text-[10px] font-bold" style={{ color }}>{m.score}%</span>
              </div>
              <div className="w-full h-1 rounded-full bg-paper-2">
                <div className="h-full rounded-full" style={{ width: `${m.score}%`, background: color }} />
              </div>
              <div className="flex gap-2 mt-0.5">
                <span className="text-[7px] text-ok">{m.accurate} correct</span>
                <span className="text-[7px] text-warn">{m.partial} partial</span>
                <span className="text-[7px] text-severe">{m.wrong} wrong</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Fix Playbook mockup ── */
function MockFixPlaybook() {
  return (
    <div className="w-full border border-rule rounded-lg bg-paper overflow-hidden" style={{ fontSize: 0 }}>
      <div className="px-3 py-2 border-b border-rule flex items-center gap-1.5">
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--signal)" strokeWidth={1.5}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
        <span className="text-[10px] font-sans font-semibold text-ink">Fix playbooks</span>
        <span className="ml-auto text-[8px] text-m-muted">3 snippets</span>
      </div>
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[7px] font-semibold text-signal bg-signal/10 px-1.5 py-0.5 rounded-full">json_ld</span>
          <span className="text-[9px] font-medium text-ink">Organization schema</span>
        </div>
        <pre className="bg-paper-2 border border-rule rounded p-2 text-[7px] font-mono text-ink-2 leading-relaxed overflow-hidden" style={{ maxHeight: 80 }}>
{`<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Acme Corp",
  "url": "https://acme.com"
}
</script>`}
        </pre>
      </div>
    </div>
  )
}

/* ── Finding Card mockup (3-panel) ── */
function MockFindingCard() {
  return (
    <div className="w-full border border-rule rounded-lg bg-paper overflow-hidden" style={{ fontSize: 0 }}>
      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2 border-b border-rule">
        <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full text-severe bg-severe/10">Critical</span>
        <span className="text-[10px] font-semibold text-ink flex-1">CTA button uses vague label</span>
      </div>
      {/* 3-panel */}
      <div className="grid grid-cols-3 text-left">
        <div className="p-2.5 border-r border-rule">
          <span className="text-[7px] font-semibold text-m-muted tracking-[0.04em] uppercase block mb-1">Issue</span>
          <p className="text-[8px] text-ink-2 leading-[1.4]">Button says &ldquo;Click here&rdquo; without context. Users and AI cannot determine the action.</p>
        </div>
        <div className="p-2.5 border-r border-rule">
          <span className="text-[7px] font-semibold text-m-muted tracking-[0.04em] uppercase block mb-1">How to fix</span>
          <p className="text-[8px] text-ink-2 leading-[1.4]">Change to &ldquo;Start free trial&rdquo; or &ldquo;View pricing&rdquo; — specific, action-oriented labels.</p>
        </div>
        <div className="p-2.5">
          <span className="text-[7px] font-semibold text-m-muted tracking-[0.04em] uppercase block mb-1">Impact</span>
          <p className="text-[8px] text-ink-2 leading-[1.4]">Conversion rate increase of 22%. Screen readers can&apos;t announce meaningful link purpose.</p>
        </div>
      </div>
    </div>
  )
}

/* ── Category Score Overview mockup ── */
function MockCategoryScores() {
  const modules = [
    { name: 'Foundation', score: 81, dot: '#6366F1' },
    { name: 'Human Experience', score: 62, dot: '#EC4899' },
    { name: 'Inclusive Design', score: 74, dot: '#10B981' },
    { name: 'Future Readiness', score: 55, dot: '#F59E0B' },
    { name: 'Brand Consistency', score: 78, dot: '#3B82F6' },
    { name: 'SEO Structure', score: 70, dot: '#06B6D4' },
  ]
  return (
    <div className="w-full border border-rule rounded-lg bg-paper overflow-hidden" style={{ fontSize: 0 }}>
      <div className="p-4 flex items-center gap-4">
        <MockScoreRing score={68} size={56} color="var(--warn)" />
        <div className="flex-1">
          <p className="text-[11px] font-semibold text-ink mb-1">acme.com</p>
          <div className="space-y-1">
            {modules.map(m => (
              <div key={m.name} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.dot }} />
                <span className="text-[8px] text-m-muted flex-1">{m.name}</span>
                <span className="text-[8px] font-medium" style={{ color: m.score >= 70 ? 'var(--ok)' : 'var(--warn)' }}>{m.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Wellbeing / Dark Patterns mockup ── */
function MockWellbeingCard() {
  const checks = [
    { name: 'Confirmshaming detected', status: 'fail', severity: 'High' },
    { name: 'Forced continuity warning', status: 'fail', severity: 'Medium' },
    { name: 'Clear opt-out available', status: 'pass', severity: '' },
    { name: 'Honest pricing display', status: 'pass', severity: '' },
  ]
  return (
    <div className="w-full border border-rule rounded-lg bg-paper overflow-hidden" style={{ fontSize: 0 }}>
      <div className="px-3 py-2 border-b border-rule flex items-center gap-1.5">
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#EC4899" strokeWidth={1.5}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
        <span className="text-[10px] font-sans font-semibold text-ink">Digital wellbeing</span>
      </div>
      {checks.map((c, i) => (
        <div key={i} className="px-3 py-2 flex items-center gap-2" style={{ borderTop: i > 0 ? '1px solid var(--rule)' : 'none' }}>
          {c.status === 'pass' ? (
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth={2}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>
          ) : (
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="var(--severe)" strokeWidth={2}><circle cx={12} cy={12} r={10} /><line x1={15} y1={9} x2={9} y2={15} /><line x1={9} y1={9} x2={15} y2={15} /></svg>
          )}
          <span className="text-[10px] text-ink flex-1">{c.name}</span>
          {c.severity && (
            <span className="text-[7px] font-semibold px-1 py-0.5 rounded-full text-severe bg-severe/10">{c.severity}</span>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Mobile Responsiveness mockup ── */
function MockResponsivenessCard() {
  const viewports = [
    { name: 'Desktop 1440', icon: '///', status: 'pass' },
    { name: 'Laptop 1024', icon: '//', status: 'pass' },
    { name: 'Tablet 768', icon: '/', status: 'warn' },
    { name: 'Mobile 375', icon: '.', status: 'fail' },
  ]
  return (
    <div className="w-full border border-rule rounded-lg bg-paper overflow-hidden" style={{ fontSize: 0 }}>
      <div className="px-3 py-2 border-b border-rule flex items-center gap-1.5">
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--signal)" strokeWidth={1.5}><rect x={5} y={2} width={14} height={20} rx={2} ry={2} /><line x1={12} y1={18} x2={12.01} y2={18} /></svg>
        <span className="text-[10px] font-sans font-semibold text-ink">Responsive check</span>
      </div>
      {viewports.map((v, i) => (
        <div key={i} className="px-3 py-2 flex items-center gap-2" style={{ borderTop: i > 0 ? '1px solid var(--rule)' : 'none' }}>
          <span className="text-[10px] text-ink flex-1">{v.name}</span>
          <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full" style={{
            color: v.status === 'pass' ? 'var(--ok)' : v.status === 'warn' ? 'var(--warn)' : 'var(--severe)',
            background: `color-mix(in srgb, ${v.status === 'pass' ? 'var(--ok)' : v.status === 'warn' ? 'var(--warn)' : 'var(--severe)'} 12%, transparent)`,
          }}>
            {v.status === 'pass' ? 'OK' : v.status === 'warn' ? 'Issues' : 'Broken'}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ── Brand Audit mockup ── */
function MockBrandAudit() {
  const cats = [
    { name: 'Logo usage', score: 88 },
    { name: 'Color system', score: 72 },
    { name: 'Typography', score: 91 },
    { name: 'Voice and tone', score: 65 },
    { name: 'Visual consistency', score: 78 },
  ]
  return (
    <div className="w-full border border-rule rounded-lg bg-paper overflow-hidden" style={{ fontSize: 0 }}>
      <div className="px-3 py-2 border-b border-rule flex items-center gap-1.5">
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--signal)" strokeWidth={1.5}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
        <span className="text-[10px] font-sans font-semibold text-ink">Brand identity audit</span>
      </div>
      <div className="p-3 space-y-2">
        {cats.map(c => {
          const color = c.score >= 80 ? 'var(--ok)' : c.score >= 65 ? 'var(--warn)' : 'var(--severe)'
          return (
            <div key={c.name}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] text-ink">{c.name}</span>
                <span className="text-[9px] font-medium" style={{ color }}>{c.score}</span>
              </div>
              <div className="w-full h-1 rounded-full bg-paper-2">
                <div className="h-full rounded-full" style={{ width: `${c.score}%`, background: color }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


/* ═══════════════════════════════════════════════════════════════
   HIGHLIGHT CARD DATA
   ═══════════════════════════════════════════════════════════════ */

const AI_CARDS: HighlightCard[] = [
  {
    label: 'AI probe',
    title: 'What AI knows about you',
    desc: 'We query leading AI models about your brand, products, and pricing — then grade each answer against your real content.',
    visual: <MockProbeCard />,
  },
  {
    label: 'AI vs human',
    title: 'Two perspectives on every finding',
    desc: 'Each issue shows how AI reads it alongside how a real user experiences it. Fix for both audiences at once.',
    visual: <MockAIvsHuman />,
  },
  {
    label: 'AI readability',
    title: 'Can AI actually read your pages?',
    desc: 'Page-by-page analysis of what AI can extract vs. what it misses. Know exactly which content is invisible to AI.',
    visual: <MockReadabilityMap />,
  },
  {
    label: 'Citation audit',
    title: 'Which pages get cited by AI',
    desc: 'See which of your pages AI models reference and which they ignore completely. Fix your discoverability gaps.',
    visual: <MockCitationAudit />,
  },
  {
    label: 'Multi-model benchmark',
    title: 'Compare Claude, GPT-4o, Gemini',
    desc: 'Same questions, three models. See where each AI gets you right and where it hallucinates.',
    visual: <MockModelBenchmark />,
  },
  {
    label: 'Fix playbooks',
    title: 'Copy-paste fixes for AI visibility',
    desc: 'Ready-to-use JSON-LD schemas, meta tags, and llms.txt snippets. Paste them into your site and re-audit.',
    visual: <MockFixPlaybook />,
  },
]

const UX_CARDS: HighlightCard[] = [
  {
    label: 'Score overview',
    title: '6 modules, 96 checkpoints',
    desc: 'Every page scored across usability, accessibility, performance, content, SEO, and AI readiness — in one view.',
    visual: <MockCategoryScores />,
  },
  {
    label: '3-panel findings',
    title: 'Issue, fix, and impact — at a glance',
    desc: 'Every finding shows the problem, how to fix it, and the business impact. No guesswork, no extra clicks.',
    visual: <MockFindingCard />,
  },
  {
    label: 'AI vs human',
    title: 'How AI and humans read each issue',
    desc: 'Dual-perspective analysis on every finding. Understand the gap between machine interpretation and real-user experience.',
    visual: <MockAIvsHuman />,
  },
  {
    label: 'Digital wellbeing',
    title: 'Dark patterns and ethical design',
    desc: 'We check for confirmshaming, forced continuity, hidden costs, and other manipulative patterns. Build trust, not tricks.',
    visual: <MockWellbeingCard />,
  },
  {
    label: 'Responsive check',
    title: 'Tested at 4 viewport sizes',
    desc: 'Desktop, laptop, tablet, and mobile. Layout breaks, touch targets, and overflow — all caught automatically.',
    visual: <MockResponsivenessCard />,
  },
  {
    label: 'Brand audit',
    title: 'Cross-check your brand vs. live site',
    desc: 'Upload guidelines, we compare them against what is actually deployed. Spot every mismatch in logo, colors, tone, and typography.',
    visual: <MockBrandAudit />,
  },
]


/* ═══════════════════════════════════════════════════════════════
   FEATURE SECTION — large visual + text (SimilarWeb-style)
   ═══════════════════════════════════════════════════════════════ */

function FeatureSection({ marker, label, title, titleAccent, desc, features, visual, reverse = false }: {
  marker: string
  label: string
  title: string
  titleAccent: string
  desc: string
  features: Array<{ name: string; desc: string }>
  visual: React.ReactNode
  reverse?: boolean
}) {
  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          {/* Text side */}
          <div className={reverse ? 'lg:order-2' : ''}>
            <SectionMarker number={marker} label={label} />
            <h2 className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.022em] mb-5" style={{ fontSize: 'clamp(36px, 5vw, 60px)' }}>
              {title} <em className="italic text-signal">{titleAccent}</em>
            </h2>
            <p className="text-[17px] leading-[1.55] text-ink-2 font-sans mb-8">{desc}</p>
            <div className="space-y-0">
              {features.map((f) => (
                <div key={f.name} className="py-3 border-b border-rule last:border-b-0">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-signal font-mono text-[12px]">+</span>
                    <div>
                      <p className="text-[14px] font-sans font-semibold text-ink leading-snug mb-0.5">{f.name}</p>
                      <p className="text-[13px] font-sans text-ink-2 leading-[1.55]">{f.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Visual side */}
          <div className={reverse ? 'lg:order-1' : ''}>
            <div className="space-y-4">
              {visual}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}


/* ═══════════════════════════════════════════════════════════════
   HOW IT WORKS — 3 steps
   ═══════════════════════════════════════════════════════════════ */

const STEPS = [
  { num: '01', title: 'Choose your audit', desc: 'Paste a website URL for a UX audit. Upload brand guidelines for a brand audit. Both include AI visibility analysis.' },
  { num: '02', title: 'We run the engine', desc: '96 checkpoints across 6 modules. Multi-page crawl. AI model probing. Everything in parallel — results in minutes.' },
  { num: '03', title: 'You act on findings', desc: 'Every issue ranked by severity with evidence, recommendations, and exportable reports. Fix the critical items first.' },
]


/* ═══════════════════════════════════════════════════════════════
   SIX MODULES
   ═══════════════════════════════════════════════════════════════ */

const MODULES = [
  { num: '01', title: 'Foundation', desc: 'Visual design, messaging, navigation, content quality. The structural baseline every great experience needs.', count: 16 },
  { num: '02', title: 'Human Experience', desc: 'Clarity, cognitive load, dark patterns, conversion friction. Whether your UX respects real users.', count: 22 },
  { num: '03', title: 'Inclusive Design', desc: 'WCAG compliance, cognitive accessibility, mobile context, equity across abilities.', count: 18 },
  { num: '04', title: 'Future Readiness', desc: 'How AI models read your product. Performance, agent readiness, structured data.', count: 14 },
  { num: '05', title: 'Brand Consistency', desc: 'Voice, visual identity, tone alignment. Whether what users see matches what your brand promises.', count: 14 },
  { num: '06', title: 'SEO Structure', desc: 'Heading hierarchy, meta tags, structured data, crawlability. Be found and ranked properly.', count: 12 },
]


/* ═══════════════════════════════════════════════════════════════
   PLATFORM FEATURES — grid
   ═══════════════════════════════════════════════════════════════ */

function FeatureIcon({ type }: { type: string }) {
  const props = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className: "text-signal" }
  switch (type) {
    case 'refresh': return <svg {...props}><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" /></svg>
    case 'download': return <svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
    case 'share': return <svg {...props}><circle cx={18} cy={5} r={3} /><circle cx={6} cy={12} r={3} /><circle cx={18} cy={19} r={3} /><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" /></svg>
    case 'compare': return <svg {...props}><rect x={3} y={3} width={18} height={18} rx={2} /><path d="M12 3v18" /></svg>
    case 'trend': return <svg {...props}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
    case 'export': return <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
    default: return null
  }
}

const PLATFORM_FEATURES = [
  { title: 'Re-audit after every release', desc: 'Ship a fix, re-run the audit, track progress with historical scoring.', icon: 'refresh' },
  { title: 'Export PDF and Word reports', desc: 'Professional reports to share with stakeholders, clients, or leadership.', icon: 'download' },
  { title: 'Share with a link', desc: 'Shareable audit results. No login required for viewers.', icon: 'share' },
  { title: 'Competitor comparison', desc: 'Audit a competitor. See where you lead and trail, side by side.', icon: 'compare' },
  { title: 'Score trends over time', desc: 'Watch your score improve as you ship fixes. Evidence your progress.', icon: 'trend' },
  { title: 'Exportable findings', desc: 'Copy individual sections or full reports. Paste into Jira, Notion, or Slack.', icon: 'export' },
]


/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function HowItWorksContent() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <main>
      {/* ── Product Hero ──────────────────────────────────────── */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="00" label="Product" />
          <h1 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-8" style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}>
            The complete<br className="max-sm:hidden" /> <em className="italic text-signal">UX audit platform.</em>
          </h1>
          <p className="text-[19px] leading-[1.55] text-ink-2 max-w-[640px] font-sans mb-10">
            Audit your website UX, brand identity, and AI visibility — all in one place. 96 checkpoints, 6 modules, three audit types. Severity-ranked findings with evidence and fixes, delivered in minutes.
          </p>
          <div className="flex gap-3.5 max-sm:flex-col max-sm:items-stretch">
            <Button href="/register">
              Start free audit
              <ArrowRightIcon size={14} />
            </Button>
            <Button href="/demo-report" variant="ghost">See a real report</Button>
          </div>
        </div>
      </section>

      {/* ── AI Visibility — Feature section with large visuals ── */}
      <FeatureSection
        marker="01"
        label="AI visibility"
        title="See how AI sees you."
        titleAccent="Control the narrative."
        desc="AI assistants are the new front page. We ask leading AI models about your business and grade their answers against your actual content. Find out what they get right, what they hallucinate, and how to fix it."
        features={[
          { name: 'AI probe engine', desc: 'We query Claude, GPT-4o, and Gemini about your brand. Each answer is graded against your real content.' },
          { name: 'Page-level readability', desc: 'Every page scored for AI readability. See exactly what AI can extract and what it misses.' },
          { name: 'Citation audit', desc: 'Which pages do AI models cite? Which do they ignore? Fix your discoverability gaps.' },
          { name: 'Fix playbooks', desc: 'Copy-paste JSON-LD, meta tags, and llms.txt that help AI understand you correctly.' },
        ]}
        visual={
          <>
            <MockProbeCard />
            <div className="grid grid-cols-2 gap-4">
              <MockReadabilityMap />
              <MockModelBenchmark />
            </div>
          </>
        }
      />

      {/* ── AI vs Human — dedicated section ──────────────────── */}
      <FeatureSection
        marker="02"
        label="Dual perspective"
        title="AI vs human."
        titleAccent="Two lenses on every issue."
        desc="Every finding in ClearUX shows two perspectives: how an AI model interprets the issue, and how a real user experiences it. This dual analysis helps you fix for both audiences at once — because your site needs to work for humans and machines."
        features={[
          { name: 'Machine interpretation', desc: 'How AI models read your content, parse your markup, and understand your intent — including where they get confused.' },
          { name: 'Human experience', desc: 'The real-world impact: what users actually feel, how friction affects conversion, where trust breaks down.' },
          { name: 'Prioritize with context', desc: 'A finding that hurts both AI and human experience is more urgent. Dual perspective helps you triage smarter.' },
        ]}
        visual={
          <>
            <MockAIvsHuman />
            <MockFindingCard />
          </>
        }
        reverse
      />

      {/* ── AI Scrolling Cards ─────────────────────────────────── */}
      <ScrollStrip
        cards={AI_CARDS}
        marker="03"
        markerLabel="AI X-Ray"
        heading="Your AI visibility,"
        headingAccent="fully mapped."
        subtitle="Six dedicated tools to understand and improve how AI models represent your brand. Scroll to explore what ClearUX shows you."
      />

      {/* ── UX + Human section — large visuals ─────────────────── */}
      <FeatureSection
        marker="04"
        label="Human experience"
        title="How real users"
        titleAccent="experience your site."
        desc="We don't just tell you what search engines or AI models see. ClearUX tells you how actual humans experience your product — cognitive load, dark patterns, wellbeing, accessibility, and conversion friction."
        features={[
          { name: 'Dark pattern detection', desc: 'Confirmshaming, forced continuity, hidden costs, urgency tricks — all flagged with severity and evidence.' },
          { name: 'Digital wellbeing', desc: 'Is your site designed to respect users? We check for manipulative design and addictive patterns.' },
          { name: 'Cognitive load analysis', desc: 'Too many choices, unclear hierarchy, competing CTAs — we measure what makes users hesitate.' },
          { name: 'Mobile responsiveness', desc: 'Every page tested at 4 viewport sizes. Layout breaks, touch targets, overflow — all caught.' },
        ]}
        visual={
          <>
            <MockWellbeingCard />
            <div className="grid grid-cols-2 gap-4">
              <MockResponsivenessCard />
              <MockCategoryScores />
            </div>
          </>
        }
        reverse
      />

      {/* ── UX Scrolling Cards ─────────────────────────────────── */}
      <ScrollStrip
        cards={UX_CARDS}
        marker="05"
        markerLabel="What you get"
        heading="Everything we show you."
        headingAccent="Nothing hidden."
        subtitle="From score breakdowns to copy-paste fixes, scroll to see the full range of what ClearUX delivers in every audit."
      />

      {/* ── Interstitial ─────────────────────────────────────── */}
      <section
        className="py-[100px] max-sm:py-[80px]"
        style={{ background: isDark ? 'var(--paper)' : 'var(--ink)', color: isDark ? 'var(--ink)' : '#ffffff' }}
      >
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5 text-center">
          <p className="font-sans font-normal leading-[1.3] tracking-[-0.01em] mx-auto mb-6 max-sm:mb-4"
            style={{ fontSize: '19px', color: isDark ? 'var(--m-muted)' : 'rgba(255,255,255,0.4)', maxWidth: '700px' }}>
            Other tools give you a score and a checklist.
          </p>
          <h2 className="font-serif font-normal leading-[1.05] tracking-[-0.03em] mx-auto"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)', color: isDark ? 'var(--ink)' : '#ffffff', maxWidth: '960px' }}>
            ClearUX tells you <em className="italic text-signal">what to fix</em> and <em className="italic text-signal">why.</em>
          </h2>
        </div>
      </section>

      {/* ── How it works — 3 steps ────────────────────────────── */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="06" label="How it works" />
          <h2 className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.02em] mb-14" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
            Three steps. <em className="italic text-signal">Minutes, not weeks.</em>
          </h2>
          <div className="grid md:grid-cols-3 gap-0 border border-ink">
            {STEPS.map((step, i) => (
              <div key={step.num} className={`p-8 ${i < STEPS.length - 1 ? 'md:border-r border-ink max-md:border-b' : ''}`}>
                <span className="font-serif text-[56px] font-normal leading-none block mb-5" style={{ color: 'color-mix(in srgb, var(--ink) 12%, transparent)' }}>
                  {step.num}
                </span>
                <h3 className="font-sans text-[17px] font-medium text-ink mb-3">{step.title}</h3>
                <p className="font-sans text-[15px] text-ink-2 leading-[1.6]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Six modules ──────────────────────────────────────── */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <div className="mb-16 grid lg:grid-cols-[1fr_1.2fr] gap-20 items-end max-lg:grid-cols-1 max-lg:gap-6">
            <div>
              <SectionMarker number="07" label="The instrument" />
              <h2 className="font-serif font-normal text-ink leading-[0.98] tracking-[-0.022em]" style={{ fontSize: 'clamp(40px, 5vw, 72px)' }}>
                Six modules. <em className="italic text-signal">96</em> checkpoints.
              </h2>
            </div>
            <p className="text-[17px] text-ink-2 leading-[1.55] max-w-[540px] font-sans">
              Every audit runs the full battery. No tiered plans, no &ldquo;upgrade to unlock.&rdquo; Foundation through SEO Structure — same depth, every time.
            </p>
          </div>
          <div className="grid grid-cols-3 border-t border-l border-ink max-md:grid-cols-2 max-sm:grid-cols-1">
            {MODULES.map((mod) => (
              <div key={mod.num} className="border-r border-b border-ink p-7 sm:p-8 bg-paper hover:bg-paper-2 transition-colors min-h-[240px] flex flex-col">
                <div className="font-mono text-[11px] text-signal font-semibold tracking-[0.08em] mb-3">
                  {mod.num} / {mod.title}
                </div>
                <h3 className="font-serif font-normal text-[28px] tracking-[-0.015em] leading-[1.05] mb-3 text-ink">
                  {mod.title}
                </h3>
                <p className="text-[14px] leading-[1.55] text-ink-2 mb-auto pb-5 font-sans">
                  {mod.desc}
                </p>
                <div className="flex items-baseline pt-4 border-t border-dashed border-rule-2 font-mono text-[10px] text-m-muted tracking-[0.06em] uppercase">
                  <strong className="font-serif text-[24px] font-normal text-ink normal-case tracking-[-0.02em] mr-2">{mod.count}</strong>
                  checkpoints
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform features ─────────────────────────────────── */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="08" label="Platform" />
          <h2 className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.02em] mb-5" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
            Everything you need to <em className="italic text-signal">ship better.</em>
          </h2>
          <p className="text-[17px] text-ink-2 leading-[1.55] max-w-[540px] font-sans mb-14">
            Beyond findings — ClearUX gives you the tools to track progress, share results, and prove your work.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-l border-rule">
            {PLATFORM_FEATURES.map((feat) => (
              <div key={feat.title} className="border-r border-b border-rule p-7 hover:bg-paper-2/50 transition-colors">
                <div className="mb-4">
                  <FeatureIcon type={feat.icon} />
                </div>
                <h3 className="font-sans text-[15px] font-semibold text-ink mb-2">{feat.title}</h3>
                <p className="font-sans text-[14px] text-ink-2 leading-[1.55]">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom stat strip ─────────────────────────────────── */}
      <section className="py-[80px] border-b border-rule max-sm:py-14">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <div className="grid sm:grid-cols-4 gap-8 sm:gap-0 sm:divide-x sm:divide-rule">
            <div className="text-center sm:px-6">
              <p className="font-serif text-[48px] text-ink tracking-[-0.02em] leading-none mb-2">96</p>
              <p className="font-mono text-[11px] text-m-muted tracking-[0.08em] uppercase">Checkpoints per audit</p>
            </div>
            <div className="text-center sm:px-6">
              <p className="font-serif text-[48px] text-ink tracking-[-0.02em] leading-none mb-2">6</p>
              <p className="font-mono text-[11px] text-m-muted tracking-[0.08em] uppercase">Modules</p>
            </div>
            <div className="text-center sm:px-6">
              <p className="font-serif text-[48px] text-ink tracking-[-0.02em] leading-none mb-2">3</p>
              <p className="font-mono text-[11px] text-m-muted tracking-[0.08em] uppercase">Audit types</p>
            </div>
            <div className="text-center sm:px-6">
              <p className="font-serif text-[48px] text-ink tracking-[-0.02em] leading-none mb-2">$0</p>
              <p className="font-mono text-[11px] text-m-muted tracking-[0.08em] uppercase">First audit, no card needed</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <Coda />
    </main>
  )
}
