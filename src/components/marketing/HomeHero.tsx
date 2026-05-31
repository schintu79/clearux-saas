'use client'

import { useEffect, useState, useRef } from 'react'
import { Button } from './Button'
import { SectionMarker } from './SectionMarker'
import { ArrowRightIcon } from './icons'

/* ── Rotating words for hero headline ──────────────────────── */
const ROTATING_WORDS = ['trust', 'clarity', 'SEO', 'UX', 'accessibility', 'conversions', 'credibility']

/* ── Findings that appear in the animated visual ───────────── */
const FINDINGS = [
  { id: 1, sev: 'Critical', sevColor: 'var(--severe)',  label: 'Dark-pattern signals erode user trust on login', cat: 'Human exp.', catColor: '#EC4899' },
  { id: 2, sev: 'High',     sevColor: '#F97316',        label: 'AI agents misread pricing page structure',       cat: 'Future',     catColor: '#F59E0B' },
  { id: 3, sev: 'High',     sevColor: '#F97316',        label: 'Missing keyboard focus indicators',              cat: 'Accessibility', catColor: '#EF4444' },
  { id: 4, sev: 'Medium',   sevColor: 'var(--warn)',    label: 'CTA contrast fails WCAG AA on hover state',     cat: 'Inclusive',  catColor: '#8B5CF6' },
  { id: 5, sev: 'Medium',   sevColor: 'var(--warn)',    label: 'H1 hierarchy broken on 3 inner pages',          cat: 'Foundation', catColor: '#3B82F6' },
  { id: 6, sev: 'Low',      sevColor: 'var(--m-muted)', label: 'Meta description exceeds 158 characters',       cat: 'SEO',        catColor: '#10B981' },
]

/* Score progression as findings get fixed */
const SCORE_STEPS = [47, 54, 61, 68, 74, 79, 84]

function useRotatingWord(words: string[], intervalMs = 2400) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % words.length)
        setVisible(true)
      }, 300)
    }, intervalMs)
    return () => clearInterval(timer)
  }, [words.length, intervalMs])

  return { word: words[index], visible }
}

/* ── Animated dashboard visual ─────────────────────────────── */
function AuditAnimation() {
  const [fixedCount, setFixedCount] = useState(0)
  const [visibleFindings, setVisibleFindings] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasStarted = useRef(false)

  /* Intersection observer — start animation when in view */
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted.current) {
          hasStarted.current = true
          runAnimation()
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function runAnimation() {
    /* Phase 1: reveal findings one by one */
    let i = 0
    const revealTimer = setInterval(() => {
      i++
      setVisibleFindings(i)
      if (i >= FINDINGS.length) {
        clearInterval(revealTimer)
        /* Phase 2: fix findings one by one after a pause */
        setTimeout(() => {
          let f = 0
          const fixTimer = setInterval(() => {
            f++
            setFixedCount(f)
            if (f >= FINDINGS.length) {
              clearInterval(fixTimer)
              /* Restart after a long pause */
              setTimeout(() => {
                setVisibleFindings(0)
                setFixedCount(0)
                hasStarted.current = false
                /* Re-trigger on next intersection */
                const el = containerRef.current
                if (el) {
                  const obs = new IntersectionObserver(
                    ([entry]) => {
                      if (entry.isIntersecting && !hasStarted.current) {
                        hasStarted.current = true
                        runAnimation()
                      }
                    },
                    { threshold: 0.3 }
                  )
                  obs.observe(el)
                }
              }, 4000)
            }
          }, 800)
        }, 1200)
      }
    }, 500)
  }

  const currentScore = SCORE_STEPS[Math.min(fixedCount, SCORE_STEPS.length - 1)]
  const scoreColor = currentScore >= 75 ? 'var(--ok)' : currentScore >= 50 ? 'var(--warn)' : 'var(--severe)'
  const scoreLabel = currentScore >= 75 ? 'Good' : currentScore >= 50 ? 'Needs work' : 'Poor'
  const totalFindings = FINDINGS.length
  const activeFindings = Math.max(0, visibleFindings - fixedCount)

  return (
    <div ref={containerRef} className="mt-16 max-w-[920px] mx-auto">
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', boxShadow: '0 8px 40px -12px rgba(0,0,0,0.10)' }}
      >
        {/* Browser chrome */}
        <div className="px-5 py-3 border-b flex items-center gap-3" style={{ borderColor: 'var(--rule)' }}>
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FF5F57' }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FEBC2E' }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#28C840' }} />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2 px-4 py-1 rounded-md" style={{ background: 'var(--paper)' }}>
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="var(--m-muted)" strokeWidth={2}><rect x={3} y={11} width={18} height={11} rx={2} /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              <span className="font-mono text-[10px] tracking-[0.04em] text-m-muted">fixpath.ai/dashboard</span>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {/* Top row: Score + summary stats */}
          <div className="flex items-stretch gap-4 mb-5 max-sm:flex-col">
            {/* Health score — large animated number */}
            <div
              className="rounded-xl p-5 flex flex-col items-center justify-center min-w-[140px]"
              style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}
            >
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-m-muted mb-2">Health score</p>
              <p
                className="font-serif text-[52px] font-normal tracking-[-0.04em] leading-none mb-1"
                style={{ color: scoreColor, transition: 'color 0.6s ease' }}
              >
                <span
                  key={currentScore}
                  style={{
                    display: 'inline-block',
                    animation: 'scoreUp 0.5s ease-out',
                  }}
                >
                  {currentScore}
                </span>
              </p>
              <p
                className="font-mono text-[9px] tracking-[0.08em] uppercase"
                style={{ color: scoreColor, transition: 'color 0.6s ease' }}
              >
                {scoreLabel}
              </p>
            </div>

            {/* Stats cards */}
            <div className="flex-1 grid grid-cols-3 gap-3">
              <div className="rounded-xl p-4 flex flex-col items-center justify-center" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
                <p className="font-mono text-[8px] tracking-[0.1em] uppercase text-m-muted mb-1.5">Active issues</p>
                <p className="font-serif text-[28px] font-normal tracking-[-0.02em] leading-none text-ink">{activeFindings}</p>
              </div>
              <div className="rounded-xl p-4 flex flex-col items-center justify-center" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
                <p className="font-mono text-[8px] tracking-[0.1em] uppercase text-m-muted mb-1.5">Fixed</p>
                <p className="font-serif text-[28px] font-normal tracking-[-0.02em] leading-none" style={{ color: 'var(--ok)' }}>{fixedCount}</p>
              </div>
              <div className="rounded-xl p-4 flex flex-col items-center justify-center" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
                <p className="font-mono text-[8px] tracking-[0.1em] uppercase text-m-muted mb-1.5">Improvement</p>
                <p className="font-serif text-[28px] font-normal tracking-[-0.02em] leading-none" style={{ color: 'var(--signal)' }}>
                  +{currentScore - SCORE_STEPS[0]}
                </p>
              </div>
            </div>
          </div>

          {/* Findings list — items appear, then get fixed */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
            <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--rule)', background: 'var(--paper-2)' }}>
              <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-m-muted">Findings</span>
              <span className="font-mono text-[9px] tracking-[0.06em] text-m-muted">
                {visibleFindings > 0 ? `${activeFindings} active · ${fixedCount} fixed` : 'Scanning...'}
              </span>
            </div>

            <div className="min-h-[228px]">
              {FINDINGS.map((f, i) => {
                const isVisible = i < visibleFindings
                const isFixed = i < fixedCount

                return (
                  <div
                    key={f.id}
                    className="px-4 py-3 flex items-center gap-3"
                    style={{
                      borderBottom: i < FINDINGS.length - 1 ? '1px solid var(--rule)' : 'none',
                      opacity: isVisible ? (isFixed ? 0.4 : 1) : 0,
                      transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
                      transition: 'opacity 0.4s ease, transform 0.4s ease',
                    }}
                  >
                    {/* Severity badge */}
                    <span
                      className="font-mono text-[8px] font-semibold tracking-[0.08em] uppercase px-1.5 py-0.5 rounded shrink-0"
                      style={{
                        color: isFixed ? 'var(--m-muted)' : f.sevColor,
                        background: isFixed
                          ? 'color-mix(in srgb, var(--m-muted) 8%, transparent)'
                          : `color-mix(in srgb, ${f.sevColor} 12%, transparent)`,
                        transition: 'color 0.4s, background 0.4s',
                      }}
                    >
                      {isFixed ? 'Fixed' : f.sev}
                    </span>

                    {/* Finding label */}
                    <p
                      className="font-sans text-[13px] leading-snug flex-1 min-w-0 truncate"
                      style={{
                        color: isFixed ? 'var(--m-muted)' : 'var(--ink)',
                        textDecoration: isFixed ? 'line-through' : 'none',
                        transition: 'color 0.4s',
                      }}
                    >
                      {f.label}
                    </p>

                    {/* Category tag */}
                    <span
                      className="font-mono text-[9px] tracking-[0.06em] uppercase shrink-0 hidden sm:block"
                      style={{
                        color: isFixed ? 'var(--m-muted)' : f.catColor,
                        transition: 'color 0.4s',
                      }}
                    >
                      {f.cat}
                    </span>

                    {/* Fixed checkmark */}
                    <span
                      className="shrink-0 hidden sm:flex items-center justify-center w-5 h-5 rounded-full"
                      style={{
                        background: isFixed ? 'color-mix(in srgb, var(--ok) 12%, transparent)' : 'transparent',
                        transition: 'background 0.4s',
                      }}
                    >
                      {isFixed && (
                        <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
                          <path d="M3 6l2 2 4-4" stroke="var(--ok)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* CSS keyframe for score number bounce */}
      <style>{`
        @keyframes scoreUp {
          0% { transform: translateY(8px); opacity: 0.3; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

/* ── Hero section ──────────────────────────────────────────── */
export function HomeHero() {
  const { word, visible } = useRotatingWord(ROTATING_WORDS)

  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        {/* Centered header block */}
        <div className="text-center max-w-[960px] mx-auto">
          <SectionMarker number="00" label="Website audit engine" centered />

          <h1
            className="font-serif font-normal text-ink leading-[1] tracking-[-0.025em] mb-8"
            style={{ fontSize: 'clamp(44px, 6.5vw, 88px)' }}
          >
            Find what hurts{' '}
            <span
              className="inline-block text-signal italic min-w-[2.5ch]"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(6px)',
                transition: 'opacity 0.3s ease, transform 0.3s ease',
              }}
            >
              {word}
            </span>
            <span className="text-signal">.</span>
            <br />
            <em className="italic text-signal">Fix what matters.</em>
          </h1>

          <p className="text-[19px] leading-[1.55] text-ink-2 max-w-[600px] mx-auto font-sans mb-10">
            Fixpath finds real issues across clarity, trust, accessibility, and technical quality
            — prioritizes them by impact, gives you fix guidance, and tracks whether
            things improve. No noise. No inflated scores. Just useful truth.
          </p>

          <div className="flex gap-3.5 justify-center max-sm:flex-col max-sm:items-stretch">
            <Button href="/register">
              Start free audit
              <ArrowRightIcon size={14} />
            </Button>
            <Button href="/how-it-works" variant="ghost">
              See how it works
            </Button>
          </div>
        </div>

        {/* Animated audit visual */}
        <AuditAnimation />
      </div>
    </section>
  )
}
