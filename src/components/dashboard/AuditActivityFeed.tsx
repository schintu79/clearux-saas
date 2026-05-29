'use client'

/**
 * AuditActivityFeed — chat-like live activity panel.
 *
 * Shows real-time pipeline progress messages as they arrive,
 * driven by the useAuditActivity hook which polls the audit_logs table.
 * Renders a compact vertical timeline with status-colored dots,
 * timestamps, and stage labels.
 */

import React, { useRef, useEffect } from 'react'
import { Activity, CheckCircle2, AlertCircle, AlertTriangle, Loader2, Zap } from 'lucide-react'
import { useAuditActivity, ActivityLogEntry } from '@/hooks/useAuditActivity'

interface AuditActivityFeedProps {
  auditId: string
  /** Whether the audit is still in progress (enables polling) */
  isRunning: boolean
  /** Max height before scrolling (px). Default 320 */
  maxHeight?: number
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  info: <Activity size={12} style={{ color: 'var(--signal)' }} />,
  success: <CheckCircle2 size={12} style={{ color: 'var(--ok)' }} />,
  error: <AlertCircle size={12} style={{ color: 'var(--severe)' }} />,
  warning: <AlertTriangle size={12} style={{ color: 'var(--warn)' }} />,
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

const AuditActivityFeed: React.FC<AuditActivityFeedProps> = ({
  auditId,
  isRunning,
  maxHeight = 320,
}) => {
  const { entries, loading } = useAuditActivity(auditId, { enabled: isRunning })
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries.length])

  if (loading && entries.length === 0) {
    return (
      <div
        className="rounded-xl overflow-hidden bg-card"
        style={{ border: '1px solid var(--rule)' }}
      >
        <div className="px-5 pt-4 pb-3 flex items-center gap-2 border-b border-rule/40">
          <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--signal) 10%, transparent)' }}>
            <Zap size={11} style={{ color: 'var(--signal)' }} />
          </div>
          <h3 className="text-[11px] font-semibold tracking-[0.06em] uppercase text-m-muted">
            Live activity
          </h3>
        </div>
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
      <div className="px-5 pt-4 pb-3 flex items-center gap-2 border-b border-rule/40">
        <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--signal) 10%, transparent)' }}>
          <Zap size={11} style={{ color: 'var(--signal)' }} />
        </div>
        <h3 className="text-[11px] font-semibold tracking-[0.06em] uppercase text-m-muted">
          Live activity
        </h3>
        {isRunning && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--ok)' }} />
            <span className="text-[10px] font-medium text-m-muted uppercase tracking-wide">Running</span>
          </div>
        )}
        {!isRunning && entries.length > 0 && (
          <span className="ml-auto text-[10px] font-medium text-m-muted uppercase tracking-wide">
            {entries.length} event{entries.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

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
          {isRunning && entries.length > 0 && (
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
        </div>
      </div>
    </div>
  )
}

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
      <div className={`flex-1 pb-2.5 ${isLast ? '' : ''}`}>
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
