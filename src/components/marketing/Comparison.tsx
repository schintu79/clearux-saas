'use client'

import { SectionMarker } from './SectionMarker'
import { useTheme } from '@/context/ThemeContext'

/* ── Card data — 3 severity tiers, each with competitor vs ClearUX ── */

const cards = [
  {
    severity: 'critical' as const,
    label: 'Critical',
    category: 'Dark Patterns',
    competitor: {
      tool: 'SEO tools',
      title: 'Missing meta description',
      detail: 'Page /pricing has no meta description tag. Search engines will auto-generate a snippet.',
      verdict: 'Technical. Fixable in 2 minutes.',
    },
    clearux: {
      title: 'Forced urgency creates false scarcity',
      detail: '"Only 2 left!" counter resets on every visit. Users who notice lose trust in all pricing claims.',
      verdict: 'Trust-destroying. Costing you customers silently.',
    },
  },
  {
    severity: 'high' as const,
    label: 'High',
    category: 'Inclusive Design',
    competitor: {
      tool: 'Accessibility scanners',
      title: 'Image missing alt text',
      detail: '3 images on /about lack alt attributes. Automated check — no context on impact or priority.',
      verdict: 'A checklist item. No business context.',
    },
    clearux: {
      title: 'Checkout flow not keyboard-operable',
      detail: 'Payment form traps focus inside the card number field. Tab key skips the "Pay" button. Users on keyboard or switch devices cannot complete purchase.',
      verdict: 'Revenue lost. Real users blocked from paying.',
    },
  },
  {
    severity: 'medium' as const,
    label: 'Medium',
    category: 'AI Readiness',
    competitor: {
      tool: 'Performance tools',
      title: 'Render-blocking JavaScript',
      detail: 'Two scripts delay first contentful paint by 0.4s. Lighthouse flags it as an optimization opportunity.',
      verdict: 'A speed metric. Marginal improvement.',
    },
    clearux: {
      title: 'Content invisible to AI assistants',
      detail: 'Product pricing is rendered via client-side JS only. LLMs and AI agents cannot extract your plans. You are invisible in AI-generated recommendations.',
      verdict: 'Invisible to the next generation of discovery.',
    },
  },
]

/* ── Severity colors ──────────────────────────────────────── */

const sevColors: Record<string, { dot: string; text: string }> = {
  critical: { dot: 'var(--severe)', text: 'var(--severe)' },
  high:     { dot: 'var(--warn)',   text: 'var(--warn)' },
  medium:   { dot: 'var(--signal)', text: 'var(--signal)' },
}

/* ── Component ─────────────────────────────────────────────── */

export function Comparison() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <>
      {/* ── Interstitial banner ─────────────────────────────── */}
      <section
        className="py-[120px] max-sm:py-[80px]"
        style={{
          background: isDark ? 'var(--paper)' : 'var(--ink)',
          color: isDark ? 'var(--ink)' : '#ffffff',
        }}
      >
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <div className="text-center mb-16 max-sm:mb-10">
            {/* Line 1 — smaller, subdued: the competitor reality */}
            <p
              className="font-sans font-normal leading-[1.3] tracking-[-0.01em] mx-auto mb-6 max-sm:mb-4"
              style={{ fontSize: '19px', color: isDark ? 'var(--m-muted)' : 'rgba(255,255,255,0.4)', maxWidth: '700px' }}
            >
              Other tools measure how happy Google is with your site.
            </p>
            {/* Line 2 — large, high contrast: the ClearUX promise */}
            <h2
              className="font-serif font-normal leading-[1.05] tracking-[-0.03em] mx-auto"
              style={{ fontSize: 'clamp(48px, 7vw, 96px)', color: isDark ? 'var(--ink)' : '#ffffff', maxWidth: '960px' }}
            >
              Fixpath audits the{' '}
              <em className="italic text-signal">human</em>{' '}
              experience.
            </h2>
          </div>

          {/* UX heuristic evaluation scorecard */}
          {(() => {
            const borderClr = isDark ? 'var(--rule)' : 'rgba(255,255,255,0.15)'
            return (
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${borderClr}`, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)' }}>
                {/* Header */}
                <div className="px-8 py-5 flex items-center gap-3 max-sm:px-5" style={{ borderBottom: `1px solid ${borderClr}` }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={isDark ? 'var(--signal)' : '#A4B26A'} strokeWidth={1.5}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                  <span className="font-sans text-[15px] font-semibold" style={{ color: isDark ? 'var(--ink)' : '#fff' }}>UX heuristic evaluation</span>
                  <span className="ml-auto font-mono text-[11px] tracking-[0.06em] uppercase" style={{ color: isDark ? 'var(--m-muted)' : 'rgba(255,255,255,0.4)' }}>acme.com · 14 heuristics</span>
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
                          borderBottom: isNotLastRow ? `1px solid ${borderClr}` : 'none',
                          borderRight: !isRight ? `1px solid ${borderClr}` : 'none',
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
                          <p className="font-sans text-[13px] font-medium leading-snug" style={{ color: isDark ? 'var(--ink)' : '#fff' }}>{h.name}</p>
                          <p className="font-sans text-[11px] leading-[1.5] mt-0.5" style={{ color: isDark ? 'var(--m-muted)' : 'rgba(255,255,255,0.45)' }}>{h.detail}</p>
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
                <div className="px-8 py-4 flex items-center gap-6 max-sm:px-5 max-sm:flex-wrap max-sm:gap-3" style={{ borderTop: `1px solid ${borderClr}` }}>
                  {[
                    { label: 'Passed', count: 5, color: '#22c55e' },
                    { label: 'Needs review', count: 4, color: '#f59e0b' },
                    { label: 'Failed', count: 3, color: '#ef4444' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                      <span className="font-sans text-[12px]" style={{ color: isDark ? 'var(--m-muted)' : 'rgba(255,255,255,0.5)' }}>
                        <strong style={{ color: isDark ? 'var(--ink)' : '#fff' }}>{s.count}</strong> {s.label}
                      </span>
                    </div>
                  ))}
                  <span className="ml-auto font-mono text-[11px] tracking-[0.06em] uppercase" style={{ color: isDark ? 'var(--signal)' : '#A4B26A' }}>
                    Score: 62 / 100
                  </span>
                </div>
              </div>
            )
          })()}
        </div>
      </section>

      {/* ── The difference — 3 comparison cards ─────────────── */}
      <section className="py-[120px] max-sm:py-[80px] border-b border-rule">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">

          {/* Section header */}
          <div className="mb-16 max-sm:mb-10">
            <SectionMarker number="03" label="The difference" />
            <h2
              className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.022em]"
              style={{ fontSize: 'clamp(36px, 4.8vw, 64px)' }}
            >
              Same site.{' '}
              <em className="italic text-m-muted">Different</em>{' '}
              findings.
            </h2>
            <p className="text-[17px] leading-[1.55] text-ink-2 font-sans mt-5 max-w-[540px]">
              Three real findings, side by side. What traditional tools flag versus what Fixpath surfaces.
            </p>
          </div>

          {/* 3 cards */}
          <div className="grid lg:grid-cols-3 gap-5 max-lg:grid-cols-1">
            {cards.map((card) => {
              const colors = sevColors[card.severity]
              return (
                <div
                  key={card.severity}
                  className="rounded-xl overflow-hidden flex flex-col"
                  style={{ border: '1px solid var(--rule)', background: 'var(--paper)' }}
                >
                  {/* Card header — severity + category */}
                  <div
                    className="px-6 py-4 flex items-center justify-between"
                    style={{ borderBottom: '1px solid var(--rule)' }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: colors.dot }}
                      />
                      <span
                        className="font-mono text-[11px] tracking-[0.1em] uppercase font-semibold"
                        style={{ color: colors.text }}
                      >
                        {card.label}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] tracking-[0.06em] uppercase text-m-muted">
                      {card.category}
                    </span>
                  </div>

                  {/* Competitor side — readable but clearly secondary */}
                  <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--rule)', background: 'var(--paper-2)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="font-mono text-[10px] tracking-[0.08em] uppercase font-medium px-2 py-0.5 rounded"
                        style={{ background: 'var(--paper-3)', color: 'var(--m-muted)' }}
                      >
                        {card.competitor.tool}
                      </span>
                    </div>
                    <p className="text-[13px] font-sans font-medium text-ink/70 leading-[1.4] mb-1.5">
                      {card.competitor.title}
                    </p>
                    <p className="text-[12px] font-sans text-m-muted leading-[1.5] mb-3">
                      {card.competitor.detail}
                    </p>
                    <p className="text-[11px] font-mono tracking-[0.02em] text-m-muted italic">
                      {card.competitor.verdict}
                    </p>
                  </div>

                  {/* ClearUX side — white background, bold, full contrast */}
                  <div className="px-6 py-5 flex-1" style={{ background: 'var(--paper)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="font-mono text-[10px] tracking-[0.08em] uppercase font-semibold px-2.5 py-1 rounded"
                        style={{ background: 'var(--ink)', color: 'var(--paper)' }}
                      >
                        Fixpath
                      </span>
                    </div>
                    <p className="text-[15px] font-sans font-semibold text-ink leading-[1.35] mb-2">
                      {card.clearux.title}
                    </p>
                    <p className="text-[13px] font-sans text-ink-2 leading-[1.55] mb-3">
                      {card.clearux.detail}
                    </p>
                    <p className="text-[12px] font-mono tracking-[0.02em] font-semibold text-ink">
                      {card.clearux.verdict}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bottom stat strip */}
          <div className="grid sm:grid-cols-3 mt-14 gap-8 sm:gap-0 sm:divide-x sm:divide-rule">
            <div className="text-center sm:px-6">
              <p className="font-serif text-[48px] text-ink tracking-[-0.02em] leading-none mb-2">112</p>
              <p className="font-mono text-[11px] text-m-muted tracking-[0.08em] uppercase">UX checkpoints per audit</p>
            </div>
            <div className="text-center sm:px-6">
              <p className="font-serif text-[48px] text-ink tracking-[-0.02em] leading-none mb-2">7</p>
              <p className="font-mono text-[11px] text-m-muted tracking-[0.08em] uppercase">modules — foundation to AI readiness</p>
            </div>
            <div className="text-center sm:px-6">
              <p className="font-serif text-[48px] text-ink tracking-[-0.02em] leading-none mb-2">$0</p>
              <p className="font-mono text-[11px] text-m-muted tracking-[0.08em] uppercase">first audit, no card required</p>
            </div>
          </div>

        </div>
      </section>
    </>
  )
}
