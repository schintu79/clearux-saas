'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Radio, ChevronRight, RefreshCw, Eye, SmilePlus, BookOpen, Cpu, Target } from 'lucide-react'
import ScoreCircle from '@/components/ui/ScoreCircle'
import { useWorkspace } from '@/context/WorkspaceContext'
import type { BrandIntelligenceSummary } from '@/lib/audit-engine/brand-intelligence'
import {
  interrogationAccuracy,
  interrogationVisibility,
  interrogationSentiment,
  brandTokensFor,
  type InterrogationAnswer,
} from '@/lib/scoring/interrogation-metrics'

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

function sentimentInfo(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'Positive', color: 'var(--ok)' }
  if (score >= 40) return { label: 'Neutral', color: 'var(--warn)' }
  return { label: 'Negative', color: 'var(--severe)' }
}

function valueColor(value: number): string {
  if (value >= 70) return 'var(--ok)'
  if (value >= 40) return 'var(--warn)'
  return 'var(--severe)'
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
  const { workspace, workspaceSlug, workspaceId } = useWorkspace()
  const dashPrefix = workspaceSlug ? `/dashboard/${workspaceSlug}` : '/dashboard'
  const [refreshing, setRefreshing] = useState(false)
  const [refreshOk, setRefreshOk] = useState(false)

  // Saved interrogation answers — the paid benchmark is the primary source
  // for Accuracy/Visibility/Sentiment (audit-time probe data is the
  // fallback; the lean pipeline doesn't produce it). Shared formulas from
  // @/lib/scoring/interrogation-metrics keep this card and the Brand
  // Intelligence page on identical numbers.
  const [iqAnswers, setIqAnswers] = useState<InterrogationAnswer[]>([])
  const [iqModelCount, setIqModelCount] = useState(0)
  useEffect(() => {
    if (!workspaceId) return
    let active = true
    fetch(`/api/ai-interrogation/run?workspace_id=${workspaceId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d?.interrogations) return
        const answers: InterrogationAnswer[] = []
        const models = new Set<string>()
        for (const item of d.interrogations) {
          for (const r of item.results ?? []) {
            answers.push({ accuracy: r.accuracy ?? null, responseText: r.response_text ?? null })
            if (r.model_slug) models.add(r.model_slug)
          }
        }
        setIqAnswers(answers)
        setIqModelCount(models.size)
      })
      .catch(() => {})
    return () => { active = false }
  }, [workspaceId])

  const ws = workspace as any
  const iqTokens = brandTokensFor(ws?.brand_name || ws?.name, ws?.primary_domain)
  const iqAcc = interrogationAccuracy(iqAnswers)
  const iqVis = interrogationVisibility(iqAnswers, iqTokens)
  const iqSent = interrogationSentiment(iqAnswers)

  const biScore = data?.score ?? legacyScore ?? null
  const xrayAvg = probes.length > 0
    ? Math.round(probes.filter(p => p.status === 'measured').reduce((s, p) => s + p.accuracy_score, 0) / Math.max(probes.filter(p => p.status === 'measured').length, 1))
    : null

  const primaryScore = biScore ?? (avgAiReadability != null && xrayAvg != null
    ? Math.round((avgAiReadability + xrayAvg) / 2)
    : avgAiReadability ?? xrayAvg ?? null)

  const hasData = primaryScore != null || iqAcc != null || iqVis != null

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

  // Build metric rows
  const metrics: Array<{ label: string; Icon: React.ElementType; value: string; color: string }> = []

  // ── Accuracy — interrogation benchmark first, audit X-ray probes fallback ──
  const accuracyValue = iqAcc ?? xrayAvg
  if (accuracyValue != null) {
    metrics.push({
      label: 'Accuracy',
      Icon: Target,
      value: `${accuracyValue}%`,
      color: valueColor(accuracyValue),
    })
  }

  // ── AI Visibility — interrogation benchmark first ──
  if (iqVis != null) {
    metrics.push({
      label: 'AI Visibility',
      Icon: Eye,
      value: `${iqVis}%`,
      color: valueColor(iqVis),
    })
  } else if (data) {
    // Audit-time fallback: honest model recognition count instead of a
    // potentially inflated %. "2 of 6" is surgical and true.
    const totalModels = data.perModel.length
    const recognizedModels = probes.length > 0
      ? probes.filter(p => p.accuracy_score >= 20).length  // same threshold as intelligence page
      : data.perModel.filter(m => m.visibility).length     // fallback to stored visibility
    const visPercent = totalModels > 0 ? Math.round((recognizedModels / totalModels) * 100) : 0
    metrics.push({
      label: 'AI Visibility',
      Icon: Eye,
      value: `${recognizedModels} of ${totalModels}`,
      color: valueColor(visPercent),
    })
  }

  // ── Sentiment — audit summary first, interrogation tone fallback ──
  if (data) {
    const sent = sentimentInfo(data.overallSentiment)
    metrics.push({ label: 'Sentiment', Icon: SmilePlus, value: sent.label, color: sent.color })
  } else if (iqSent != null) {
    const sent = sentimentInfo(iqSent)
    metrics.push({ label: 'Sentiment', Icon: SmilePlus, value: sent.label, color: sent.color })
  }

  if (avgAiReadability != null) {
    metrics.push({
      label: 'AI Readability',
      Icon: BookOpen,
      value: `${avgAiReadability}/100`,
      color: valueColor(avgAiReadability),
    })
  }

  if (data || probes.length > 0 || iqModelCount > 0) {
    metrics.push({
      label: 'Models tested',
      Icon: Cpu,
      value: `${data?.perModel.length ?? (probes.length || iqModelCount)}`,
      color: 'var(--ink)',
    })
  }

  return (
    <Link
      href={`${dashPrefix}/intelligence`}
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
        <div className="flex-1 flex flex-col items-center justify-center py-4 gap-2" style={{ minHeight: 140 }}>
          <Radio size={20} style={{ color: 'var(--m-muted)', opacity: 0.5 }} />
          <p className="text-[11px] text-center" style={{ color: 'var(--m-muted)' }}>
            {hasProbeData
              ? 'Computing brand intelligence...'
              : 'Run an audit to see how AI and humans perceive your brand'}
          </p>
        </div>
      ) : (
        <>
          {/* Score circle left + metrics right */}
          <div className="flex gap-6 flex-1 items-center" style={{ minHeight: 140 }}>
            {/* Left: ScoreCircle — pushed left, thicker stroke */}
            <div className="flex-shrink-0">
              <ScoreCircle score={primaryScore} size="medium" />
            </div>

            {/* Right: Metric legend with icons */}
            <div className="flex flex-col gap-3 flex-1 min-w-0">
              {metrics.map(({ label, Icon, value, color }) => (
                <div key={label} className="flex items-center gap-2">
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
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-auto pt-3" style={{ borderTop: '1px solid var(--rule)' }}>
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
