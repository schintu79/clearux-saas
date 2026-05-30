'use client'

import React, { useState } from 'react'
import { Gauge, ArrowRight, Loader2, Play, Zap, Move, MousePointerClick } from 'lucide-react'
import ScoreCircle from '@/components/ui/ScoreCircle'
import type { SpeedDataSummary, SpeedStrategyResult, SpeedMetric } from '@/types/database'

/* ── Props ────────────────────────────────────────── */

interface WebsiteSpeedCardProps {
  speedData: SpeedDataSummary | null
  auditId: string | null
  onViewIssues?: () => void
  onTestComplete?: (data: SpeedDataSummary) => void
}

/* ── Helpers ────────────────────────────────────────── */

function statusColor(status: SpeedMetric['status']): string {
  if (status === 'good') return 'var(--ok)'
  if (status === 'needs_improvement') return 'var(--warn)'
  return 'var(--severe)'
}

const METRIC_CONFIG = [
  { key: 'lcp' as const, label: 'Loading time', Icon: Zap },
  { key: 'cls' as const, label: 'Visual stability', Icon: Move },
  { key: 'inp' as const, label: 'Responsiveness', Icon: MousePointerClick },
]

/* ── Component ──────────────────────────────────────── */

export default function WebsiteSpeedCard({
  speedData,
  auditId,
  onViewIssues,
  onTestComplete,
}: WebsiteSpeedCardProps) {
  const [strategy, setStrategy] = useState<'mobile' | 'desktop'>('mobile')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localSpeedData, setLocalSpeedData] = useState<SpeedDataSummary | null>(null)

  const activeSpeedData = localSpeedData ?? speedData
  const hasUsableData = activeSpeedData != null && (activeSpeedData.mobile != null || activeSpeedData.desktop != null)

  // Auto-resolve strategy: if selected strategy has no data, switch to one that does.
  // This prevents showing an empty card when only desktop (or only mobile) data exists.
  const resolvedStrategy: 'mobile' | 'desktop' = hasUsableData
    ? (strategy === 'mobile' && !activeSpeedData!.mobile && activeSpeedData!.desktop
        ? 'desktop'
        : strategy === 'desktop' && !activeSpeedData!.desktop && activeSpeedData!.mobile
          ? 'mobile'
          : strategy)
    : strategy

  const result: SpeedStrategyResult | null = hasUsableData
    ? (resolvedStrategy === 'mobile' ? activeSpeedData!.mobile : activeSpeedData!.desktop)
    : null

  const handleRunTest = async () => {
    if (!auditId || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/speed-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId }),
      })
      if (res.ok) {
        const data = await res.json()
        setLocalSpeedData(data.speed_data)
        onTestComplete?.(data.speed_data)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Speed test failed. Please try again.')
      }
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const issueCount = result?.issueCount ?? 0

  return (
    <div
      className="rounded-xl p-4 sm:p-5 flex flex-col h-full"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
    >
      {/* Header row: icon + title + strategy toggle */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}
          >
            <Gauge size={14} />
          </span>
          <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.005em]" style={{ color: 'var(--ink)' }}>
            Website speed
          </h3>
        </div>
        {hasUsableData && (
          <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--rule)' }}>
            {(['mobile', 'desktop'] as const).map((s) => {
              const hasData = activeSpeedData != null && activeSpeedData[s] != null
              return (
                <button
                  key={s}
                  onClick={() => hasData && setStrategy(s)}
                  className="px-2.5 py-1 text-[10px] font-medium capitalize transition-colors"
                  style={{
                    background: resolvedStrategy === s ? 'var(--ink)' : 'transparent',
                    color: resolvedStrategy === s ? 'var(--card)' : hasData ? 'var(--m-muted)' : 'color-mix(in srgb, var(--m-muted) 40%, transparent)',
                    cursor: hasData ? 'pointer' : 'default',
                  }}
                >
                  {s}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* No data state */}
      {!hasUsableData ? (
        <div className="flex-1 flex flex-col items-center justify-center py-4 gap-3">
          <Gauge size={20} style={{ color: 'var(--m-muted)', opacity: 0.5 }} />
          <p className="text-[11px] text-center" style={{ color: 'var(--m-muted)' }}>
            No speed data yet
          </p>
          {error && (
            <p className="text-[11px] text-center px-2" style={{ color: 'var(--severe)' }}>{error}</p>
          )}
          {auditId && (
            <button
              onClick={handleRunTest}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:shadow-sm"
              style={{ background: 'var(--ink)', color: 'var(--card)', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              {loading ? 'Testing...' : 'Run speed test'}
            </button>
          )}
        </div>
      ) : result && (
        <>
          {/* Score circle left + metrics right */}
          <div className="flex gap-5 flex-1 items-center">
            {/* Left: ScoreCircle — pushed left, thicker stroke */}
            <div className="flex-shrink-0">
              <ScoreCircle score={result.score} size="medium" />
            </div>

            {/* Right: Metric legend */}
            <div className="flex flex-col gap-2.5 flex-1 min-w-0">
              {METRIC_CONFIG.map(({ key, label, Icon }) => {
                const metric = result.metrics[key]
                const color = statusColor(metric.status)
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                      style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}
                    >
                      <Icon size={11} style={{ color }} />
                    </span>
                    <span className="text-[11px] flex-1 min-w-0 truncate" style={{ color: 'var(--m-muted)' }}>
                      {label}
                    </span>
                    <span
                      className="text-[11px] tabular-nums font-semibold flex-shrink-0"
                      style={{ color }}
                    >
                      {metric.displayValue}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Issue count + footer */}
          <div className="flex items-center justify-between mt-auto pt-3" style={{ borderTop: '1px solid var(--rule)' }}>
            {onViewIssues && issueCount > 0 ? (
              <button
                onClick={onViewIssues}
                className="flex items-center gap-1 text-[11px] font-semibold transition-colors hover:opacity-80"
                style={{ color: 'var(--warn)' }}
              >
                {issueCount} speed issue{issueCount !== 1 ? 's' : ''} found <ArrowRight size={11} />
              </button>
            ) : onViewIssues ? (
              <button
                onClick={onViewIssues}
                className="flex items-center gap-1 text-[11px] font-semibold transition-colors hover:opacity-80"
                style={{ color: 'var(--ink)' }}
              >
                View speed details <ArrowRight size={11} />
              </button>
            ) : <span />}
            {(activeSpeedData?.testedAt || (result as any)?.testedAt) && (
              <span className="text-[10px] ml-auto" style={{ color: 'var(--m-muted)' }}>
                {new Date(activeSpeedData?.testedAt || (result as any)?.testedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
