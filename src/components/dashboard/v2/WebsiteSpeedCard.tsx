'use client'

import React, { useState } from 'react'
import { Gauge, ArrowRight, Loader2, Play } from 'lucide-react'
import type { SpeedDataSummary, SpeedStrategyResult, SpeedMetric } from '@/types/database'

/* ── Props ─────────────────────────────────��────────── */

interface WebsiteSpeedCardProps {
  /** Speed data stored on the audit record (null if never tested) */
  speedData: SpeedDataSummary | null
  /** Audit ID for on-demand speed test trigger */
  auditId: string | null
  /** Callback when user clicks "View speed issues" */
  onViewIssues?: () => void
  /** Callback after a speed test completes (to refresh parent data) */
  onTestComplete?: (data: SpeedDataSummary) => void
}

/* ── Helpers ────────────────────────────────────────── */

function scoreColor(score: number): string {
  if (score >= 90) return 'var(--ok)'
  if (score >= 50) return 'var(--warn)'
  return 'var(--severe)'
}

function statusDot(status: SpeedMetric['status']): string {
  if (status === 'good') return 'var(--ok)'
  if (status === 'needs_improvement') return 'var(--warn)'
  return 'var(--severe)'
}

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

  // Use local state if available (after on-demand test), otherwise prop
  const activeSpeedData = localSpeedData ?? speedData

  // Determine if we actually have usable speed data
  // (speedData may be truthy but both strategies null if API failed)
  const hasUsableData = activeSpeedData != null && (activeSpeedData.mobile != null || activeSpeedData.desktop != null)

  const result: SpeedStrategyResult | null = hasUsableData
    ? (strategy === 'mobile' ? activeSpeedData!.mobile : activeSpeedData!.desktop)
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

  // Issue count for summary line
  const issueCount = result?.issueCount ?? 0

  return (
    <div
      className="rounded-xl p-4 sm:p-5 flex flex-col h-full"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex items-start gap-2">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}
          >
            <Gauge size={14} />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.005em]" style={{ color: 'var(--ink)' }}>
              Website speed
            </h3>
            {(activeSpeedData?.testedAt || (result as any)?.testedAt) && (
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
                Last tested {new Date(activeSpeedData?.testedAt || (result as any)?.testedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* No data state */}
      {!hasUsableData ? (
        <div className="flex-1 flex flex-col items-center justify-center py-4 gap-3">
          <span
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, var(--ink) 5%, transparent)', color: 'var(--m-muted)' }}
          >
            <Gauge size={18} />
          </span>
          <p className="text-[11px] text-center" style={{ color: 'var(--m-muted)' }}>
            No speed data yet
          </p>
          {error && (
            <p className="text-[11px] text-center px-2" style={{ color: 'var(--severe)' }}>
              {error}
            </p>
          )}
          {auditId && (
            <button
              onClick={handleRunTest}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:shadow-sm"
              style={{
                background: 'var(--ink)',
                color: 'var(--card)',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              {loading ? 'Testing...' : 'Run speed test'}
            </button>
          )}
        </div>
      ) : activeSpeedData && (
        <>
          {/* Score + strategy toggle */}
          <div className="flex items-center gap-3 mb-3">
            {result && (
              <div className="flex items-baseline gap-1.5">
                <span
                  className="text-[32px] font-bold leading-none tabular-nums"
                  style={{ color: scoreColor(result.score) }}
                >
                  {result.score}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>/100</span>
              </div>
            )}
            <div className="flex ml-auto rounded-lg overflow-hidden" style={{ border: '1px solid var(--rule)' }}>
              {(['mobile', 'desktop'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStrategy(s)}
                  className="px-2.5 py-1 text-[10px] font-medium capitalize transition-colors"
                  style={{
                    background: strategy === s ? 'var(--ink)' : 'transparent',
                    color: strategy === s ? 'var(--card)' : 'var(--m-muted)',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Core metrics */}
          {result && (
            <div className="flex flex-col gap-1.5 mb-3">
              {([
                { key: 'lcp', label: 'LCP' },
                { key: 'cls', label: 'CLS' },
                { key: 'inp', label: 'INP' },
              ] as const).map(({ key, label }) => {
                const metric = result.metrics[key]
                return (
                  <div key={key} className="flex items-center justify-between px-2 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: statusDot(metric.status) }}
                      />
                      <span className="text-[11px] font-medium" style={{ color: 'var(--ink)' }}>
                        {label}
                      </span>
                    </div>
                    <span className="text-[11px] tabular-nums font-medium" style={{ color: statusDot(metric.status) }}>
                      {metric.displayValue}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Issue summary */}
          {issueCount > 0 && (
            <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--warn)' }}>
              {issueCount} issue{issueCount !== 1 ? 's' : ''} affecting load speed
            </p>
          )}

          {/* Footer CTA */}
          {onViewIssues && (
            <button
              onClick={onViewIssues}
              className="mt-auto flex items-center gap-1 text-[11px] font-medium transition-colors hover:opacity-80"
              style={{ color: 'var(--ink)' }}
            >
              View speed issues
              <ArrowRight size={12} />
            </button>
          )}
        </>
      )}
    </div>
  )
}
