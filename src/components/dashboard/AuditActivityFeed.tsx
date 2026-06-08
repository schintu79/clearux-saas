'use client'

/**
 * AuditActivityFeed — unified live activity + progress panel.
 *
 * Merges the old AuditProgressLoader (top card) with the live activity
 * feed into a single compact card:
 *   • Header: Zap icon + "Live activity" + {percent}% + status dot + "RUNNING" / event count
 *   • Progress bar replaces the heading separator line
 *   • CTA "Go to Overview →" in header top-right
 *   • Scrollable activity timeline below
 *   • Stuck-audit detection with restart button
 */

import React, { useRef, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Zap,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import { useAuditActivity, ActivityLogEntry } from '@/hooks/useAuditActivity'
import { useAuditProgress } from '@/hooks/useAuditProgress'

interface AuditActivityFeedProps {
  auditId: string
  /** Whether the audit is still in progress (enables polling) */
  isRunning: boolean
  /** Max height for the scroll area (px). Default 340 */
  maxHeight?: number
  /** Audit status string for progress hook */
  status?: string
  /** Fallback progress percent from audit object */
  percent?: number | null
  /** Href for "Go to Overview" CTA */
  overviewHref?: string
  /** Called when user clicks "Restart audit" on a stuck audit */
  onRestart?: () => void
}

const STATUS_DOT_COLOR: Record<string, string> = {
  info: 'var(--signal)',
  success: 'var(--ok)',
  error: 'var(--severe)',
  warning: 'var(--warn)',
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ''
  }
}

function isStageEvent(event: string): boolean {
  return event.startsWith('stage_') || event.startsWith('pipeline_')
}

const STUCK_THRESHOLD_MS = 6 * 60 * 1000 // 6 minutes — deep audits with 28 categories can legitimately take 4-5min per batch

const AuditActivityFeed: React.FC<AuditActivityFeedProps> = ({
  auditId,
  isRunning,
  maxHeight = 340,
  status = '',
  percent: percentProp,
  overviewHref,
  onRestart,
}) => {
  const { entries, loading } = useAuditActivity(auditId, { enabled: isRunning })
  const scrollRef = useRef<HTMLDivElement>(null)

  // ── Progress data ────────────────────────────────────────
  const progressEnabled = ['payment_received', 'crawling', 'analysing', 'generating_report'].includes(status)
  const { data: progressData } = useAuditProgress(auditId, {
    enabled: progressEnabled,
    interval: 2500,
  })

  const stageFallback: Record<string, number> = {
    payment_received: 0,
    crawling: 5,
    analysing: 50,
    generating_report: 85,
    completed: 100,
  }

  const rawTarget = progressData?.progress
    ?? (typeof percentProp === 'number' ? percentProp : stageFallback[status] ?? 0)
  const target = Math.max(0, Math.min(100, rawTarget))

  // Animated display value
  const [display, setDisplay] = useState<number>(target)
  useEffect(() => {
    let raf: number
    const tick = () => {
      setDisplay((cur) => {
        const diff = target - cur
        if (Math.abs(diff) < 0.5) return target
        raf = requestAnimationFrame(tick)
        return cur + diff * 0.15
      })
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])

  // ── Stuck detection ──────────────────────────────────────
  const [lastProgressChange, setLastProgressChange] = useState(Date.now())
  const [isStuck, setIsStuck] = useState(false)
  const prevProgressRef = useRef<number | null>(null)

  useEffect(() => {
    const currentProgress = progressData?.progress ?? percentProp ?? null
    if (currentProgress !== null && currentProgress !== prevProgressRef.current) {
      prevProgressRef.current = currentProgress
      setLastProgressChange(Date.now())
      setIsStuck(false)
    }
  }, [progressData?.progress, percentProp])

  useEffect(() => {
    const check = setInterval(() => {
      if (Date.now() - lastProgressChange > STUCK_THRESHOLD_MS) {
        setIsStuck(true)
      }
    }, 10_000)
    return () => clearInterval(check)
  }, [lastProgressChange])

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries.length])

  // ── Loading state ────────────────────────────────────────
  if (loading && entries.length === 0) {
    return (
      <div
        className="rounded-xl overflow-hidden bg-card"
        style={{ border: '1px solid var(--rule)' }}
      >
        {/* Header */}
        <FeedHeader
          isRunning={isRunning}
          display={display}
          overviewHref={overviewHref}
          entryCount={0}
        />
        {/* Progress bar */}
        <ProgressBar display={display} />
        <div className="px-5 py-6 flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin" style={{ color: 'var(--m-muted)' }} />
          <span className="text-[12px] text-m-muted">Waiting for activity...</span>
        </div>
      </div>
    )
  }

  if (!isRunning && entries.length === 0) return null

  return (
    <div
      className="rounded-xl overflow-hidden bg-card"
      style={{ border: '1px solid var(--rule)' }}
      data-testid="audit-activity-feed"
    >
      {/* Header */}
      <FeedHeader
        isRunning={isRunning}
        display={display}
        overviewHref={overviewHref}
        entryCount={entries.length}
      />

      {/* Progress bar (replaces border-b separator) */}
      <ProgressBar display={display} />

      {/* Feed */}
      <div
        ref={scrollRef}
        className="overflow-y-auto"
        style={{ maxHeight }}
      >
        <div className="px-5 py-3 space-y-0">
          {entries.map((entry, idx) => (
            <ActivityRow
              key={entry.id}
              entry={entry}
              isLast={idx === entries.length - 1}
              isLatest={idx === entries.length - 1 && isRunning}
            />
          ))}
          {isRunning && entries.length > 0 && !isStuck && (
            <div className="flex items-center gap-2 pl-[7px] pt-2 pb-1">
              <div className="relative">
                <span
                  className="w-2 h-2 rounded-full block animate-pulse"
                  style={{ background: 'var(--signal)' }}
                />
              </div>
              <span className="text-[11px] text-m-muted ml-1.5">Processing...</span>
            </div>
          )}

          {/* Stuck audit escape hatch */}
          {isStuck && onRestart && (
            <div
              className="mt-3 mb-1 px-4 py-3 rounded-lg text-center"
              style={{
                background: 'color-mix(in srgb, var(--warn) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--warn) 20%, transparent)',
              }}
            >
              <p className="text-[12px] font-medium mb-2" style={{ color: 'var(--ink)' }}>
                This audit appears to be stuck. No progress in the last 6 minutes.
              </p>
              <button
                onClick={onRestart}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-4 py-2 rounded-md transition-colors"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              >
                <RefreshCw size={12} />
                Restart audit
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Header sub-component ──────────────────────────────────── */
function FeedHeader({
  isRunning,
  display,
  overviewHref,
  entryCount,
}: {
  isRunning: boolean
  display: number
  overviewHref?: string
  entryCount: number
}) {
  return (
    <div className="px-5 pt-4 pb-3 flex items-center gap-2">
      <div
        className="w-5 h-5 rounded-md flex items-center justify-center"
        style={{ background: 'color-mix(in srgb, var(--signal) 10%, transparent)' }}
      >
        <Zap size={11} style={{ color: 'var(--signal)' }} />
      </div>
      <h3 className="text-[11px] font-semibold tracking-[0.06em] uppercase text-m-muted">
        Live activity
      </h3>

      {/* Status: percent + running dot OR event count */}
      {isRunning ? (
        <div className="ml-auto flex items-center gap-2.5">
          <span
            className="text-[11px] font-semibold tabular-nums"
            style={{ color: 'var(--ink)' }}
          >
            {Math.round(display)}%
          </span>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--ok)' }} />
          <span className="text-[10px] font-medium text-m-muted uppercase tracking-wide">
            Running
          </span>
          {overviewHref && (
            <Link
              href={overviewHref}
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors ml-1"
              style={{
                color: 'var(--ink)',
                border: '1px solid var(--rule)',
                background: 'transparent',
              }}
            >
              Overview
              <ArrowRight size={10} />
            </Link>
          )}
        </div>
      ) : entryCount > 0 ? (
        <div className="ml-auto flex items-center gap-2.5">
          <span className="text-[10px] font-medium text-m-muted uppercase tracking-wide">
            {entryCount} event{entryCount === 1 ? '' : 's'}
          </span>
          {overviewHref && (
            <Link
              href={overviewHref}
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors"
              style={{
                color: 'var(--ink)',
                border: '1px solid var(--rule)',
                background: 'transparent',
              }}
            >
              Overview
              <ArrowRight size={10} />
            </Link>
          )}
        </div>
      ) : null}
    </div>
  )
}

/* ── Progress bar (replaces the old border-b separator) ─────── */
function ProgressBar({ display }: { display: number }) {
  return (
    <div
      className="h-[2px] w-full"
      style={{ background: 'color-mix(in srgb, var(--ink) 8%, transparent)' }}
    >
      <div
        className="h-full"
        style={{
          width: `${display}%`,
          background: 'var(--ink)',
          transition: 'width 200ms ease-out',
        }}
      />
    </div>
  )
}

/* ── Activity row ──────────────────────────────────────────── */
function ActivityRow({
  entry,
  isLast,
  isLatest,
}: {
  entry: ActivityLogEntry
  isLast: boolean
  isLatest: boolean
}) {
  const dotColor = STATUS_DOT_COLOR[entry.status] ?? 'var(--m-muted)'
  const isStage = isStageEvent(entry.event)
  const isFinalEvent = entry.event === 'pipeline_completed' || entry.event === 'pipeline_failed'

  return (
    <div className="flex gap-3 group" style={{ opacity: isLatest ? 1 : isLast ? 0.9 : 0.75 }}>
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center pt-[6px]" style={{ width: 16 }}>
        <span
          className="w-2 h-2 rounded-full flex-shrink-0 transition-all"
          style={{
            background: dotColor,
            boxShadow: isLatest ? `0 0 6px ${dotColor}` : 'none',
          }}
        />
        {!isLast && (
          <div
            className="w-px flex-1 mt-1"
            style={{ background: 'var(--rule)', minHeight: 12 }}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-2.5">
        <div className="flex items-baseline gap-2">
          <p
            className="text-[12px] leading-[1.4]"
            style={{
              color: isFinalEvent ? dotColor : 'var(--ink)',
              fontWeight: isStage || isFinalEvent ? 500 : 400,
            }}
          >
            {entry.message}
          </p>
          <span className="text-[10px] text-m-muted tabular-nums flex-shrink-0">
            {formatTime(entry.createdAt)}
          </span>
        </div>
      </div>
    </div>
  )
}

export default AuditActivityFeed
