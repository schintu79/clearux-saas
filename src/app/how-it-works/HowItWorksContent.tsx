'use client'

import { useRef } from 'react'
import { SectionMarker } from '@/components/marketing/SectionMarker'
import { Button } from '@/components/marketing/Button'
import { ArrowRightIcon } from '@/components/marketing/icons'
import { HomeCta } from '@/components/marketing/HomeCta'
import { FaqPreview } from '@/components/marketing/FaqPreview'
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
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -440 : 440, behavior: 'smooth' })
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
          <div className="flex gap-2 flex-shrink-0 mb-4">
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
          <div key={i} className="flex-shrink-0 w-[440px] max-sm:w-[340px] snap-start border border-rule rounded-xl overflow-hidden bg-white/80 hover:border-signal/30 transition-colors group">
            {/* Visual area */}
            <div className="h-[300px] border-b border-rule p-6 flex items-center justify-center overflow-hidden">
              <div style={{ transform: 'scale(1.18)', transformOrigin: 'center center', width: '85%' }}>
                {card.visual}
              </div>
            </div>
            {/* Text */}
            <div className="p-6">
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
    <div className="w-full border border-rule rounded-lg text-left overflow-hidden" style={{ fontSize: 0 }}>
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
    <div className="w-full border border-rule rounded-lg overflow-hidden" style={{ fontSize: 0 }}>
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
    <div className="w-full border border-rule rounded-lg overflow-hidden" style={{ fontSize: 0 }}>
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
    <div className="w-full border border-rule rounded-lg overflow-hidden" style={{ fontSize: 0 }}>
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
    <div className="w-full border border-rule rounded-lg overflow-hidden" style={{ fontSize: 0 }}>
      <div className="px-3 py-2 border-b border-rule flex items-center gap-1.5">
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--signal)" strokeWidth={1.5}><line x1={18} y1={20} x2={18} y2={10} /><line x1={12} y1={20} x2={12} y2={4} /><line x1={6} y1={20} x2={6} y2={14} /></svg>
        <span className="text-[10px] font-sans font-semibold text-ink">What AI models say about your site</span>
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
    <div className="w-full border border-rule rounded-lg overflow-hidden" style={{ fontSize: 0 }}>
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
    <div className="w-full border border-rule rounded-lg overflow-hidden" style={{ fontSize: 0 }}>
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
    <div className="w-full border border-rule rounded-lg overflow-hidden" style={{ fontSize: 0 }}>
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

/* ── Radar / Spider Chart mockup ── */
function MockRadarChart() {
  const modules = [
    { name: 'Foundation', score: 73, color: '#6366F1' },
    { name: 'Human Experience', score: 75, color: '#EC4899' },
    { name: 'Inclusive Design', score: 75, color: '#F59E0B' },
    { name: 'Future Readiness', score: 75, color: '#2D6A4F' },
    { name: 'SEO Structure', score: 76, color: '#06B6D4' },
    { name: 'Brand Consistency', score: 75, color: '#10B981' },
  ]
  const n = modules.length
  const cx = 170, cy = 150, R = 70
  const angleStep = (2 * Math.PI) / n
  const startAngle = -Math.PI / 2 // top

  const point = (i: number, r: number) => {
    const a = startAngle + i * angleStep
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1]
  const gridPaths = rings.map(f => {
    const pts = Array.from({ length: n }, (_, i) => point(i, R * f))
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + ' Z'
  })

  // Data polygon
  const dataPts = modules.map((m, i) => point(i, R * (m.score / 100)))
  const dataPath = dataPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + ' Z'

  // Label positions (pushed outward)
  const labelR = R + 30
  const labels = modules.map((m, i) => {
    const [lx, ly] = point(i, labelR)
    let anchor: 'start' | 'middle' | 'end' = 'middle'
    if (lx < cx - 10) anchor = 'end'
    else if (lx > cx + 10) anchor = 'start'
    return { ...m, lx, ly, anchor }
  })

  return (
    <div className="w-full flex items-center justify-center">
      <svg viewBox="0 0 340 300" width="100%" style={{ maxWidth: 340 }}>
        {/* Grid rings */}
        {gridPaths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--rule)" strokeWidth={0.5} opacity={i === gridPaths.length - 1 ? 0.6 : 0.3} />
        ))}
        {/* Grid spokes */}
        {Array.from({ length: n }, (_, i) => {
          const [px, py] = point(i, R)
          return <line key={i} x1={cx} y1={cy} x2={px} y2={py} stroke="var(--rule)" strokeWidth={0.5} opacity={0.2} />
        })}
        {/* Data fill */}
        <path d={dataPath} fill="rgba(99,102,241,0.15)" stroke="#6366F1" strokeWidth={1.5} />
        {/* Data points */}
        {dataPts.map(([px, py], i) => (
          <g key={i}>
            <circle cx={px} cy={py} r={4} fill="white" stroke={modules[i].color} strokeWidth={1.5} />
          </g>
        ))}
        {/* Labels */}
        {labels.map((l, i) => (
          <g key={i}>
            <text x={l.lx} y={l.ly - 4} textAnchor={l.anchor} className="fill-ink" style={{ fontSize: 9, fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
              {l.name}
            </text>
            <text x={l.lx} y={l.ly + 8} textAnchor={l.anchor} style={{ fontSize: 9, fontFamily: 'var(--font-sans)', fontWeight: 600, fill: l.color }}>
              {l.score}
            </text>
          </g>
        ))}
      </svg>
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
    <div className="w-full border border-rule rounded-lg overflow-hidden" style={{ fontSize: 0 }}>
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
    <div className="w-full border border-rule rounded-lg overflow-hidden" style={{ fontSize: 0 }}>
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
    <div className="w-full border border-rule rounded-lg overflow-hidden" style={{ fontSize: 0 }}>
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
    desc: 'We ask AI about your brand, products, and pricing — then check if the answers match what is actually on your site.',
    visual: <MockProbeCard />,
  },
  {
    label: 'AI vs human',
    title: 'Two perspectives on every finding',
    desc: 'Every issue shows the AI view and the human view side by side. Fix both at once.',
    visual: <MockAIvsHuman />,
  },
  {
    label: 'AI readability',
    title: 'Can AI actually read your pages?',
    desc: 'Page by page, we show you what AI can read and what it completely misses.',
    visual: <MockReadabilityMap />,
  },
  {
    label: 'Citation audit',
    title: 'Which pages get cited by AI',
    desc: 'See which pages AI mentions to users and which it skips entirely.',
    visual: <MockCitationAudit />,
  },
  {
    label: 'Multi-model benchmark',
    title: 'Compare Claude, GPT-4o, Gemini',
    desc: 'Same questions asked to three AI models. See which ones get you right and which ones make things up.',
    visual: <MockModelBenchmark />,
  },
  {
    label: 'Fix playbooks',
    title: 'Copy-paste fixes for AI visibility',
    desc: 'Ready-to-use code snippets. Paste them into your site, re-audit, and watch your AI visibility improve.',
    visual: <MockFixPlaybook />,
  },
]

const UX_CARDS: HighlightCard[] = [
  {
    label: 'Score overview',
    title: '6 modules, 96 checkpoints',
    desc: 'Your whole site scored in one view — usability, accessibility, content quality, SEO, and AI readiness.',
    visual: <MockCategoryScores />,
  },
  {
    label: 'Heuristic radar',
    title: 'Your site across 6 dimensions',
    desc: 'See how your site scores on every audit pillar — spot weak areas and imbalances before users do.',
    visual: <MockRadarChart />,
  },
  {
    label: '3-panel findings',
    title: 'Issue, fix, and impact — at a glance',
    desc: 'Every issue shows the problem, the fix, and why it matters. Everything you need in one place.',
    visual: <MockFindingCard />,
  },
  {
    label: 'AI vs human',
    title: 'How AI and humans read each issue',
    desc: 'See both the AI view and the human view on every issue. Understand the full picture before you fix anything.',
    visual: <MockAIvsHuman />,
  },
  {
    label: 'Digital wellbeing',
    title: 'Dark patterns and ethical design',
    desc: 'We catch guilt-trip buttons, hidden fees, fake urgency, and other tricks that make users distrust your site.',
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
    desc: 'Upload your brand guidelines. We compare them against your live site and show every mismatch — colors, fonts, tone, logo usage.',
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
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
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
          {/* Visual side — larger with white background */}
          <div className={reverse ? 'lg:order-1' : ''}>
            <div className="bg-white/80 rounded-xl border border-rule p-8 overflow-hidden">
              <div style={{ transform: 'scale(1.15)', transformOrigin: 'top center' }}>
                <div className="space-y-4">
                  {visual}
                </div>
              </div>
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
  { num: '01', title: 'Paste your URL', desc: 'Enter your website address. That is it. We also support brand audits — just upload your brand guidelines.' },
  { num: '02', title: 'We scan everything', desc: 'We check 96 things across design, content, accessibility, and AI. Multiple pages, real browsers, AI models — all at once. Done in minutes.' },
  { num: '03', title: 'Fix what matters', desc: 'You get a list of issues ranked by importance. Each one tells you what is wrong, why it matters, and exactly how to fix it.' },
]


/* ═══════════════════════════════════════════════════════════════
   SIX MODULES
   ═══════════════════════════════════════════════════════════════ */

const MODULES = [
  { num: '01', title: 'Foundation', desc: 'Is your site well-built? We check visual design, navigation, messaging, and content quality — the basics that everything else depends on.', count: 16 },
  { num: '02', title: 'Human Experience', desc: 'Does your site respect users? We look for confusing layouts, dark patterns, pressure tactics, and anything that makes people leave.', count: 22 },
  { num: '03', title: 'Inclusive Design', desc: 'Can everyone use your site? Accessibility, mobile support, screen readers, touch targets, and cognitive accessibility — all checked.', count: 18 },
  { num: '04', title: 'Future Readiness', desc: 'Can AI understand your site? We test how AI models read your content, plus performance, structured data, and agent compatibility.', count: 14 },
  { num: '05', title: 'Brand Consistency', desc: 'Does your site match your brand? We compare what you say your brand is against what is actually live — colors, tone, logo usage, and more.', count: 14 },
  { num: '06', title: 'SEO Structure', desc: 'Can search engines find and rank you? Headings, meta tags, structured data, and crawlability — the technical foundation of being discoverable.', count: 12 },
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
  { title: 'Re-audit anytime', desc: 'Fixed something? Run the audit again and see your score go up. Track your progress over time.', icon: 'refresh' },
  { title: 'Download PDF or Word reports', desc: 'Get professional reports you can share with your team, clients, or leadership.', icon: 'download' },
  { title: 'Share with a link', desc: 'Send a link to anyone. They can see the results without creating an account.', icon: 'share' },
  { title: 'Compare with competitors', desc: 'Audit a competitor site. See exactly where you are ahead and where you are behind.', icon: 'compare' },
  { title: 'Track your progress', desc: 'See your score improve over time as you ship fixes. Prove your work with data.', icon: 'trend' },
  { title: 'Copy findings anywhere', desc: 'Copy individual issues or full reports. Paste into Jira, Notion, Slack, or anywhere else.', icon: 'export' },
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
            Find out what is wrong with your website — and exactly how to fix it. We check 96 things across design, usability, accessibility, and AI visibility. You get a ranked list of issues with clear fixes, ready in minutes.
          </p>
          <div className="flex gap-3.5 max-sm:flex-col max-sm:items-stretch">
            <Button href="/register">
              Start free audit
              <ArrowRightIcon size={14} />
            </Button>
            <Button href="#instrument" variant="ghost">See all modules</Button>
          </div>
        </div>
      </section>

      {/* ── AI Visibility — centered heading + clean visual ── */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          {/* Centered heading */}
          <div className="text-center mb-16 max-sm:mb-10">
            <SectionMarker number="01" label="AI visibility" centered />
            <h2 className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.022em] mb-6 mx-auto" style={{ fontSize: 'clamp(52px, 7vw, 96px)', maxWidth: 900 }}>
              See how AI sees you. <em className="italic text-signal">Control the narrative.</em>
            </h2>
            <p className="text-[19px] leading-[1.55] text-ink-2 font-sans mx-auto" style={{ maxWidth: 640 }}>
              People ask AI about your business every day. We ask ChatGPT, Claude, and Gemini about you — then check if their answers are correct. You see exactly where AI gets you wrong, and how to fix it.
            </p>
          </div>

          {/* Clean visual — probe card + readability side by side */}
          <div className="grid md:grid-cols-2 gap-5 mx-auto" style={{ maxWidth: 880 }}>
            {/* What AI knows */}
            <div className="bg-white rounded-xl border border-rule overflow-hidden">
              <div className="px-5 py-3.5 border-b border-rule flex items-center gap-2">
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--signal)" strokeWidth={1.5}><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" /><path d="M9 22h6" /></svg>
                <span className="text-[14px] font-sans font-semibold text-ink">What AI knows about your site</span>
              </div>
              {[
                { q: 'What is acme.com?', grade: 'Correct', color: 'var(--ok)' },
                { q: 'What products do they offer?', grade: 'Partial', color: 'var(--warn)' },
                { q: 'What is the pricing?', grade: 'Hallucinated', color: 'var(--severe)' },
                { q: 'Who founded the company?', grade: 'Correct', color: 'var(--ok)' },
              ].map((p, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between gap-3" style={{ borderTop: '1px solid var(--rule)' }}>
                  <span className="text-[13px] font-sans text-ink">{p.q}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: p.color, background: `color-mix(in srgb, ${p.color} 12%, transparent)` }}>{p.grade}</span>
                </div>
              ))}
            </div>

            {/* AI readability by page */}
            <div className="bg-white rounded-xl border border-rule overflow-hidden">
              <div className="px-5 py-3.5 border-b border-rule flex items-center gap-2">
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--signal)" strokeWidth={1.5}><circle cx={12} cy={12} r={10} /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                <span className="text-[14px] font-sans font-semibold text-ink">AI readability by page</span>
              </div>
              {[
                { path: '/', score: 92, color: 'var(--ok)' },
                { path: '/pricing', score: 78, color: 'var(--ok)' },
                { path: '/about', score: 45, color: 'var(--warn)' },
                { path: '/docs', score: 31, color: 'var(--severe)' },
              ].map((pg, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3" style={{ borderTop: '1px solid var(--rule)' }}>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--m-muted)" strokeWidth={1.5}><circle cx={12} cy={12} r={10} /><path d="M2 12h20" /></svg>
                  <span className="text-[13px] font-sans text-ink flex-1">{pg.path}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: pg.color, background: `color-mix(in srgb, ${pg.color} 12%, transparent)` }}>
                    AI {pg.score}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── AI vs Human — dark interstitial ──────────────────── */}
      <section
        className="py-[120px] max-sm:py-[80px]"
        style={{ background: isDark ? 'var(--paper)' : 'var(--ink)', color: isDark ? 'var(--ink)' : '#ffffff' }}
      >
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          {/* Centered heading */}
          <div className="text-center mb-16 max-sm:mb-10">
            <SectionMarker number="02" label="Dual perspective" centered dark={!isDark} />
            <h2 className="font-serif font-normal leading-[0.96] tracking-[-0.022em] mb-6 mx-auto" style={{ fontSize: 'clamp(52px, 7vw, 96px)', maxWidth: 900, color: isDark ? 'var(--ink)' : '#ffffff' }}>
              AI vs human. <em className="italic" style={{ color: isDark ? 'var(--signal)' : '#A4B26A' }}>Two lenses on every issue.</em>
            </h2>
            <p className="text-[19px] leading-[1.55] font-sans mx-auto" style={{ maxWidth: 640, color: isDark ? 'var(--m-muted)' : 'rgba(255,255,255,0.55)' }}>
              Every issue we find comes with two views: what AI thinks is wrong, and what a real user actually experiences. This helps you fix problems that affect both humans and AI at the same time.
            </p>
          </div>

          {/* AI vs Human visual card */}
          {(() => {
            const borderClr = isDark ? 'var(--rule)' : 'rgba(255,255,255,0.12)'
            const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)'
            const labelClr = isDark ? 'var(--m-muted)' : 'rgba(255,255,255,0.45)'
            const textClr = isDark ? 'var(--ink)' : '#ffffff'
            const subClr = isDark ? 'var(--ink-2)' : 'rgba(255,255,255,0.7)'
            return (
              <div className="rounded-xl overflow-hidden mx-auto" style={{ maxWidth: 880, border: `1px solid ${borderClr}`, background: cardBg }}>
                {/* Two perspectives */}
                <div className="grid md:grid-cols-2" style={{ borderBottom: `1px solid ${borderClr}` }}>
                  <div className="px-8 py-7 max-sm:px-5" style={{ borderRight: `1px solid ${borderClr}` }}>
                    <div className="flex items-center gap-2 mb-3">
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={labelClr} strokeWidth={1.5}><circle cx={12} cy={12} r={10} /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                      <span className="font-mono text-[11px] tracking-[0.08em] uppercase font-semibold" style={{ color: labelClr }}>How AI reads this</span>
                    </div>
                    <p className="font-sans text-[14px] leading-[1.6]" style={{ color: subClr }}>
                      The CTA button uses vague text. AI models can&apos;t determine the action behind &quot;Click here.&quot;
                    </p>
                  </div>
                  <div className="px-8 py-7 max-sm:px-5">
                    <div className="flex items-center gap-2 mb-3">
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={labelClr} strokeWidth={1.5}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx={12} cy={7} r={4} /></svg>
                      <span className="font-mono text-[11px] tracking-[0.08em] uppercase font-semibold" style={{ color: labelClr }}>How a human sees this</span>
                    </div>
                    <p className="font-sans text-[14px] leading-[1.6]" style={{ color: subClr }}>
                      Users hesitate because the button label doesn&apos;t tell them what happens next. Conversion drops 22%.
                    </p>
                  </div>
                </div>

                {/* Finding row */}
                <div className="px-8 py-5 max-sm:px-5 flex items-center gap-3" style={{ borderBottom: `1px solid ${borderClr}` }}>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.15)' }}>Critical</span>
                  <span className="font-sans text-[15px] font-semibold" style={{ color: textClr }}>CTA button uses vague label</span>
                </div>

                {/* Issue / Fix / Impact row */}
                <div className="grid md:grid-cols-3">
                  {[
                    { label: 'Issue', text: 'Button says "Click here" without context. Users and AI cannot determine the action.' },
                    { label: 'How to fix', text: 'Change to "Start free trial" or "View pricing" — specific, action-oriented labels.' },
                    { label: 'Impact', text: 'Conversion rate increase of 22%. Screen readers can announce meaningful link purpose.' },
                  ].map((col, i) => (
                    <div key={col.label} className="px-8 py-5 max-sm:px-5" style={{ borderRight: i < 2 ? `1px solid ${borderClr}` : 'none' }}>
                      <span className="font-mono text-[10px] tracking-[0.08em] uppercase font-semibold block mb-2" style={{ color: labelClr }}>{col.label}</span>
                      <p className="font-sans text-[13px] leading-[1.6]" style={{ color: subClr }}>{col.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      </section>

      {/* ── AI Scrolling Cards ─────────────────────────────────── */}
      <ScrollStrip
        cards={AI_CARDS}
        marker="03"
        markerLabel="AI X-Ray"
        heading="Your AI visibility,"
        headingAccent="fully mapped."
        subtitle="Six tools that show you exactly how AI sees your brand — and what to change. Scroll to see each one."
      />

      {/* ── UX + Human section — centered heading + heuristic scorecard ── */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          {/* Centered heading */}
          <div className="text-center mb-16 max-sm:mb-10">
            <SectionMarker number="04" label="Human experience" centered />
            <h2 className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.022em] mb-6 mx-auto" style={{ fontSize: 'clamp(52px, 7vw, 96px)', maxWidth: 900 }}>
              How real users <em className="italic text-signal">experience your site.</em>
            </h2>
            <p className="text-[19px] leading-[1.55] text-ink-2 font-sans mx-auto" style={{ maxWidth: 640 }}>
              Beyond what AI and search engines see — we check how real people experience your site. Confusing layouts, manipulative design, accessibility gaps, and anything that makes users leave.
            </p>
          </div>

          {/* UX heuristic evaluation scorecard */}
          <div className="rounded-xl overflow-hidden bg-white border border-rule">
            {/* Header */}
            <div className="px-8 py-5 flex items-center gap-3 max-sm:px-5 border-b border-rule">
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--signal)" strokeWidth={1.5}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
              <span className="font-sans text-[15px] font-semibold text-ink">UX heuristic evaluation</span>
              <span className="ml-auto font-mono text-[11px] tracking-[0.06em] uppercase text-m-muted">acme.com · 14 heuristics</span>
            </div>

            {/* Scorecard grid */}
            <div className="grid md:grid-cols-2">
              {[
                { name: 'Visibility of system status', status: 'pass', detail: 'Loading states and progress indicators present' },
                { name: 'Match between system and real world', status: 'pass', detail: 'Language matches user mental models' },
                { name: 'User control and freedom', status: 'warn', detail: 'No undo on destructive actions in checkout' },
                { name: 'Consistency and standards', status: 'pass', detail: 'UI patterns follow platform conventions' },
                { name: 'Error prevention', status: 'fail', detail: 'Form submits without validation on 3 pages' },
                { name: 'Recognition rather than recall', status: 'pass', detail: 'Navigation labels are descriptive' },
                { name: 'Flexibility and efficiency of use', status: 'warn', detail: 'No keyboard shortcuts for power users' },
                { name: 'Aesthetic and minimalist design', status: 'pass', detail: 'Content-to-chrome ratio is healthy' },
                { name: 'Help users recover from errors', status: 'fail', detail: 'Error messages are generic, no guidance' },
                { name: 'Help and documentation', status: 'warn', detail: 'FAQ exists but no contextual help' },
                { name: 'Dark pattern detection', status: 'fail', detail: 'Pre-checked consent box on signup form' },
                { name: 'Cognitive load assessment', status: 'warn', detail: 'Pricing page has 8 competing CTAs' },
              ].map((h, i) => {
                const statusColor = h.status === 'pass' ? '#22c55e' : h.status === 'warn' ? '#f59e0b' : '#ef4444'
                const statusLabel = h.status === 'pass' ? 'Pass' : h.status === 'warn' ? 'Review' : 'Fail'
                const isRight = i % 2 === 1
                const isNotLastRow = i < 10
                return (
                  <div
                    key={h.name}
                    className="px-6 py-4 flex items-start gap-3 max-sm:px-5"
                    style={{
                      borderBottom: isNotLastRow ? '1px solid var(--rule)' : 'none',
                      borderRight: !isRight ? '1px solid var(--rule)' : 'none',
                    }}
                  >
                    {h.status === 'pass' ? (
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={statusColor} strokeWidth={2} className="flex-shrink-0 mt-0.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>
                    ) : h.status === 'warn' ? (
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={statusColor} strokeWidth={2} className="flex-shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1={12} y1={9} x2={12} y2={13} /><line x1={12} y1={17} x2={12.01} y2={17} /></svg>
                    ) : (
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={statusColor} strokeWidth={2} className="flex-shrink-0 mt-0.5"><circle cx={12} cy={12} r={10} /><line x1={15} y1={9} x2={9} y2={15} /><line x1={9} y1={9} x2={15} y2={15} /></svg>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-[13px] font-medium leading-snug text-ink">{h.name}</p>
                      <p className="font-sans text-[11px] leading-[1.5] mt-0.5 text-m-muted">{h.detail}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5" style={{
                      color: statusColor,
                      background: `${statusColor}20`,
                    }}>{statusLabel}</span>
                  </div>
                )
              })}
            </div>

            {/* Footer summary */}
            <div className="px-8 py-4 flex items-center gap-6 max-sm:px-5 max-sm:flex-wrap max-sm:gap-3 border-t border-rule">
              {[
                { label: 'Passed', count: 5, color: '#22c55e' },
                { label: 'Needs review', count: 4, color: '#f59e0b' },
                { label: 'Failed', count: 3, color: '#ef4444' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  <span className="font-sans text-[12px] text-m-muted">
                    <strong className="text-ink">{s.count}</strong> {s.label}
                  </span>
                </div>
              ))}
              <span className="ml-auto font-mono text-[11px] tracking-[0.06em] uppercase text-signal">
                Score: 62 / 100
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── UX Scrolling Cards ─────────────────────────────────── */}
      <ScrollStrip
        cards={UX_CARDS}
        marker="05"
        markerLabel="What you get"
        heading="Everything we show you."
        headingAccent="Nothing hidden."
        subtitle="Scores, findings, fixes, and reports — scroll to see everything you get in a Fixpath audit."
      />

      {/* ── Interstitial ─────────────────────────────────────── */}
      <section
        className="py-[100px] max-sm:py-[80px]"
        style={{ background: isDark ? 'var(--paper)' : 'var(--ink)', color: isDark ? 'var(--ink)' : '#ffffff' }}
      >
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <div className="text-center mb-16 max-sm:mb-10">
            <p className="font-sans font-normal leading-[1.3] tracking-[-0.01em] mx-auto mb-6 max-sm:mb-4"
              style={{ fontSize: '19px', color: isDark ? 'var(--m-muted)' : 'rgba(255,255,255,0.4)', maxWidth: '700px' }}>
              Other tools give you a score and a checklist.
            </p>
            <h2 className="font-serif font-normal leading-[1.05] tracking-[-0.03em] mx-auto"
              style={{ fontSize: 'clamp(48px, 7vw, 96px)', color: isDark ? 'var(--ink)' : '#ffffff', maxWidth: '960px' }}>
              Fixpath tells you <em className="italic text-signal">what to fix</em> and <em className="italic text-signal">why.</em>
            </h2>
          </div>

          {/* Side-by-side: Other tools vs Fixpath */}
          {(() => {
            const borderClr = isDark ? 'var(--rule)' : 'rgba(255,255,255,0.12)'
            const mutedText = isDark ? 'var(--m-muted)' : 'rgba(255,255,255,0.4)'
            const bodyText = isDark ? 'var(--ink)' : 'rgba(255,255,255,0.85)'
            const headText = isDark ? 'var(--ink)' : '#fff'
            return (
              <div className="grid md:grid-cols-2 gap-5 mx-auto" style={{ maxWidth: 920 }}>
                {/* Other tools */}
                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${borderClr}`, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.04)' }}>
                  <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: `1px solid ${borderClr}` }}>
                    <span className="font-mono text-[10px] tracking-[0.08em] uppercase font-medium px-2 py-0.5 rounded" style={{ background: isDark ? 'var(--paper-3)' : 'rgba(255,255,255,0.08)', color: mutedText }}>Other tools</span>
                  </div>
                  <div className="px-6 py-5" style={{ borderBottom: `1px solid ${borderClr}` }}>
                    <p className="font-sans text-[14px] font-medium mb-1" style={{ color: bodyText, opacity: 0.7 }}>Missing meta description</p>
                    <p className="font-sans text-[12px] leading-[1.5]" style={{ color: mutedText }}>Page /pricing has no meta description tag.</p>
                  </div>
                  {[
                    { check: 'Add meta description', done: false },
                    { check: 'Add alt text to images', done: true },
                    { check: 'Fix heading hierarchy', done: false },
                    { check: 'Reduce page load time', done: true },
                  ].map((item, i) => (
                    <div key={i} className="px-6 py-3 flex items-center gap-3" style={{ borderBottom: i < 3 ? `1px solid ${borderClr}` : 'none' }}>
                      <div className="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center" style={{ borderColor: borderClr }}>
                        {item.done && <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={mutedText} strokeWidth={2.5}><path d="M20 6L9 17l-5-5" /></svg>}
                      </div>
                      <span className="font-sans text-[13px]" style={{ color: mutedText, textDecoration: item.done ? 'line-through' : 'none' }}>{item.check}</span>
                    </div>
                  ))}
                  <div className="px-6 py-3" style={{ borderTop: `1px solid ${borderClr}` }}>
                    <p className="font-mono text-[11px] italic" style={{ color: mutedText }}>A checklist. No context. No priority.</p>
                  </div>
                </div>

                {/* Fixpath */}
                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${borderClr}`, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.08)' }}>
                  <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: `1px solid ${borderClr}` }}>
                    <span className="font-mono text-[10px] tracking-[0.08em] uppercase font-semibold px-2.5 py-1 rounded" style={{ background: isDark ? 'var(--ink)' : '#fff', color: isDark ? 'var(--paper)' : 'var(--ink)' }}>Fixpath</span>
                  </div>
                  <div className="px-6 py-5" style={{ borderBottom: `1px solid ${borderClr}` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.15)' }}>Critical</span>
                      <span className="font-mono text-[10px] uppercase" style={{ color: mutedText }}>Dark Patterns</span>
                    </div>
                    <p className="font-sans text-[15px] font-semibold leading-snug mb-1.5" style={{ color: headText }}>Forced urgency creates false scarcity</p>
                    <p className="font-sans text-[13px] leading-[1.55]" style={{ color: bodyText }}>&ldquo;Only 2 left!&rdquo; counter resets on every visit. Users who notice lose trust in all pricing claims.</p>
                  </div>
                  <div className="grid grid-cols-3" style={{ borderBottom: `1px solid ${borderClr}` }}>
                    {[
                      { label: 'Impact', value: 'Trust erosion' },
                      { label: 'Fix time', value: '15 min' },
                      { label: 'Confidence', value: '94%' },
                    ].map((m, i) => (
                      <div key={m.label} className="px-4 py-3 text-center" style={{ borderRight: i < 2 ? `1px solid ${borderClr}` : 'none' }}>
                        <span className="font-mono text-[9px] tracking-[0.08em] uppercase block mb-1" style={{ color: mutedText }}>{m.label}</span>
                        <span className="font-sans text-[13px] font-semibold" style={{ color: headText }}>{m.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-6 py-4">
                    <span className="font-mono text-[9px] tracking-[0.08em] uppercase block mb-2" style={{ color: isDark ? 'var(--signal)' : '#A4B26A' }}>The fix</span>
                    <p className="font-sans text-[13px] leading-[1.55]" style={{ color: bodyText }}>Remove the fake counter. Replace with real inventory data or remove scarcity messaging entirely.</p>
                  </div>
                </div>
              </div>
            )
          })()}
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
              Every audit checks all six modules. No features locked behind paid plans. You always get the full picture.
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
            Beyond finding issues — Fixpath helps you track progress, share results, and show your team what changed.
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

      {/* FAQ */}
      <FaqPreview
        sectionNumber="08"
        items={[
          { q: 'What does the audit cover?', a: 'We evaluate 24 categories across six modules: Foundation (the structural and technical baseline), Human Experience (how your product feels to use), Inclusive Design (accessibility and equity), Future Readiness (AI discoverability), Brand Consistency (whether what users see matches the brand), and SEO Structure (findability and rankings).' },
          { q: 'How does the AI analysis work?', a: 'Our engine crawls your site, then runs each page through specialised AI models trained on UX best practices, WCAG guidelines, dark pattern databases, and conversion research. Each page is evaluated across six modules and 96 checkpoints. Every finding includes severity scoring, evidence, and a specific recommendation.' },
          { q: 'What AI powers the audits?', a: "Fixpath uses Anthropic's Claude as its core analysis engine — but the AI is only the final layer. Behind every audit is a proprietary evaluation framework built on years of UX research, accessibility consulting, and conversion optimisation." },
          { q: 'What format is the report?', a: 'You get a professional PDF and a Word document (DOCX). Both include an overall score, executive summary, top 3 priority recommendations, module score breakdown, and detailed findings ranked by severity with specific recommendations and impact estimates.' },
          { q: 'Can I re-audit the same website to measure improvement?', a: "Absolutely. Re-auditing the same URL is the best way to prove progress. Your dashboard shows re-audit badges and your stats track average scores over time. Audit the same site before and after implementing fixes to see your score improve." },
        ]}
      />

      {/* CTA */}
      <HomeCta />
    </main>
  )
}
