'use client'

import { useEffect, useState, useRef } from 'react'
import { Button } from './Button'
import { SectionMarker } from './SectionMarker'
import { ArrowRightIcon } from './icons'
import { Heart, TrendingUp, Target, Gauge, Brain, AlertTriangle } from 'lucide-react'

/* ── Rotating words for hero headline ──────────────────────── */
const ROTATING_WORDS = [
  'trust', 'clarity', 'SEO', 'UX', 'accessibility',
  'conversions', 'credibility', 'visibility', 'discoverability',
]

/* ── Module data for animated dashboard visual ─────────────── */
const MODULES = [
  { name: 'Foundation',    score: 78, color: '#3B82F6' },
  { name: 'Human Exp.',    score: 71, color: '#EC4899' },
  { name: 'Inclusive',      score: 86, color: '#8B5CF6' },
  { name: 'Future',         score: 69, color: '#F59E0B' },
  { name: 'SEO',            score: 91, color: '#10B981' },
  { name: 'Accessibility', score: 82, color: '#14B8A6' },
  { name: 'Brand',          score: 88, color: '#06B6D4' },
]

/* ── Score trend data for line chart ───────────────────────── */
const SCORE_TREND = [
  { label: 'Jan', score: 52 },
  { label: 'Feb', score: 58 },
  { label: 'Mar', score: 63 },
  { label: 'Apr', score: 71 },
  { label: 'May', score: 76 },
  { label: 'Jun', score: 83 },
]

/* ── Rotating word hook ────────────────────────────────────── */
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

/* ── Score ring (matches dashboard ScoreCircle pattern) ────── */
function ScoreRing({ score, size = 100 }: { score: number; size?: number }) {
  const stroke = Math.round(size * 0.065)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? 'var(--ok)' : score >= 60 ? 'var(--warn)' : 'var(--severe)'

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--rule)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-serif text-center tabular-nums leading-none"
          style={{ fontSize: size * 0.32, fontWeight: 700, color }}
        >
          {score}
        </span>
      </div>
    </div>
  )
}

/* ── Mini radar chart ──────────────────────────────────────── */
function MiniRadar({ modules, progress }: { modules: typeof MODULES; progress: number }) {
  const size = 220
  const cx = size / 2
  const cy = size / 2
  const r = 75
  const n = modules.length
  const angleStep = 360 / n

  function polar(angle: number, radius: number) {
    const rad = (angle - 90) * (Math.PI / 180)
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
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
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full max-h-[180px]">
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
      <path d={dataPath} fill="url(#heroRadarFill)" stroke="#6366F1" strokeWidth={1.5} />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill={p.color} />
      ))}
      {modules.map((m, i) => {
        const { x, y } = polar(i * angleStep, r + 18)
        return (
          <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="central"
            fontSize="8" fontWeight="600" fill="var(--m-muted)"
            style={{ fontFamily: 'ui-monospace, monospace' }}
          >
            {Math.round(m.score * progress)}
          </text>
        )
      })}
    </svg>
  )
}

/* ── Mini line chart ───────────────────────────────────────── */
function MiniLineChart({ data, progress }: { data: typeof SCORE_TREND; progress: number }) {
  const w = 280
  const h = 140
  const pad = { top: 10, right: 10, bottom: 24, left: 30 }
  const cw = w - pad.left - pad.right
  const ch = h - pad.top - pad.bottom
  const minS = 40
  const maxS = 100

  const points = data.map((d, i) => {
    const x = pad.left + (i / (data.length - 1)) * cw
    const s = minS + (d.score - minS) * progress
    const y = pad.top + ch - ((s - minS) / (maxS - minS)) * ch
    return { x, y, label: d.label }
  })

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
            <text x={pad.left - 6} y={y + 3} textAnchor="end" fontSize="7" fill="var(--m-muted)"
              style={{ fontFamily: 'ui-monospace, monospace' }}>{v}</text>
          </g>
        )
      })}
      <path d={areaPath} fill="url(#heroLineGrad)" />
      <path d={linePath} fill="none" stroke="var(--signal)" strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill="var(--paper)" stroke="var(--signal)" strokeWidth={1.5} />
          <text x={p.x} y={pad.top + ch + 14} textAnchor="middle" fontSize="7" fill="var(--m-muted)"
            style={{ fontFamily: 'ui-monospace, monospace' }}>{p.label}</text>
        </g>
      ))}
    </svg>
  )
}

/* ── Card header (mirrors DashboardCard header) ────────────── */
function CardHead({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: '1px solid var(--rule)' }}>
      <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: 'color-mix(in srgb, var(--signal) 10%, transparent)' }}>
        <Icon size={12} style={{ color: 'var(--signal)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-sans text-[11px] font-semibold text-ink leading-tight truncate">{title}</p>
        <p className="font-mono text-[8px] tracking-[0.06em] uppercase text-m-muted">{subtitle}</p>
      </div>
    </div>
  )
}

/* ── Animated dashboard visual ─────────────────────────────── */
function AuditAnimation() {
  const [progress, setProgress] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasStarted = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted.current) {
          hasStarted.current = true
          const start = performance.now()
          const duration = 1500
          function step(now: number) {
            const elapsed = now - start
            const t = Math.min(elapsed / duration, 1)
            setProgress(1 - Math.pow(1 - t, 3)) // ease-out cubic
            if (t < 1) requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
        }
      },
      { threshold: 0.2 },
    )
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const animatedScore = Math.round(83 * progress)
  const scoreColor = animatedScore >= 80 ? 'var(--ok)' : animatedScore >= 60 ? 'var(--warn)' : 'var(--severe)'

  return (
    <div ref={containerRef} className="mt-16 max-w-[960px] mx-auto">
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
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="var(--m-muted)" strokeWidth={2}>
                <rect x={3} y={11} width={18} height={11} rx={2} />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span className="font-mono text-[10px] tracking-[0.04em] text-m-muted">fixpath.ai/dashboard</span>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {/* ── Row 1: Score · Trend · Radar ─────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            {/* Website Health Score */}
            <div className="rounded-xl p-4" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
              <CardHead icon={Heart} title="Website Health Score" subtitle="Latest audit" />
              <div className="flex flex-col items-center py-2">
                <ScoreRing score={animatedScore} size={100} />
                <p className="font-mono text-[9px] mt-1.5" style={{ color: 'var(--m-muted)' }}>/100</p>
                <span
                  className="text-[9px] font-medium mt-1 px-2.5 py-0.5 rounded-full"
                  style={{
                    color: scoreColor,
                    background: `color-mix(in srgb, ${scoreColor} 10%, transparent)`,
                  }}
                >
                  {animatedScore >= 80 ? 'Healthy' : animatedScore >= 60 ? 'Needs work' : 'At risk'}
                </span>
              </div>
              {/* Module dots */}
              <div className="pt-2 mt-2" style={{ borderTop: '1px solid var(--rule)' }}>
                <ul className="flex flex-wrap gap-x-2 gap-y-1">
                  {MODULES.map((m) => {
                    const sc = Math.round(m.score * progress)
                    const c = sc >= 80 ? 'var(--ok)' : sc >= 60 ? 'var(--warn)' : 'var(--severe)'
                    return (
                      <li key={m.name} className="flex items-center gap-1 text-[9px]" style={{ color: 'var(--ink)', opacity: progress }}>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: m.color }} />
                        <span className="truncate">{m.name}</span>
                        <span className="tabular-nums font-semibold" style={{ color: c }}>{sc}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>

            {/* Score Over Time */}
            <div className="rounded-xl p-4" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
              <CardHead icon={TrendingUp} title="Score Over Time" subtitle="6 audits" />
              <div className="h-[160px] flex items-center">
                <MiniLineChart data={SCORE_TREND} progress={progress} />
              </div>
            </div>

            {/* Heuristic Breakdown */}
            <div className="rounded-xl p-4" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
              <CardHead icon={Target} title="Heuristic Breakdown" subtitle="7 modules" />
              <div className="h-[160px] flex items-center justify-center">
                <MiniRadar modules={MODULES} progress={progress} />
              </div>
            </div>
          </div>

          {/* ── Row 2: Issues · Speed · Brand Intelligence ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Issues by Importance */}
            <div className="rounded-xl p-4" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
              <CardHead icon={AlertTriangle} title="Issues by Importance" subtitle="14 open" />
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Critical', count: 2, color: 'var(--severe)' },
                  { label: 'High',     count: 3, color: '#F97316' },
                  { label: 'Medium',   count: 5, color: 'var(--warn)' },
                  { label: 'Low',      count: 4, color: 'var(--m-muted)' },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-lg p-2.5 text-center"
                    style={{
                      background: `color-mix(in srgb, ${s.color} 5%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${s.color} 12%, transparent)`,
                      opacity: progress,
                    }}
                  >
                    <p className="font-serif text-[22px] font-normal leading-none mb-0.5" style={{ color: s.color }}>
                      {Math.round(s.count * progress)}
                    </p>
                    <p className="font-mono text-[7px] tracking-[0.08em] uppercase" style={{ color: s.color }}>
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Website Speed */}
            <div className="rounded-xl p-4" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
              <CardHead icon={Gauge} title="Website Speed" subtitle="Performance" />
              <div className="flex flex-col items-center py-1" style={{ opacity: progress }}>
                <p className="font-serif text-[36px] font-normal leading-none mb-0.5" style={{ color: 'var(--ok)' }}>92</p>
                <p className="font-mono text-[8px] tracking-[0.06em] uppercase text-m-muted mb-3">/100</p>
                <div className="w-full space-y-2">
                  {[
                    { label: 'LCP',  value: '1.2s',  status: 'Good' },
                    { label: 'CLS',  value: '0.04',  status: 'Good' },
                    { label: 'FID',  value: '18ms',  status: 'Good' },
                  ].map((m) => (
                    <div key={m.label} className="flex items-center justify-between text-[10px]">
                      <span className="font-mono text-m-muted uppercase tracking-[0.06em]">{m.label}</span>
                      <span className="font-sans text-ink tabular-nums">{m.value}</span>
                      <span
                        className="font-mono text-[8px] px-1.5 py-0.5 rounded"
                        style={{ color: 'var(--ok)', background: 'color-mix(in srgb, var(--ok) 8%, transparent)' }}
                      >
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Brand Intelligence */}
            <div className="rounded-xl p-4" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
              <CardHead icon={Brain} title="Brand Intelligence" subtitle="AI X-Ray" />
              <div style={{ opacity: progress }}>
                <div className="flex items-center gap-3 mb-3">
                  <p className="font-serif text-[28px] font-normal leading-none" style={{ color: 'var(--ok)' }}>
                    87<span className="text-[14px]">%</span>
                  </p>
                  <p className="font-mono text-[8px] tracking-[0.06em] uppercase text-m-muted">AI accuracy</p>
                </div>
                <div className="space-y-1.5">
                  {[
                    { model: 'Claude',  score: 92 },
                    { model: 'ChatGPT', score: 85 },
                    { model: 'Gemini',  score: 84 },
                  ].map((p) => (
                    <div key={p.model} className="flex items-center gap-2">
                      <span className="font-sans text-[10px] text-ink w-14 truncate">{p.model}</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--rule)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${p.score * progress}%`,
                            background: p.score >= 80 ? 'var(--ok)' : 'var(--warn)',
                          }}
                        />
                      </div>
                      <span className="font-mono text-[9px] tabular-nums text-ink w-6 text-right">
                        {Math.round(p.score * progress)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
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
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-8"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
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

          <p className="text-[19px] leading-[1.55] text-ink-2 max-w-[640px] mx-auto font-sans mb-10">
            Fixpath finds what is hurting trust, clarity, accessibility, and technical
            quality — then lets you prioritize, fix, recommend, deploy, and track
            improvement from one dashboard. No noise. No inflated scores. Just useful truth.
          </p>

          <div className="flex gap-3.5 justify-center max-sm:flex-col max-sm:items-stretch">
            <Button href="/register" size="large">
              Start free audit
              <ArrowRightIcon size={14} />
            </Button>
            <Button href="/how-it-works" variant="ghost" size="large">
              See how it works
            </Button>
          </div>
        </div>

        {/* Animated dashboard visual */}
        <AuditAnimation />
      </div>
    </section>
  )
}
