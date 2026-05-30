'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

/* ── Audit data for each type ── */

type AuditSlide = {
  type: string
  label: string
  site: string
  auditId: string
  targetScore: number
  checkpointsTotal: number
  checkpointsComplete: number
  module: string
  moduleProgress: string
  criticalCount: number
  findings: { sev: string; label: string; mod: string }[]
}

const SLIDES: AuditSlide[] = [
  {
    type: 'Website',
    label: 'Website audit',
    site: 'acme-finance.com',
    auditId: '#4827',
    targetScore: 62,
    checkpointsTotal: 112,
    checkpointsComplete: 74,
    module: '6/7',
    moduleProgress: '77%',
    criticalCount: 4,
    findings: [
      { sev: 'Critical', label: 'Login flow exposes 3 dark-pattern signals', mod: 'HX-12' },
      { sev: 'Critical', label: 'LLM agents misread your pricing page', mod: 'FR-04' },
      { sev: 'Medium', label: 'CTA contrast fails AA on hover state', mod: 'ID-06' },
      { sev: 'Minor', label: 'Hero meta description exceeds 158 chars', mod: 'SEO-02' },
    ],
  },
  {
    type: 'Brand',
    label: 'Brand identity audit',
    site: 'Northwind Brand Guidelines.pdf',
    auditId: '#4831',
    targetScore: 79,
    checkpointsTotal: 84,
    checkpointsComplete: 84,
    module: '7/7',
    moduleProgress: '100%',
    criticalCount: 0,
    findings: [
      { sev: 'Medium', label: 'Value proposition lacks proof points', mod: 'VP-03' },
      { sev: 'Medium', label: 'Tone shifts formal → casual across docs', mod: 'TV-07' },
      { sev: 'Minor', label: 'Secondary colour usage inconsistent', mod: 'VC-02' },
      { sev: 'Minor', label: 'Headline copy relies on cliches', mod: 'WQ-05' },
    ],
  },
  {
    type: 'Design',
    label: 'Design audit',
    site: 'Checkout Redesign v2.1',
    auditId: '#4833',
    targetScore: 71,
    checkpointsTotal: 78,
    checkpointsComplete: 66,
    module: '4/6',
    moduleProgress: '85%',
    criticalCount: 2,
    findings: [
      { sev: 'Critical', label: 'Colour contrast fails WCAG AA on 4 elements', mod: 'A11Y-01' },
      { sev: 'Critical', label: 'No focus states on interactive components', mod: 'A11Y-04' },
      { sev: 'Medium', label: 'Touch targets under 44px on mobile', mod: 'RD-03' },
      { sev: 'Minor', label: 'Loading state missing on data table', mod: 'IX-08' },
    ],
  },
]

const CYCLE_INTERVAL = 5000 // ms between slides
const SCORE_STEP_MS = 22   // ms between score ticks
const FADE_MS = 400        // crossfade duration

function sevClass(sev: string) {
  if (sev === 'Critical') return 'bg-[var(--signal-soft-2)] text-signal border border-[var(--signal-soft-2)]'
  if (sev === 'Medium') return 'bg-[rgba(217,184,94,0.18)] text-[#D9B85E] border border-[rgba(217,184,94,0.35)]'
  return 'bg-[rgba(255,255,255,0.06)] text-[rgba(242,237,227,0.65)] border border-[rgba(242,237,227,0.15)]'
}

export function SpecimenCard() {
  const [slideIdx, setSlideIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [contentOpacity, setContentOpacity] = useState(1)
  const [findingsVisible, setFindingsVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scoreRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const slide = SLIDES[slideIdx]

  // Animate score counting up
  const animateScore = useCallback((target: number) => {
    let val = 0
    setScore(0)
    setFindingsVisible(false)

    const step = () => {
      val += 1
      setScore(val)
      if (val < target) {
        scoreRef.current = setTimeout(step, SCORE_STEP_MS)
      } else {
        // Score done → show findings
        setFindingsVisible(true)
      }
    }
    scoreRef.current = setTimeout(step, 200)
  }, [])

  // Cycle slides
  useEffect(() => {
    // Initial score animation
    animateScore(SLIDES[0].targetScore)

    const cycle = () => {
      // Fade out
      setContentOpacity(0)

      timerRef.current = setTimeout(() => {
        setSlideIdx(prev => {
          const next = (prev + 1) % SLIDES.length
          // Animate score for new slide
          animateScore(SLIDES[next].targetScore)
          return next
        })
        // Fade in
        setContentOpacity(1)
      }, FADE_MS)
    }

    const interval = setInterval(cycle, CYCLE_INTERVAL)
    return () => {
      clearInterval(interval)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (scoreRef.current) clearTimeout(scoreRef.current)
    }
  }, [animateScore])

  return (
    <div className="rounded-[4px] overflow-hidden" style={{ background: 'var(--specimen-bg)', color: 'var(--specimen-fg)', boxShadow: 'var(--shadow-card)' }}>
      {/* Header */}
      <div className="px-[22px] py-[18px] border-b flex items-center justify-between font-mono text-[10px] tracking-[0.1em] uppercase" style={{ borderColor: 'var(--specimen-rule)', color: 'var(--specimen-muted)' }}>
        <span style={{ transition: `opacity ${FADE_MS}ms ease`, opacity: contentOpacity }}>
          {slide.label} · Audit {slide.auditId}
        </span>
        {/* Slide indicators */}
        <div className="flex gap-1.5">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{
                background: i === slideIdx ? 'var(--signal)' : 'rgba(242, 237, 227, 0.18)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Body */}
      <div
        className="px-[22px] pt-[26px] pb-[22px]"
        style={{ transition: `opacity ${FADE_MS}ms ease`, opacity: contentOpacity }}
      >
        <div className="font-mono text-[12px] flex items-center gap-2.5 mb-1" style={{ color: 'var(--specimen-fg)' }}>
          <span className="w-1.5 h-1.5 bg-signal rounded-full" style={{ animation: 'm-pulse-signal 1.6s infinite' }} />
          {slide.site}
        </div>
        <div className="font-mono text-[10px] tracking-[0.1em] uppercase mb-[26px]" style={{ color: 'var(--specimen-muted)' }}>
          {slide.checkpointsComplete === slide.checkpointsTotal ? 'Complete' : 'Live'} · {slide.checkpointsComplete}/{slide.checkpointsTotal} checkpoints complete
        </div>

        {/* Score row */}
        <div className="flex items-end justify-between pb-[22px] mb-[22px]" style={{ borderBottom: '1px dashed var(--specimen-rule)' }}>
          <div className="font-serif text-[92px] font-normal leading-[0.9] tracking-[-0.04em]" style={{ color: 'var(--specimen-fg)' }}>
            {score}
          </div>
          <div className="text-right font-mono text-[10px] tracking-[0.08em] uppercase" style={{ color: 'var(--specimen-muted)' }}>
            {slide.checkpointsComplete === slide.checkpointsTotal ? 'Final score' : 'Provisional score'}
            {slide.criticalCount > 0 ? (
              <strong className="block text-signal font-semibold mt-1">
                ↓ {slide.criticalCount} critical {slide.criticalCount === 1 ? 'issue' : 'issues'}
              </strong>
            ) : (
              <strong className="block font-semibold mt-1" style={{ color: 'var(--ok)' }}>
                No critical issues
              </strong>
            )}
          </div>
        </div>

        {/* Checkpoint list */}
        <ul className="list-none">
          {slide.findings.map((cp, i) => (
            <li
              key={`${slideIdx}-${cp.mod}`}
              className="grid grid-cols-[auto_1fr_auto] gap-3.5 items-center py-[11px] text-[13px]"
              style={{
                borderBottom: i < slide.findings.length - 1 ? '1px solid rgba(242, 237, 227, 0.08)' : 'none',
                color: 'rgba(242, 237, 227, 0.85)',
                opacity: findingsVisible ? 1 : 0,
                transform: findingsVisible ? 'translateY(0)' : 'translateY(6px)',
                transition: `opacity 0.4s ease ${i * 0.12}s, transform 0.4s ease ${i * 0.12}s`,
              }}
            >
              <span className={`inline-block font-mono text-[9px] font-semibold tracking-[0.08em] uppercase px-[7px] py-[3px] rounded-[2px] leading-none ${sevClass(cp.sev)}`}>
                {cp.sev}
              </span>
              <span>{cp.label}</span>
              <span className="font-mono text-[10px] text-right" style={{ color: 'rgba(242, 237, 227, 0.45)' }}>{cp.mod}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <div
        className="px-[22px] py-3.5 flex justify-between items-center font-mono text-[11px] tracking-[0.05em]"
        style={{
          background: 'rgba(255,255,255,0.03)',
          borderTop: '1px solid var(--specimen-rule)',
          color: 'var(--specimen-muted)',
          transition: `opacity ${FADE_MS}ms ease`,
          opacity: contentOpacity,
        }}
      >
        <span>Scanning · module {slide.module}</span>
        <span className="text-signal">{slide.moduleProgress}</span>
      </div>
    </div>
  )
}
