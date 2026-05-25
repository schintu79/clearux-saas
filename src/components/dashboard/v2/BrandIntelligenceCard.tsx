'use client'

import React, { useCallback, useState } from 'react'
import Link from 'next/link'
import { Radio, ChevronRight, RefreshCw, Brain } from 'lucide-react'
import ScoreCircle from '@/components/ui/ScoreCircle'
import type { BrandIntelligenceSummary } from '@/lib/audit-engine/brand-intelligence'

/* ── Props ─────────────────────────────────────────── */

interface BrandIntelligenceCardProps {
  data: BrandIntelligenceSummary | null
  /** Fallback: legacy benchmark data if brand intelligence not yet computed */
  legacyScore?: number | null
  legacyCompetitorCount?: number
  /** Whether probe data exists but BI summary hasn't been computed */
  hasProbeData?: boolean
  auditId?: string | null
  /** AI Readability data — merged from the old AI Readability card */
  avgAiReadability?: number | null
  aiPagesBuckets?: { green: number; amber: number; red: number }
  aiPagesScored?: number
  totalPages?: number
  /** Model probes (from AI X-Ray) */
  probes?: Array<{ model_id: string; model_label: string; accuracy_score: number; status?: 'measured' | 'skipped' | 'error' | null; error_message?: string | null }>
  /** Callback after X-Ray rescan completes */
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

  // Compute combined score from BI data + AI readability
  const biScore = data?.score ?? legacyScore ?? null
  const xrayAvg = probes.length > 0
    ? Math.round(probes.filter(p => p.status === 'measured').reduce((s, p) => s + p.accuracy_score, 0) / Math.max(probes.filter(p => p.status === 'measured').length, 1))
    : null

  // Unified score: BI score if available, else AI readability, else null
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

  // Stacked coverage bar data
  const totalBucket = (aiPagesBuckets?.green ?? 0) + (aiPagesBuckets?.amber ?? 0) + (aiPagesBuckets?.red ?? 0)
  const pct = (n: number) => totalBucket > 0 ? (n / totalBucket) * 100 : 0

  return (
    <Link
      href="/dashboard/intelligence"
      className="rounded-xl p-4 sm:p-5 flex flex-col h-full transition-all hover:shadow-md hover:-translate-y-0.5 group col-span-1 md:col-span-2"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      aria-label="Open Brand Intelligence"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex items-start gap-2">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}
          >
            <Radio size={14} />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.005em]" style={{ color: 'var(--ink)' }}>
              Brand Intelligence
            </h3>
            <p className="text-[11px] leading-tight mt-0.5" style={{ color: 'var(--m-muted)' }}>
              How your brand is perceived across AI, web, social, and conversations
            </p>
          </div>
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
            className="mt-1 transition-transform group-hover:translate-x-0.5"
            style={{ color: 'var(--m-muted)' }}
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center text-center py-4 flex-1">
            <Radio size={20} style={{ color: 'var(--m-muted)', opacity: 0.5 }} className="mb-2" />
            <p className="text-[12px]" style={{ color: 'var(--m-muted)' }}>
              {hasProbeData
                ? 'Computing brand intelligence...'
                : 'Run an audit to see how AI and humans perceive your brand'}
            </p>
          </div>
        ) : (
          <>
            {/* Score + key metrics side by side */}
            <div className="flex items-start gap-4">
              {/* Score circle */}
              <ScoreCircle score={primaryScore} size="small" px={72} strokeWidth={5} />

              {/* Key metric rows */}
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

                {/* Share of Voice */}
                {data?.shareOfVoice != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>Share of Voice</span>
                    <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                      {data.shareOfVoice}%
                    </span>
                  </div>
                )}

                {/* AI Readability (from merged card) */}
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

            {/* AI readability coverage bar */}
            {totalBucket > 0 && (
              <div className="mt-3">
                <div
                  className="h-1.5 w-full rounded-full overflow-hidden flex"
                  style={{ background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}
                >
                  {(aiPagesBuckets?.green ?? 0) > 0 && (
                    <span style={{ width: `${pct(aiPagesBuckets!.green)}%`, background: 'var(--ok)' }} />
                  )}
                  {(aiPagesBuckets?.amber ?? 0) > 0 && (
                    <span style={{ width: `${pct(aiPagesBuckets!.amber)}%`, background: 'var(--warn)' }} />
                  )}
                  {(aiPagesBuckets?.red ?? 0) > 0 && (
                    <span style={{ width: `${pct(aiPagesBuckets!.red)}%`, background: 'var(--severe)' }} />
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px]">
                  <span className="flex items-center gap-1" style={{ color: 'var(--ok)' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ok)' }} />
                    <span className="tabular-nums font-semibold">{aiPagesBuckets?.green ?? 0}</span> good
                  </span>
                  <span className="flex items-center gap-1" style={{ color: 'var(--warn)' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--warn)' }} />
                    <span className="tabular-nums font-semibold">{aiPagesBuckets?.amber ?? 0}</span> ok
                  </span>
                  <span className="flex items-center gap-1" style={{ color: 'var(--severe)' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--severe)' }} />
                    <span className="tabular-nums font-semibold">{aiPagesBuckets?.red ?? 0}</span> poor
                  </span>
                </div>
              </div>
            )}

            {/* Issue summary */}
            {data && data.issueCount > 0 && (
              <p className="text-[11px] font-medium mt-2" style={{ color: 'var(--warn)' }}>
                {data.issueCount} issue{data.issueCount !== 1 ? 's' : ''} affecting how AI and humans see your brand
              </p>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between mt-auto pt-2">
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
              <p
                className="text-[10px] mt-1"
                style={{ color: refreshOk ? 'var(--ok)' : 'var(--m-muted)' }}
              >
                {refreshing ? 'Re-scanning model probes...' : 'Re-scan complete'}
              </p>
            )}
          </>
        )}
      </div>
    </Link>
  )
}
