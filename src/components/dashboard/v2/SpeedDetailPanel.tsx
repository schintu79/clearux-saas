'use client'

import React, { useState } from 'react'
import { Gauge, Loader2, Play, ArrowRight, Zap, AlertTriangle, Info } from 'lucide-react'
import type { SpeedDataSummary, SpeedStrategyResult, SpeedMetric } from '@/types/database'

/* ── Props ─────────────────────────────────────────── */

interface SpeedDetailPanelProps {
  speedData: SpeedDataSummary | null
  auditId: string
  productUrl?: string
  findings?: Array<{ title: string; severity: string; description: string; recommendation?: string; detection_source?: string; performance_metric_type?: string; owner_team?: string }>
}

/* ── Helpers ────────────────────────────────────────── */

function scoreColor(score: number): string {
  if (score >= 90) return 'var(--ok)'
  if (score >= 50) return 'var(--warn)'
  return 'var(--severe)'
}

function scoreBg(score: number): string {
  if (score >= 90) return 'color-mix(in srgb, var(--ok) 8%, transparent)'
  if (score >= 50) return 'color-mix(in srgb, var(--warn) 8%, transparent)'
  return 'color-mix(in srgb, var(--severe) 8%, transparent)'
}

function statusDotColor(status: SpeedMetric['status']): string {
  if (status === 'good') return 'var(--ok)'
  if (status === 'needs_improvement') return 'var(--warn)'
  return 'var(--severe)'
}

function statusLabel(status: SpeedMetric['status']): string {
  if (status === 'good') return 'Good'
  if (status === 'needs_improvement') return 'Needs improvement'
  return 'Poor'
}

const METRIC_INFO: Record<string, { label: string; description: string; goodThreshold: string; poorThreshold: string }> = {
  lcp: { label: 'Largest Contentful Paint', description: 'How long the main content takes to appear', goodThreshold: '< 2.5s', poorThreshold: '> 4.0s' },
  cls: { label: 'Cumulative Layout Shift', description: 'Visual stability — unexpected layout shifts', goodThreshold: '< 0.1', poorThreshold: '> 0.25' },
  inp: { label: 'Interaction to Next Paint', description: 'Responsiveness to user interactions', goodThreshold: '< 200ms', poorThreshold: '> 500ms' },
  ttfb: { label: 'Time to First Byte', description: 'Server response time', goodThreshold: '< 800ms', poorThreshold: '> 1800ms' },
  speedIndex: { label: 'Speed Index', description: 'How quickly visible content is rendered', goodThreshold: '< 3.4s', poorThreshold: '> 5.8s' },
  tbt: { label: 'Total Blocking Time', description: 'Time the main thread is blocked', goodThreshold: '< 200ms', poorThreshold: '> 600ms' },
}

/* ── Component ──────────────────────────────────────── */

export default function SpeedDetailPanel({
  speedData,
  auditId,
  productUrl,
  findings = [],
}: SpeedDetailPanelProps) {
  const [loading, setLoading] = useState(false)
  const [localData, setLocalData] = useState<SpeedDataSummary | null>(speedData)

  const handleRunTest = async () => {
    if (!auditId || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/speed-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId }),
      })
      if (res.ok) {
        const data = await res.json()
        setLocalData(data.speed_data)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  const data = localData

  // Filter speed-related findings
  const speedFindings = findings.filter(
    (f: any) => f.detection_source === 'pagespeed_api'
  )
  const fixableFindings = speedFindings.filter((f: any) => f.finding_type === 'specific')
  const advisoryFindings = speedFindings.filter((f: any) => f.finding_type !== 'specific')

  if (!data) {
    return (
      <div className="rounded-xl border border-rule bg-card p-6 mb-5">
        <div className="flex items-start gap-3 mb-4">
          <Gauge size={16} className="text-m-muted flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-[14px] font-heading font-semibold text-ink mb-0.5">Website speed (PageSpeed Insights)</h3>
            <p className="text-[12px] text-m-muted leading-relaxed">
              No speed data available yet. Run a PageSpeed test to see real Core Web Vitals.
            </p>
          </div>
        </div>
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
      </div>
    )
  }

  const mobile = data.mobile
  const desktop = data.desktop

  return (
    <div className="rounded-xl border border-rule bg-card overflow-hidden mb-5">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-rule/40 flex items-center gap-2">
        <Gauge size={15} className="text-m-muted" />
        <h3 className="text-[13px] font-semibold text-ink">Website speed (PageSpeed Insights)</h3>
        {data.testedAt && (
          <span className="ml-auto text-[10px] text-m-muted">
            Tested {new Date(data.testedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Score comparison */}
      <div className="px-5 py-4 grid grid-cols-2 gap-4">
        {[{ label: 'Mobile', result: mobile }, { label: 'Desktop', result: desktop }].map(({ label, result }) => (
          <div key={label} className="rounded-lg p-4" style={{ background: result ? scoreBg(result.score) : 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
            <p className="text-[10px] font-semibold tracking-[0.04em] uppercase text-m-muted mb-2">{label}</p>
            {result ? (
              <div className="flex items-baseline gap-1.5">
                <span className="text-[36px] font-bold leading-none tabular-nums" style={{ color: scoreColor(result.score) }}>
                  {result.score}
                </span>
                <span className="text-[12px] text-m-muted">/100</span>
              </div>
            ) : (
              <span className="text-[14px] text-m-muted">Not tested</span>
            )}
          </div>
        ))}
      </div>

      {/* Core Web Vitals breakdown */}
      {(mobile || desktop) && (
        <div className="px-5 pb-4">
          <h4 className="text-[11px] font-semibold tracking-[0.04em] uppercase text-m-muted mb-2">Core Web Vitals</h4>
          <div className="rounded-lg border border-rule/60 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_100px] px-3 py-2 border-b border-rule/40" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
              <span className="text-[10px] font-semibold text-m-muted uppercase tracking-wide">Metric</span>
              <span className="text-[10px] font-semibold text-m-muted uppercase tracking-wide text-center">Mobile</span>
              <span className="text-[10px] font-semibold text-m-muted uppercase tracking-wide text-center">Desktop</span>
            </div>
            {/* Rows */}
            {(['lcp', 'cls', 'inp', 'ttfb', 'speedIndex', 'tbt'] as const).map((key) => {
              const info = METRIC_INFO[key]
              const mobileMetric = mobile?.metrics[key]
              const desktopMetric = desktop?.metrics[key]
              return (
                <div key={key} className="grid grid-cols-[1fr_100px_100px] px-3 py-2.5 border-b border-rule/20 last:border-b-0 items-center">
                  <div>
                    <p className="text-[12px] font-medium text-ink">{info.label}</p>
                    <p className="text-[10px] text-m-muted">{info.description}</p>
                  </div>
                  <div className="text-center">
                    {mobileMetric ? (
                      <span className="text-[12px] font-semibold tabular-nums" style={{ color: statusDotColor(mobileMetric.status) }}>
                        {mobileMetric.displayValue}
                      </span>
                    ) : (
                      <span className="text-[11px] text-m-muted">—</span>
                    )}
                  </div>
                  <div className="text-center">
                    {desktopMetric ? (
                      <span className="text-[12px] font-semibold tabular-nums" style={{ color: statusDotColor(desktopMetric.status) }}>
                        {desktopMetric.displayValue}
                      </span>
                    ) : (
                      <span className="text-[11px] text-m-muted">—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {/* Threshold legend */}
          <div className="flex items-center gap-4 mt-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--ok)' }} />
              <span className="text-[10px] text-m-muted">Good</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--warn)' }} />
              <span className="text-[10px] text-m-muted">Needs improvement</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--severe)' }} />
              <span className="text-[10px] text-m-muted">Poor</span>
            </div>
          </div>
        </div>
      )}

      {/* Speed findings */}
      {speedFindings.length > 0 && (
        <div className="px-5 pb-5 border-t border-rule/40 pt-4">
          {/* Fixable issues */}
          {fixableFindings.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={13} className="text-ink" />
                <h4 className="text-[12px] font-semibold text-ink">Fixable issues ({fixableFindings.length})</h4>
              </div>
              <div className="space-y-1.5">
                {fixableFindings.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                      style={{ background: f.severity === 'critical' ? 'var(--severe)' : f.severity === 'major' ? 'var(--warn)' : 'var(--m-muted)' }}
                    />
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-ink">{f.title}</p>
                      {f.recommendation && (
                        <p className="text-[10px] text-m-muted mt-0.5 line-clamp-2">{f.recommendation}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Advisory issues */}
          {advisoryFindings.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Info size={13} className="text-m-muted" />
                <h4 className="text-[12px] font-semibold text-m-muted">Advisory ({advisoryFindings.length})</h4>
              </div>
              <div className="space-y-1.5">
                {advisoryFindings.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                      style={{ background: f.severity === 'critical' ? 'var(--severe)' : f.severity === 'major' ? 'var(--warn)' : 'var(--m-muted)' }}
                    />
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-ink">{f.title}</p>
                      {f.recommendation && (
                        <p className="text-[10px] text-m-muted mt-0.5 line-clamp-2">{f.recommendation}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Re-run button */}
      <div className="px-5 py-3 border-t border-rule/40 flex items-center justify-between">
        <button
          onClick={handleRunTest}
          disabled={loading}
          className="flex items-center gap-1.5 text-[11px] font-medium transition-colors hover:opacity-80"
          style={{ color: 'var(--ink)', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {loading ? 'Testing...' : 'Re-run speed test'}
        </button>
        {productUrl && (
          <a
            href={`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(productUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-medium text-m-muted hover:text-ink transition-colors"
          >
            View on PageSpeed Insights
            <ArrowRight size={11} />
          </a>
        )}
      </div>
    </div>
  )
}
