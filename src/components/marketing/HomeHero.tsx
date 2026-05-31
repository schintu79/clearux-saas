'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Button } from './Button'
import { SectionMarker } from './SectionMarker'
import { ArrowRightIcon } from './icons'
import {
  AlertTriangle, Search, Gauge, Radio, Heart, TrendingUp, Target,
  ChevronRight, RefreshCw, Zap, Move, ArrowUp,
  MousePointerClick, Eye, SmilePlus, BookOpen, Cpu,
} from 'lucide-react'

/* ── Scan stages ─────────────────────────────────────────── */
const SCAN_STAGES = [
  'Crawling pages',
  'Foundation',
  'Human Experience',
  'Inclusive Design',
  'Future Readiness',
  'SEO',
  'Accessibility',
  'Brand Consistency',
  'Generating report',
]

/*
 * Animation: scan → all 6 cards appear full-size → data populates on the go
 *   Phase 1 — Scan                    0 – 3 s
 *   Phase 2 — All cards visible       3 s   (empty / loading state)
 *   Phase 3 — Row 1 data builds       3.5 – 7 s
 *   Phase 4 — Row 2 data builds       5 – 8.5 s
 *   Phase 5 — Priority fix            9 – 10 s
 */

/* ── Data constants ────────────────────────────────────── */
const AUDIT_SCORE = 62
const ISSUES = { critical: 2, high: 3, medium: 5, low: 4 }
const SPEED_SCORE = 72
const BRAND_SCORE = 56

const MODULES = [
  { name: 'Foundation',    score: 78, color: '#3B82F6' },
  { name: 'Human Exp.',    score: 71, color: '#EC4899' },
  { name: 'Inclusive',      score: 86, color: '#8B5CF6' },
  { name: 'Future',         score: 69, color: '#F59E0B' },
  { name: 'SEO',            score: 91, color: '#10B981' },
  { name: 'Accessibility', score: 82, color: '#14B8A6' },
  { name: 'Brand',          score: 88, color: '#06B6D4' },
]

const STATIC_TREND = [
  { label: 'Jan', score: 46 },
  { label: 'Feb', score: 49 },
  { label: 'Mar', score: 52 },
  { label: 'Apr', score: 56 },
  { label: 'May', score: 59 },
]

const SPEED_METRICS = [
  { key: 'lcp', label: 'Loading time',    Icon: Zap,              value: '2.4s',  status: 'needs_improvement' as const },
  { key: 'cls', label: 'Visual stability', Icon: Move,             value: '0.08',  status: 'needs_improvement' as const },
  { key: 'inp', label: 'Responsiveness',   Icon: MousePointerClick, value: '120ms', status: 'good' as const },
]

const BRAND_METRICS = [
  { label: 'AI Visibility',  Icon: Eye,      value: '62%',     numVal: 62 },
  { label: 'Sentiment',      Icon: SmilePlus, value: 'Neutral', numVal: 50 },
  { label: 'AI Readability', Icon: BookOpen,  value: '58/100',  numVal: 58 },
  { label: 'Models tested',  Icon: Cpu,       value: '4',       numVal: 100 },
]

/* ── Helpers ───────────────────────────────────────────── */
function clamp01(t: number) { return Math.max(0, Math.min(1, t)) }
function easeOut(t: number) { return 1 - Math.pow(1 - t, 3) }

const GEIST = 'var(--font-sans, system-ui, sans-serif)'

function speedStatusColor(status: 'good' | 'needs_improvement' | 'poor') {
  if (status === 'good') return 'var(--ok)'
  if (status === 'needs_improvement') return 'var(--warn)'
  return 'var(--severe)'
}

function brandValueColor(v: number) {
  if (v >= 70) return 'var(--ok)'
  if (v >= 40) return 'var(--warn)'
  return 'var(--severe)'
}

/* ── Score ring ────────────────────────────────────────── */
function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const stroke = Math.round(size * 0.07)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? 'var(--ok)' : score >= 60 ? 'var(--warn)' : 'var(--severe)'

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--rule)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-sans text-center tabular-nums leading-none"
          style={{ fontSize: size * 0.32, fontWeight: 700, color }}>
          {score}
        </span>
      </div>
    </div>
  )
}

/* ── Mini radar chart ──────────────────────────────────── */
function MiniRadar({ modules, progress }: { modules: typeof MODULES; progress: number }) {
  const size = 200
  const cx = size / 2
  const cy = size / 2
  const r = 70
  const n = modules.length
  const angleStep = 360 / n

  function polar(angle: number, rad: number) {
    const a = (angle - 90) * (Math.PI / 180)
    return { x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a) }
  }

  const gridLevels = [25, 50, 75, 100]
  const gridPaths = gridLevels.map((level) => {
    const pts = Array.from({ length: n }, (_, i) => {
      const { x, y } = polar(i * angleStep, (level / 100) * r)
      return `${x},${y}`
    })
    return `M${pts.join('L')}Z`
  })

  const dataPoints = modules.map((m, i) => {
    const s = m.score * progress
    const { x, y } = polar(i * angleStep, (s / 100) * r)
    return { x, y, color: m.color }
  })
  const dataPath = `M${dataPoints.map((p) => `${p.x},${p.y}`).join('L')}Z`

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full max-h-[150px]">
      <defs>
        <linearGradient id="heroRadarFill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#6366F1" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {gridPaths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--rule)" strokeWidth={0.5} />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const { x, y } = polar(i * angleStep, r)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--rule)" strokeWidth={0.5} />
      })}
      {progress > 0.01 && (
        <path d={dataPath} fill="url(#heroRadarFill)" stroke="#6366F1" strokeWidth={1.5} />
      )}
      {progress > 0.01 && dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={p.color} />
      ))}
      {modules.map((m, i) => {
        const { x, y } = polar(i * angleStep, r + 16)
        return (
          <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="central"
            fontSize="7" fontWeight="600" fill="var(--m-muted)"
            style={{ fontFamily: GEIST }}>
            {progress > 0.01 ? Math.round(m.score * progress) : '—'}
          </text>
        )
      })}
    </svg>
  )
}

/* ── Mini line chart ───────────────────────────────────── */
function MiniLineChart({ lastScore, lastPointProgress = 1 }: { lastScore: number; lastPointProgress?: number }) {
  const w = 240
  const h = 120
  const pad = { top: 8, right: 8, bottom: 20, left: 26 }
  const cw = w - pad.left - pad.right
  const ch = h - pad.top - pad.bottom
  const minS = 40
  const maxS = 100
  const totalSlots = 6

  const showLast = lastPointProgress > 0.01
  const mayScore = STATIC_TREND[STATIC_TREND.length - 1].score
  const lastInterp = showLast ? Math.round(mayScore + (lastScore - mayScore) * easeOut(lastPointProgress)) : 0
  const chartData = showLast ? [...STATIC_TREND, { label: 'Jun', score: lastInterp }] : [...STATIC_TREND]
  const points = chartData.map((d, i) => ({
    x: pad.left + (i / (totalSlots - 1)) * cw,
    y: pad.top + ch - ((d.score - minS) / (maxS - minS)) * ch,
    label: d.label,
  }))
  const linePath = `M${points.map((p) => `${p.x},${p.y}`).join('L')}`
  const areaPath = `${linePath}L${points[points.length - 1].x},${pad.top + ch}L${points[0].x},${pad.top + ch}Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
      <defs>
        <linearGradient id="heroLineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--signal)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[40, 60, 80, 100].map((v) => {
        const y = pad.top + ch - ((v - minS) / (maxS - minS)) * ch
        return (
          <g key={v}>
            <line x1={pad.left} y1={y} x2={w - pad.right} y2={y} stroke="var(--rule)" strokeWidth={0.5} />
            <text x={pad.left - 5} y={y + 3} textAnchor="end" fontSize="6" fill="var(--m-muted)"
              style={{ fontFamily: GEIST }}>{v}</text>
          </g>
        )
      })}
      <path d={areaPath} fill="url(#heroLineGrad)" />
      <path d={linePath} fill="none" stroke="var(--signal)" strokeWidth={1.5} strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={2.5} fill="var(--paper)" stroke="var(--signal)" strokeWidth={1} />
          <text x={p.x} y={pad.top + ch + 12} textAnchor="middle" fontSize="6" fill="var(--m-muted)"
            style={{ fontFamily: GEIST }}>{p.label}</text>
        </g>
      ))}
    </svg>
  )
}

/* ── Card header ─────────────────────────────────────── */
function CardHeader({
  icon: Icon,
  title,
  subtitle,
  rightContent,
}: {
  icon: React.ElementType
  title: string
  subtitle?: string
  rightContent?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}
        >
          <Icon size={12} />
        </span>
        <div className="min-w-0">
          <p className="font-sans text-[11px] font-semibold text-ink leading-tight truncate">{title}</p>
          {subtitle && (
            <p className="font-sans text-[8px] leading-tight mt-0.5 tracking-[0.04em]" style={{ color: 'var(--m-muted)' }}>{subtitle}</p>
          )}
        </div>
      </div>
      {rightContent}
    </div>
  )
}

/* ── Priority fix row inside Issues card ──────────────── */
function PriorityFixRow({ progress }: { progress: number }) {
  if (progress < 0.01) return null
  const ease = easeOut(progress)
  return (
    <div className="mt-2 pt-2"
      style={{ borderTop: '1px solid var(--rule)', opacity: ease, transform: `translateY(${(1 - ease) * 6}px)` }}>
      <div className="flex items-center gap-2">
        <AlertTriangle size={10} className="shrink-0" style={{ color: 'var(--severe)' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="font-sans text-[7px] font-semibold uppercase tracking-[0.06em] px-1 py-px rounded"
              style={{ color: 'var(--severe)', background: 'color-mix(in srgb, var(--severe) 10%, transparent)' }}>
              Priority
            </span>
            <span className="font-sans text-[8px] text-m-muted">SEO · Critical</span>
          </div>
          <p className="font-sans text-[10px] font-semibold text-ink truncate">Missing H1 tag on homepage</p>
        </div>
      </div>
    </div>
  )
}

/* ── Animated dashboard visual ─────────────────────────── */
function AuditAnimation() {
  const [elapsed, setElapsed] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasStarted = useRef(false)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef(0)

  const tick = useCallback(() => {
    const now = performance.now()
    const ms = now - startRef.current
    setElapsed(ms)
    if (ms < 14000) {
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted.current) {
          hasStarted.current = true
          startRef.current = performance.now()
          rafRef.current = requestAnimationFrame(tick)
        }
      },
      { threshold: 0.2 },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [tick])

  const t = Math.max(0, elapsed)

  /* ── Phase 1: Scan (0–3s) ─────────────────────── */
  const scanPct = Math.min(100, Math.round((t / 3000) * 100))
  const completedStages = Math.min(SCAN_STAGES.length, Math.floor(t / 333))
  const scanOpacity = 1 - clamp01((t - 2500) / 500)

  /* ── Phase 2: All cards visible (3s) ──────────── */
  const dashOpacity = clamp01((t - 2500) / 1000)

  /* ── Row 1 data ────────────────────────────────── */

  // Issues (3.5–6s)
  const issuesProgress = clamp01((t - 3500) / 2500)
  const boxProgress = [0, 1, 2, 3].map((i) =>
    easeOut(clamp01((issuesProgress - i * 0.2) / 0.3))
  )
  const animatedCounts = [
    Math.round(ISSUES.critical * boxProgress[0]),
    Math.round(ISSUES.high * boxProgress[1]),
    Math.round(ISSUES.medium * boxProgress[2]),
    Math.round(ISSUES.low * boxProgress[3]),
  ]
  const animatedTotal = animatedCounts.reduce((s, c) => s + c, 0)

  // Health score (4–6.5s)
  const scoreProgress = easeOut(clamp01((t - 4000) / 2500))
  const healthScore = Math.round(AUDIT_SCORE * scoreProgress)
  const moduleOpacity = clamp01((t - 5500) / 1000)
  const scoreColor = healthScore >= 80 ? 'var(--ok)' : healthScore >= 60 ? 'var(--warn)' : 'var(--severe)'
  const scoreLabel = healthScore >= 80 ? 'Healthy' : healthScore >= 60 ? 'Needs work' : healthScore > 0 ? 'At risk' : ''

  // Score over time (4.5–7s)
  const trendProgress = clamp01((t - 4500) / 2500)

  /* ── Row 2 data ────────────────────────────────── */

  // Heuristic breakdown (5–7.5s)
  const radarProgress = clamp01((t - 5000) / 2500)

  // Website speed (5.5–8s)
  const speedProgress = easeOut(clamp01((t - 5500) / 2500))
  const speedScore = Math.round(SPEED_SCORE * speedProgress)

  // Brand intelligence (6–8.5s)
  const brandProgress = easeOut(clamp01((t - 6000) / 2500))
  const brandScore = Math.round(BRAND_SCORE * brandProgress)

  /* ── Priority fix (9–10s) ─────────────────────── */
  const priorityProgress = clamp01((t - 9000) / 700)

  /* Severity display data */
  const severityItems = [
    { key: 'critical', label: 'Critical',  count: animatedCounts[0], helper: 'Needs immediate attention', colorVar: '--severe',  progress: boxProgress[0] },
    { key: 'high',     label: 'High',      count: animatedCounts[1], helper: 'High impact issues to fix',  colorVar: '--warn',    progress: boxProgress[1] },
    { key: 'medium',   label: 'Medium',    count: animatedCounts[2], helper: 'Should improve soon',        colorVar: '--signal',  progress: boxProgress[2] },
    { key: 'low',      label: 'Low',       count: animatedCounts[3], helper: 'Minor improvements',         colorVar: '--ok',      progress: boxProgress[3] },
  ]

  return (
    <div ref={containerRef} className="mt-16 -mx-8 max-sm:-mx-5">
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'var(--paper-2)',
          border: '1px solid var(--rule)',
          boxShadow: '0 12px 48px color-mix(in srgb, var(--ink) 10%, transparent), 0 2px 12px color-mix(in srgb, var(--ink) 5%, transparent)',
        }}
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
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="var(--m-muted)" strokeWidth={2}>
                <rect x={3} y={11} width={18} height={11} rx={2} />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span className="font-sans text-[10px] tracking-[0.04em] text-m-muted">fixpath.ai/dashboard</span>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 lg:p-8 relative" style={{ minHeight: 480 }}>

          {/* ── Scanning overlay ───────────────────────── */}
          {scanOpacity > 0.01 && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center p-8"
              style={{ opacity: scanOpacity, background: 'var(--paper-2)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                style={{ background: 'color-mix(in srgb, var(--signal) 10%, transparent)' }}>
                <Search size={18} style={{ color: 'var(--signal)', animation: 'heroPulse 1.2s ease-in-out infinite' }} />
              </div>
              <p className="font-sans text-[16px] font-semibold text-ink mb-1">Auditing yoursite.com</p>
              <p className="font-sans text-[12px] text-m-muted mb-6">
                {completedStages < SCAN_STAGES.length ? SCAN_STAGES[completedStages] + '...' : 'Finalizing...'}
              </p>
              <div className="w-72 h-1.5 rounded-full overflow-hidden mb-8" style={{ background: 'var(--rule)' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${scanPct}%`, background: 'var(--signal)', transition: 'width 0.3s ease-out' }} />
              </div>
              <div className="flex flex-wrap gap-2 justify-center max-w-[480px]">
                {SCAN_STAGES.map((stage, i) => {
                  const done = i < completedStages
                  const active = i === completedStages
                  return (
                    <span key={stage}
                      className="flex items-center gap-1.5 font-sans text-[10px] px-2.5 py-1 rounded-lg"
                      style={{
                        background: done ? 'color-mix(in srgb, var(--ok) 8%, transparent)' : 'var(--paper)',
                        border: `1px solid ${done ? 'color-mix(in srgb, var(--ok) 20%, transparent)' : 'var(--rule)'}`,
                        color: done ? 'var(--ok)' : active ? 'var(--ink)' : 'var(--m-muted)',
                        fontWeight: active ? 600 : 400,
                      }}>
                      {done && (
                        <svg width={10} height={10} viewBox="0 0 12 12" fill="none">
                          <path d="M3 6l2 2 4-4" stroke="var(--ok)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {active && (
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--signal)', animation: 'heroPulse 1s ease-in-out infinite' }} />
                      )}
                      {stage}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Dashboard — 6 cards, 2 rows of 3 ───────── */}
          <div style={{ opacity: dashOpacity }}>

            {/* ── Row 1: Issues · Health Score · Score Over Time ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">

              {/* ════ Issues by importance ════ */}
              <div className="rounded-xl p-4 flex flex-col"
                style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
                <CardHeader icon={AlertTriangle} title="Issues by importance"
                  subtitle={animatedTotal > 0 ? `${animatedTotal} open issue${animatedTotal === 1 ? '' : 's'}` : undefined} />
                <div className="grid grid-cols-2 gap-2 flex-1">
                  {severityItems.map((s) => (
                    <div key={s.key} className="rounded-xl px-2.5 py-2 flex flex-col gap-0.5"
                      style={{
                        background: `color-mix(in srgb, var(${s.colorVar}) 7%, transparent)`,
                        border: `1px solid color-mix(in srgb, var(${s.colorVar}) 20%, transparent)`,
                        opacity: 0.3 + s.progress * 0.7,
                      }}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: `var(${s.colorVar})` }} />
                        <span className="font-sans text-[9px] font-semibold tracking-tight truncate"
                          style={{ color: `var(${s.colorVar})` }}>
                          {s.label}
                        </span>
                      </div>
                      <p className="font-sans text-[22px] leading-none font-bold tabular-nums"
                        style={{ color: `var(${s.colorVar})` }}>
                        {s.count}
                      </p>
                      <p className="font-sans text-[7px] leading-snug text-m-muted truncate">{s.helper}</p>
                    </div>
                  ))}
                </div>
                <PriorityFixRow progress={priorityProgress} />
              </div>

              {/* ════ Website health score ════ */}
              <div className="rounded-xl p-4 flex flex-col"
                style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
                <CardHeader icon={Heart} title="Website health score" subtitle="Latest audit" />
                <div className="flex flex-col items-center py-2 flex-1 justify-center">
                  <ScoreRing score={healthScore} size={90} />
                  <p className="font-sans text-[8px] mt-1.5 text-m-muted">/100</p>
                  {scoreLabel && (
                    <span className="font-sans text-[9px] font-medium mt-1 px-2.5 py-0.5 rounded-full"
                      style={{ color: scoreColor, background: `color-mix(in srgb, ${scoreColor} 10%, transparent)` }}>
                      {scoreLabel}
                    </span>
                  )}
                </div>
                {/* Module dots */}
                <div className="pt-2 mt-auto" style={{ borderTop: '1px solid var(--rule)' }}>
                  <ul className="flex flex-wrap gap-x-2 gap-y-1">
                    {MODULES.map((m) => {
                      const sc = Math.round(m.score * moduleOpacity)
                      const c = sc >= 80 ? 'var(--ok)' : sc >= 60 ? 'var(--warn)' : 'var(--severe)'
                      return (
                        <li key={m.name} className="flex items-center gap-1 font-sans text-[8px]"
                          style={{ color: 'var(--ink)', opacity: moduleOpacity }}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: m.color }} />
                          <span className="truncate">{m.name}</span>
                          <span className="tabular-nums font-semibold" style={{ color: c }}>{sc}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>

              {/* ════ Score over time ════ */}
              <div className="rounded-xl p-4 flex flex-col"
                style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
                <CardHeader icon={TrendingUp} title="Score over time"
                  rightContent={
                    <span className="flex items-center gap-1 font-sans text-[9px] font-semibold" style={{ color: 'var(--ok)', opacity: trendProgress }}>
                      <ArrowUp size={9} /> +16 pts
                    </span>
                  } />
                <div className="flex-1 flex items-center min-h-[120px]">
                  <MiniLineChart lastScore={AUDIT_SCORE} lastPointProgress={trendProgress} />
                </div>
              </div>
            </div>

            {/* ── Row 2: Heuristic Breakdown · Website Speed · Brand Intelligence ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

              {/* ════ Heuristic breakdown ════ */}
              <div className="rounded-xl p-4 flex flex-col"
                style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
                <CardHeader icon={Target} title="Heuristic breakdown" subtitle="7 categories" />
                <div className="flex-1 flex items-center justify-center min-h-[140px]">
                  <MiniRadar modules={MODULES} progress={radarProgress} />
                </div>
              </div>

              {/* ════ Website speed ════ */}
              <div className="rounded-xl p-4 flex flex-col"
                style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
                <CardHeader icon={Gauge} title="Website speed"
                  rightContent={
                    <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--rule)' }}>
                      <span className="px-2 py-0.5 font-sans text-[8px] font-medium capitalize"
                        style={{ background: 'var(--ink)', color: 'var(--paper)' }}>mobile</span>
                      <span className="px-2 py-0.5 font-sans text-[8px] font-medium capitalize text-m-muted">desktop</span>
                    </div>
                  } />
                <div className="flex gap-4 flex-1 items-center">
                  <div className="flex-shrink-0">
                    <ScoreRing score={speedScore} size={72} />
                  </div>
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    {SPEED_METRICS.map(({ key, label, Icon, value, status }) => {
                      const color = speedStatusColor(status)
                      return (
                        <div key={key} className="flex items-center gap-1.5" style={{ opacity: speedProgress }}>
                          <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                            style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
                            <Icon size={9} style={{ color }} />
                          </span>
                          <span className="font-sans text-[9px] flex-1 min-w-0 truncate text-m-muted">{label}</span>
                          <span className="font-sans text-[9px] tabular-nums font-semibold flex-shrink-0" style={{ color }}>{value}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-auto pt-2"
                  style={{ borderTop: '1px solid var(--rule)', opacity: speedProgress }}>
                  <span className="font-sans text-[9px] font-semibold flex items-center gap-1" style={{ color: 'var(--warn)' }}>
                    3 speed issues found <ChevronRight size={9} />
                  </span>
                  <span className="font-sans text-[8px] text-m-muted">Today</span>
                </div>
              </div>

              {/* ════ Brand Intelligence ════ */}
              <div className="rounded-xl p-4 flex flex-col"
                style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
                <CardHeader icon={Radio} title="Brand Intelligence"
                  rightContent={
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="p-0.5 rounded-md" style={{ color: 'var(--m-muted)' }}><RefreshCw size={10} /></span>
                      <ChevronRight size={11} style={{ color: 'var(--m-muted)' }} />
                    </div>
                  } />
                <div className="flex gap-4 flex-1 items-center">
                  <div className="flex-shrink-0">
                    <ScoreRing score={brandScore} size={72} />
                  </div>
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    {BRAND_METRICS.map(({ label, Icon, value, numVal }) => {
                      const color = label === 'Models tested' ? 'var(--ink)' : brandValueColor(numVal)
                      return (
                        <div key={label} className="flex items-center gap-1.5" style={{ opacity: brandProgress }}>
                          <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                            style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
                            <Icon size={9} style={{ color }} />
                          </span>
                          <span className="font-sans text-[9px] flex-1 min-w-0 truncate text-m-muted">{label}</span>
                          <span className="font-sans text-[9px] tabular-nums font-semibold flex-shrink-0" style={{ color }}>{value}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-auto pt-2"
                  style={{ borderTop: '1px solid var(--rule)', opacity: brandProgress }}>
                  <span className="font-sans text-[9px] font-semibold flex items-center gap-1" style={{ color: 'var(--ink)' }}>
                    View full intelligence <ChevronRight size={9} />
                  </span>
                  <span className="font-sans text-[8px] text-m-muted">4 pages scored</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes heroPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

/* ── Hero section ──────────────────────────────────────── */
export function HomeHero() {
  return (
    <section className="min-h-screen flex flex-col pt-[100px] pb-0 max-sm:pt-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5 w-full flex-1 flex flex-col">
        <div className="text-center max-w-[960px] mx-auto">
          <SectionMarker number="00" label="AI decision engine for websites and brands" centered />
          <h1
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-8"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
          >
            Find what hurts trust.{' '}
            <em className="italic text-signal">Fix what matters.</em>
          </h1>
          <p className="text-[19px] leading-[1.55] text-ink-2 max-w-[640px] mx-auto font-sans mb-10">
            Fixpath finds the issues affecting trust, clarity, and conversion
            — then helps your team fix them and track progress over time.
          </p>
          <div className="flex gap-3.5 justify-center max-sm:flex-col max-sm:items-stretch">
            <Button href="/register" size="large">
              Start free audit
              <ArrowRightIcon size={14} />
            </Button>
            <Button href="/product" variant="ghost" size="large">
              See the product
            </Button>
          </div>
        </div>
        <AuditAnimation />
      </div>
    </section>
  )
}
