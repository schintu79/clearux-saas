'use client'

import { SectionMarker } from './SectionMarker'
import { Search, Wrench, TrendingUp, AlertTriangle, CheckCircle2, ArrowUp } from 'lucide-react'

/**
 * HomeWorkflow — Find. Fix. Track.
 * Three visual columns, each with a mini dashboard mockup and short copy.
 * Brief: "most sellable and understandable section on the page."
 */

/* ── Mini visual: Find — severity-ranked finding card ─────── */
function FindVisual() {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'color-mix(in srgb, var(--ink) 2.5%, var(--paper))' }}>
      {/* Header bar */}
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid color-mix(in srgb, var(--ink) 5%, transparent)' }}>
        <Search size={12} style={{ color: 'var(--signal)' }} />
        <span className="font-sans text-[10px] font-semibold text-ink">Audit findings</span>
        <span className="ml-auto font-sans text-[9px] text-m-muted">14 issues found</span>
      </div>
      {/* Finding rows */}
      <div className="p-3 space-y-2">
        {[
          { severity: 'Critical', color: 'var(--severe)', title: 'Missing H1 tag on homepage', cat: 'SEO' },
          { severity: 'High',     color: '#F97316',       title: 'Low contrast on CTA buttons', cat: 'Accessibility' },
          { severity: 'Medium',   color: 'var(--warn)',    title: 'No structured data detected', cat: 'AI Readiness' },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-lg px-3 py-2.5 flex items-start gap-2.5"
            style={{ background: `color-mix(in srgb, ${f.color} 4%, transparent)` }}
          >
            <AlertTriangle size={11} className="mt-0.5 shrink-0" style={{ color: f.color }} />
            <div className="flex-1 min-w-0">
              <p className="font-sans text-[11px] font-semibold text-ink leading-tight truncate">{f.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="font-sans text-[8px] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded"
                  style={{ color: f.color, background: `color-mix(in srgb, ${f.color} 10%, transparent)` }}
                >
                  {f.severity}
                </span>
                <span className="font-sans text-[9px] text-m-muted">{f.cat}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Mini visual: Fix — recommendation + deploy panel ─────── */
function FixVisual() {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'color-mix(in srgb, var(--ink) 2.5%, var(--paper))' }}>
      {/* Header bar */}
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid color-mix(in srgb, var(--ink) 5%, transparent)' }}>
        <Wrench size={12} style={{ color: 'var(--signal)' }} />
        <span className="font-sans text-[10px] font-semibold text-ink">Fix console</span>
        <span className="ml-auto font-sans text-[9px] text-m-muted">Ready to deploy</span>
      </div>
      <div className="p-3 space-y-2.5">
        {/* Finding being fixed */}
        <div className="rounded-lg px-3 py-2" style={{ background: 'color-mix(in srgb, var(--ok) 5%, transparent)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <CheckCircle2 size={10} style={{ color: 'var(--ok)' }} />
            <span className="font-sans text-[10px] font-semibold text-ink">Missing H1 tag on homepage</span>
          </div>
          <p className="font-sans text-[9px] text-m-muted leading-[1.5]">
            Add &lt;h1&gt; tag with primary keyword to improve SEO ranking signal.
          </p>
        </div>
        {/* Code diff preview */}
        <div className="rounded-lg p-2.5 font-mono text-[9px] leading-[1.6]" style={{ background: 'color-mix(in srgb, var(--ink) 4%, var(--paper))' }}>
          <div style={{ color: 'var(--severe)' }}>- &lt;div class=&quot;hero-title&quot;&gt;</div>
          <div style={{ color: 'var(--ok)' }}>+ &lt;h1 class=&quot;hero-title&quot;&gt;</div>
          <div className="text-m-muted">&nbsp;&nbsp;Your website, analyzed.</div>
          <div style={{ color: 'var(--severe)' }}>- &lt;/div&gt;</div>
          <div style={{ color: 'var(--ok)' }}>+ &lt;/h1&gt;</div>
        </div>
        {/* Deploy button */}
        <div className="flex gap-2">
          <span className="flex-1 font-sans text-[10px] font-semibold text-center py-1.5 rounded-lg" style={{ background: 'var(--signal)', color: 'white' }}>
            Deploy fix
          </span>
          <span className="font-sans text-[10px] font-medium text-center py-1.5 px-3 rounded-lg" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
            Edit
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── Mini visual: Track — score trend + improvement ──────── */
function TrackVisual() {
  const points = [
    { label: 'Jan', score: 52 },
    { label: 'Feb', score: 58 },
    { label: 'Mar', score: 65 },
    { label: 'Apr', score: 71 },
    { label: 'May', score: 78 },
    { label: 'Jun', score: 84 },
  ]
  const w = 240
  const h = 100
  const pad = { top: 8, right: 8, bottom: 20, left: 24 }
  const cw = w - pad.left - pad.right
  const ch = h - pad.top - pad.bottom
  const minS = 40
  const maxS = 100

  const pts = points.map((d, i) => ({
    x: pad.left + (i / (points.length - 1)) * cw,
    y: pad.top + ch - ((d.score - minS) / (maxS - minS)) * ch,
    label: d.label,
    score: d.score,
  }))
  const linePath = `M${pts.map((p) => `${p.x},${p.y}`).join('L')}`
  const areaPath = `${linePath}L${pts[pts.length - 1].x},${pad.top + ch}L${pts[0].x},${pad.top + ch}Z`

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'color-mix(in srgb, var(--ink) 2.5%, var(--paper))' }}>
      {/* Header bar */}
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid color-mix(in srgb, var(--ink) 5%, transparent)' }}>
        <TrendingUp size={12} style={{ color: 'var(--signal)' }} />
        <span className="font-sans text-[10px] font-semibold text-ink">Score over time</span>
        <span className="ml-auto flex items-center gap-1 font-sans text-[9px] font-semibold" style={{ color: 'var(--ok)' }}>
          <ArrowUp size={9} />
          +32 pts
        </span>
      </div>
      <div className="p-3">
        {/* Trend chart */}
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
          <defs>
            <linearGradient id="workflowTrackGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--signal)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#workflowTrackGrad)" />
          <path d={linePath} fill="none" stroke="var(--signal)" strokeWidth={1.5} strokeLinejoin="round" />
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={2.5} fill="var(--paper)" stroke="var(--signal)" strokeWidth={1} />
              <text x={p.x} y={pad.top + ch + 12} textAnchor="middle" fontSize="6" fill="var(--m-muted)"
                style={{ fontFamily: 'var(--font-sans, system-ui, sans-serif)' }}>{p.label}</text>
            </g>
          ))}
        </svg>
        {/* Improvement badges */}
        <div className="flex gap-2 mt-3">
          {[
            { label: 'SEO', change: '+12' },
            { label: 'Accessibility', change: '+8' },
            { label: 'Trust', change: '+6' },
          ].map((b) => (
            <span
              key={b.label}
              className="flex-1 text-center rounded-lg py-1.5 font-sans text-[9px]"
              style={{ background: 'color-mix(in srgb, var(--ok) 6%, transparent)' }}
            >
              <span className="text-ink font-medium">{b.label}</span>{' '}
              <span className="font-semibold" style={{ color: 'var(--ok)' }}>{b.change}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Main section ─────────────────────────────────────────── */
export function HomeWorkflow() {
  return (
    <section className="pt-[140px] pb-[120px] border-b border-rule max-sm:pt-20 max-sm:pb-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <SectionMarker number="01" label="How it works" centered />
        <h2
          className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6 text-center"
          style={{ fontSize: 'clamp(36px, 7vw, 96px)' }}
        >
          Find. Fix.{' '}
          <em className="italic text-signal">Track.</em>
        </h2>
        <p className="text-[18px] max-sm:text-[15px] leading-[1.6] text-ink-2 max-w-[560px] mx-auto mb-20 max-sm:mb-10 font-sans text-center">
          Enter your URL. Get severity-ranked, evidence-backed findings in minutes.
          Fix what is verified first. Re-audit to confirm improvement.
        </p>

        <div className="grid lg:grid-cols-3 gap-6 max-sm:gap-4">
          {/* Find */}
          <div
            className="rounded-xl p-5 max-sm:p-4 flex flex-col"
            style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}
          >
            <div className="mb-5 max-sm:mb-4">
              <h3 className="font-sans text-[20px] max-sm:text-[17px] font-semibold text-ink mb-2">Find</h3>
              <p className="font-sans text-[14px] text-ink-2 leading-[1.6]">
                Direct checks, page evidence, and structured analysis surface what is actually hurting trust, clarity, and performance.
              </p>
            </div>
            <FindVisual />
          </div>

          {/* Fix */}
          <div
            className="rounded-xl p-5 max-sm:p-4 flex flex-col"
            style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}
          >
            <div className="mb-5 max-sm:mb-4">
              <h3 className="font-sans text-[20px] max-sm:text-[17px] font-semibold text-ink mb-2">Fix</h3>
              <p className="font-sans text-[14px] text-ink-2 leading-[1.6]">
                Every issue includes what was verified, what was observed, and why it matters. Fix high-confidence problems first.
              </p>
            </div>
            <FixVisual />
          </div>

          {/* Track */}
          <div
            className="rounded-xl p-5 max-sm:p-4 flex flex-col"
            style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}
          >
            <div className="mb-5 max-sm:mb-4">
              <h3 className="font-sans text-[20px] max-sm:text-[17px] font-semibold text-ink mb-2">Track</h3>
              <p className="font-sans text-[14px] text-ink-2 leading-[1.6]">
                Track what improved, what remains, and where confidence grows as coverage deepens over time.
              </p>
            </div>
            <TrackVisual />
          </div>
        </div>
      </div>
    </section>
  )
}
