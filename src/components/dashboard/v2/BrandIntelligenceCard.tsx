'use client'

import React, { useCallback, useState } from 'react'
import Link from 'next/link'
import { Radio, ChevronRight, RefreshCw } from 'lucide-react'
import ScoreCircle from '@/components/ui/ScoreCircle'
import type { BrandIntelligenceSummary } from '@/lib/audit-engine/brand-intelligence'

/* ── Props ─────────────────────────────────────────── */

interface BrandIntelligenceCardProps {
  data: BrandIntelligenceSummary | null
  legacyScore?: number | null
  legacyCompetitorCount?: number
  hasProbeData?: boolean
  auditId?: string | null
  avgAiReadability?: number | null
  aiPagesBuckets?: { green: number; amber: number; red: number }
  aiPagesScored?: number
  totalPages?: number
  probes?: Array<{ model_id: string; model_label: string; accuracy_score: number; status?: 'measured' | 'skipped' | 'error' | null; error_message?: string | null }>
  onXRayRefreshed?: () => void
}

/* ── Helpers ────────────────────────────────────────── */

function sentimentPill(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'Positive', color: 'var(--ok)' }
  if (score >= 40) return { label: 'Neutral', color: 'var(--warn)' }
  return { label: 'Negative', color: 'var(--severe)' }
}

/* ── Component ──────────────────────────────────────── */

export default function BrandIntelligenceCard({
  data,
  legacyScore,
  legacyCompetitorCount,
  hasProbeData,
  auditId,
  avgAiReadability,
  aiPagesBuckets,
  aiPagesScored = 0,
  totalPages = 0,
  probes = [],
  onXRayRefreshed,
}: BrandIntelligenceCardProps) {
  const [refreshing, setRefreshing] = useState(false)
  const [refreshOk, setRefreshOk] = useState(false)

  const biScore = data?.score ?? legacyScore ?? null
  const xrayAvg = probes.length > 0
    ? Math.round(probes.filter(p => p.status === 'measured').reduce((s, p) => s + p.accuracy_score, 0) / Math.max(probes.filter(p => p.status === 'measured').length, 1))
    : null

  const primaryScore = biScore ?? (avgAiReadability != null && xrayAvg != null
    ? Math.round((avgAiReadability + xrayAvg) / 2)
    : avgAiReadability ?? xrayAvg ?? null)

  const hasData = primaryScore != null

  const handleRefresh = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!auditId || refreshing) return
    setRefreshing(true)
    try {
      const res = await fetch(`/api/audits/${auditId}/rescan-xray`, { method: 'POST' })
      if (res.ok) {
        setRefreshOk(true)
        onXRayRefreshed?.()
        setTimeout(() => setRefreshOk(false), 2500)
      }
    } catch { /* ignore */ }
    setRefreshing(false)
  }, [auditId, refreshing, onXRayRefreshed])

  return (
    <Link
      href="/dashboard/intelligence"
      className="rounded-xl p-4 sm:p-5 flex flex-col h-full transition-all hover:shadow-md hover:-translate-y-0.5 group"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      aria-label="Open Brand Intelligence"
    >
      {/* Header row: icon + title + actions */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}
          >
            <Radio size={14} />
          </span>
          <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.005em]" style={{ color: 'var(--ink)' }}>
            Brand Intelligence
          </h3>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {probes.length > 0 && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={!auditId || refreshing}
              className="p-1 rounded-md transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] disabled:opacity-50"
              style={{ color: 'var(--m-muted)' }}
              aria-label={refreshing ? 'Re-scanning AI models' : 'Re-scan AI models'}
              title={refreshing ? 'Re-scanning...' : 'Re-scan AI model probes'}
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            </button>
          )}
          <ChevronRight
            size={14}
            className="transition-transform group-hover:translate-x-0.5"
            style={{ color: 'var(--m-muted)' }}
          />
        </div>
      </div>

      {/* Body */}
      {!hasData ? (
        <div className="flex-1 flex flex-col items-center justify-center py-4 gap-2">
          <Radio size={20} style={{ color: 'var(--m-muted)', opacity: 0.5 }} />
          <p className="text-[11px] text-center" style={{ color: 'var(--m-muted)' }}>
            {hasProbeData
              ? 'Computing brand intelligence...'
              : 'Run an audit to see how AI and humans perceive your brand'}
          </p>
        </div>
      ) : (
        <>
          {/* Two-column layout: ScoreCircle left | Metrics right */}
          <div className="flex items-start gap-4 flex-1">
            <ScoreCircle score={primaryScore} size="small" px={72} strokeWidth={5} />

            <div className="flex-1 min-w-0 space-y-1.5">
              {/* AI Visibility */}
              {data && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>AI Visibility</span>
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                    {data.aiVisibility}%
                  </span>
                </div>
              )}

              {/* Sentiment */}
              {data && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>Sentiment</span>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      color: sentimentPill(data.overallSentiment).color,
                      background: `color-mix(in srgb, ${sentimentPill(data.overallSentiment).color} 10%, transparent)`,
                    }}
                  >
                    {sentimentPill(data.overallSentiment).label}
                  </span>
                </div>
              )}

              {/* AI Readability */}
              {avgAiReadability != null && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>AI Readability</span>
                  <span
                    className="text-[11px] font-semibold tabular-nums"
                    style={{ color: avgAiReadability >= 70 ? 'var(--ok)' : avgAiReadability >= 40 ? 'var(--warn)' : 'var(--severe)' }}
                  >
                    {avgAiReadability}/100
                  </span>
                </div>
              )}

              {/* Models tested */}
              {(data || probes.length > 0) && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>Models tested</span>
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                    {data?.perModel.length ?? probes.length}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-auto pt-3">
            <span
              className="text-[11px] font-semibold inline-flex items-center gap-1 group-hover:underline"
              style={{ color: 'var(--ink)' }}
            >
              View full intelligence <ChevronRight size={11} />
            </span>
            <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>
              {aiPagesScored > 0 && `${aiPagesScored} page${aiPagesScored === 1 ? '' : 's'} scored`}
              {data?.computedAt && ` · ${new Date(data.computedAt).toLocaleDateString()}`}
            </span>
          </div>

          {(refreshing || refreshOk) && (
            <p className="text-[10px] mt-1" style={{ color: refreshOk ? 'var(--ok)' : 'var(--m-muted)' }}>
              {refreshing ? 'Re-scanning model probes...' : 'Re-scan complete'}
            </p>
          )}
        </>
      )}
    </Link>
  )
}
