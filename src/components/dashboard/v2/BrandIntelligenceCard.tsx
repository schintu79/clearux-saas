'use client'

import React from 'react'
import Link from 'next/link'
import { Radio, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
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
}

/* ── Helpers ────────────────────────────────────────── */

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--ok)'
  if (score >= 50) return 'var(--warn)'
  return 'var(--severe)'
}

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
}: BrandIntelligenceCardProps) {
  // Use brand intelligence data if available, otherwise fall back to legacy
  const score = data?.score ?? legacyScore ?? null
  const hasData = data != null || legacyScore != null

  return (
    <Link
      href="/dashboard/intelligence"
      className="rounded-xl p-4 sm:p-5 flex flex-col h-full transition-all hover:shadow-md hover:-translate-y-0.5 group"
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
            {data?.computedAt && (
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
                Updated {new Date(data.computedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        <ChevronRight
          size={14}
          className="flex-shrink-0 mt-1 transition-transform group-hover:translate-x-0.5"
          style={{ color: 'var(--m-muted)' }}
        />
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
            {/* Score */}
            <div className="flex items-end gap-3 mb-3">
              <div className="flex items-baseline gap-1">
                <span
                  className="text-[42px] font-bold leading-none tabular-nums"
                  style={{ color: score != null ? scoreColor(score) : 'var(--m-muted)' }}
                >
                  {score ?? '—'}
                </span>
                <span className="text-[13px] font-medium" style={{ color: 'var(--m-muted)' }}>/100</span>
              </div>
            </div>
            <p className="text-[10px] uppercase font-semibold tracking-[0.06em] mb-3" style={{ color: 'var(--m-muted)' }}>
              Brand Intelligence Score
            </p>

            {/* Key metrics */}
            {data && (
              <div className="space-y-2 mb-3">
                {/* AI Visibility */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>AI Visibility</span>
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                    {data.aiVisibility}%
                  </span>
                </div>

                {/* Sentiment */}
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

                {/* Placement */}
                {data.placementScore != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>Avg placement</span>
                    <span className="text-[11px] font-semibold tabular-nums" style={{ color: data.placementScore <= 2 ? 'var(--ok)' : data.placementScore <= 3.5 ? 'var(--warn)' : 'var(--severe)' }}>
                      {data.placementScore}/5
                    </span>
                  </div>
                )}

                {/* Share of Voice */}
                {data.shareOfVoice != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>Share of Voice</span>
                    <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                      {data.shareOfVoice}%
                    </span>
                  </div>
                )}

                {/* Models tested */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>Models tested</span>
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                    {data.perModel.length}
                  </span>
                </div>
              </div>
            )}

            {/* Issue summary */}
            {data && data.issueCount > 0 && (
              <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--warn)' }}>
                {data.issueCount} issue{data.issueCount !== 1 ? 's' : ''} affecting brand perception
              </p>
            )}

            {/* Footer CTA */}
            <span
              className="text-[11px] font-semibold mt-auto pt-2 inline-flex items-center gap-1 group-hover:underline"
              style={{ color: 'var(--ink)' }}
            >
              View full intelligence <ChevronRight size={11} />
            </span>
          </>
        )}
      </div>
    </Link>
  )
}
