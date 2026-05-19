'use client'

// ============================================================
// ClearUX — WCAG 2.1 AA Checklist Panel
// ============================================================
// Renders a per-page WCAG conformance checklist with pass/fail
// per criterion, organized by principle. Drill-down into issues
// with element-level evidence. Designed for both the audit detail
// WCAG tab and the FixPreviewPanel sidebar.
// ============================================================

import React, { useState, useMemo } from 'react'
import {
  Shield,
  Check,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Eye,
  Ear,
  Hand,
  Settings,
  HelpCircle,
  Minus,
} from 'lucide-react'
import clsx from 'clsx'
import type {
  WcagPrinciple,
  WcagStatus,
  WcagCheckResult,
  WcagIssue,
} from '@/lib/audit-engine/pipeline/wcag-checker'

/* ── Types ─────────────────────────────────────────────────── */

export interface WcagChecklistProps {
  /** JSON-stringified WcagCheckResult[] from audit_pages.wcag_checklist */
  checklistJson: string | null
  /** 0-100 score from audit_pages.wcag_score */
  score: number | null
  /** Page URL for display */
  pageUrl?: string
  /** Compact mode for sidebar preview */
  compact?: boolean
}

/* ── Principle metadata ───────────────────────────────────── */

const PRINCIPLES: {
  key: WcagPrinciple
  label: string
  description: string
  Icon: React.ElementType
}[] = [
  {
    key: 'perceivable',
    label: 'Perceivable',
    description: 'Information must be presentable in ways users can perceive',
    Icon: Eye,
  },
  {
    key: 'operable',
    label: 'Operable',
    description: 'UI components and navigation must be operable',
    Icon: Hand,
  },
  {
    key: 'understandable',
    label: 'Understandable',
    description: 'Information and UI operation must be understandable',
    Icon: HelpCircle,
  },
  {
    key: 'robust',
    label: 'Robust',
    description: 'Content must be robust enough for diverse user agents',
    Icon: Settings,
  },
]

/* ── Status helpers ───────────────────────────────────────── */

function StatusIcon({ status, size = 13 }: { status: WcagStatus; size?: number }) {
  switch (status) {
    case 'pass':
      return <Check size={size} strokeWidth={2.5} style={{ color: 'var(--ok)' }} />
    case 'fail':
      return <X size={size} strokeWidth={2.5} style={{ color: 'var(--severe)' }} />
    case 'warning':
      return <AlertTriangle size={size} strokeWidth={2} style={{ color: 'var(--warn)' }} />
    case 'not_applicable':
      return <Minus size={size} strokeWidth={2} style={{ color: 'var(--m-muted-2)' }} />
    case 'needs_review':
      return <Eye size={size} strokeWidth={2} style={{ color: 'var(--m-muted)' }} />
    default:
      return <Minus size={size} strokeWidth={2} style={{ color: 'var(--m-muted-2)' }} />
  }
}

function statusLabel(status: WcagStatus): string {
  switch (status) {
    case 'pass': return 'Pass'
    case 'fail': return 'Fail'
    case 'warning': return 'Warning'
    case 'not_applicable': return 'N/A'
    case 'needs_review': return 'Needs review'
    default: return status
  }
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'var(--severe)'
    case 'high': return 'var(--severe)'
    case 'medium': return 'var(--warn)'
    case 'low': return 'var(--m-muted)'
    default: return 'var(--m-muted)'
  }
}

/* ── Score ring (small, inline) ───────────────────────────── */

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'var(--ok)' : score >= 50 ? 'var(--warn)' : 'var(--severe)'
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold"
      style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
    >
      <Shield size={12} strokeWidth={2} />
      {Math.round(score)}%
    </div>
  )
}

/* ── Issue detail row ─────────────────────────────────────── */

function IssueRow({ issue }: { issue: WcagIssue }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="border-t py-2 px-3 text-[11px] leading-[1.6]"
      style={{ borderColor: 'var(--rule)' }}
    >
      <button
        className="w-full flex items-start gap-2 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
          style={{ background: `color-mix(in srgb, ${severityColor(issue.severity)} 15%, transparent)`, color: severityColor(issue.severity) }}
        >
          {issue.severity[0].toUpperCase()}
        </span>
        <span className="flex-1 min-w-0" style={{ color: 'var(--ink)' }}>
          {issue.description}
        </span>
        <ChevronDown
          size={12}
          className={clsx('flex-shrink-0 mt-0.5 transition-transform', expanded && 'rotate-180')}
          style={{ color: 'var(--m-muted)' }}
        />
      </button>

      {expanded && (
        <div className="mt-2 ml-6 flex flex-col gap-1.5">
          {issue.element && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--m-muted)' }}>
                Element
              </span>
              <code
                className="block mt-0.5 px-2 py-1 rounded text-[10px] font-mono break-all"
                style={{ background: 'var(--paper-2)', color: 'var(--ink-2)', border: '1px solid var(--rule)' }}
              >
                {issue.element}
              </code>
            </div>
          )}
          {issue.evidence && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--m-muted)' }}>
                Evidence
              </span>
              <code
                className="block mt-0.5 px-2 py-1 rounded text-[10px] font-mono break-all whitespace-pre-wrap"
                style={{ background: 'var(--paper-2)', color: 'var(--ink-2)', border: '1px solid var(--rule)' }}
              >
                {issue.evidence.slice(0, 300)}
              </code>
            </div>
          )}
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--m-muted)' }}>
              Recommendation
            </span>
            <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: 'var(--ink)' }}>
              {issue.recommendation}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Criterion row ────────────────────────────────────────── */

function CriterionRow({ result, compact }: { result: WcagCheckResult; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const hasIssues = result.issues.length > 0

  if (compact) {
    return (
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 text-[11px]"
        style={{ borderBottom: '1px solid var(--rule)' }}
      >
        <StatusIcon status={result.status} size={11} />
        <span className="font-mono text-[10px]" style={{ color: 'var(--m-muted)' }}>
          {result.criterion.id}
        </span>
        <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--ink)' }}>
          {result.criterion.name}
        </span>
        <span
          className="text-[9px] uppercase font-semibold tracking-wide px-1.5 py-0.5 rounded"
          style={{
            color: result.criterion.level === 'AA' ? 'var(--signal)' : 'var(--m-muted)',
            background: result.criterion.level === 'AA'
              ? 'color-mix(in srgb, var(--signal) 10%, transparent)'
              : 'var(--paper-2)',
          }}
        >
          {result.criterion.level}
        </span>
      </div>
    )
  }

  return (
    <div style={{ borderBottom: '1px solid var(--rule)' }}>
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-paper-2/50 transition-colors"
        onClick={() => hasIssues && setExpanded(!expanded)}
        disabled={!hasIssues}
      >
        <StatusIcon status={result.status} />
        <span className="font-mono text-[11px] flex-shrink-0" style={{ color: 'var(--m-muted)' }}>
          {result.criterion.id}
        </span>
        <span className="flex-1 min-w-0 text-[12px] font-medium" style={{ color: 'var(--ink)' }}>
          {result.criterion.name}
        </span>
        <span
          className="text-[9px] uppercase font-semibold tracking-wide px-1.5 py-0.5 rounded flex-shrink-0"
          style={{
            color: result.criterion.level === 'AA' ? 'var(--signal)' : 'var(--m-muted)',
            background: result.criterion.level === 'AA'
              ? 'color-mix(in srgb, var(--signal) 10%, transparent)'
              : 'var(--paper-2)',
          }}
        >
          {result.criterion.level}
        </span>
        {hasIssues && (
          <>
            <span
              className="text-[10px] flex-shrink-0 tabular-nums"
              style={{ color: 'var(--m-muted)' }}
            >
              {result.issues.length} {result.issues.length === 1 ? 'issue' : 'issues'}
            </span>
            <ChevronRight
              size={13}
              className={clsx('flex-shrink-0 transition-transform', expanded && 'rotate-90')}
              style={{ color: 'var(--m-muted)' }}
            />
          </>
        )}
      </button>

      {expanded && hasIssues && (
        <div className="bg-paper/50">
          {result.issues.map((issue, i) => (
            <IssueRow key={i} issue={issue} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Principle section ────────────────────────────────────── */

function PrincipleSection({
  principle,
  results,
  compact,
  defaultOpen,
}: {
  principle: typeof PRINCIPLES[number]
  results: WcagCheckResult[]
  compact?: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen ?? true)

  const counts = useMemo(() => {
    let pass = 0, fail = 0, warning = 0, na = 0, review = 0
    for (const r of results) {
      if (r.status === 'pass') pass++
      else if (r.status === 'fail') fail++
      else if (r.status === 'warning') warning++
      else if (r.status === 'not_applicable') na++
      else review++
    }
    return { pass, fail, warning, na, review, total: results.length }
  }, [results])

  const PIcon = principle.Icon

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--rule)', background: 'var(--card)' }}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-paper-2/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
        >
          <PIcon size={14} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
            {principle.label}
          </div>
          {!compact && (
            <div className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
              {principle.description}
            </div>
          )}
        </div>

        {/* Mini stats */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {counts.pass > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] font-medium" style={{ color: 'var(--ok)' }}>
              <Check size={11} strokeWidth={2.5} /> {counts.pass}
            </span>
          )}
          {counts.fail > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] font-medium" style={{ color: 'var(--severe)' }}>
              <X size={11} strokeWidth={2.5} /> {counts.fail}
            </span>
          )}
          {counts.warning > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] font-medium" style={{ color: 'var(--warn)' }}>
              <AlertTriangle size={11} strokeWidth={2} /> {counts.warning}
            </span>
          )}
        </div>

        <ChevronDown
          size={14}
          className={clsx('flex-shrink-0 transition-transform', open && 'rotate-180')}
          style={{ color: 'var(--m-muted)' }}
        />
      </button>

      {open && (
        <div>
          {results.map((r) => (
            <CriterionRow key={r.criterion.id} result={r} compact={compact} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Summary bar ──────────────────────────────────────────── */

function SummaryBar({ results }: { results: WcagCheckResult[] }) {
  const counts = useMemo(() => {
    let pass = 0, fail = 0, warning = 0, na = 0
    for (const r of results) {
      if (r.status === 'pass') pass++
      else if (r.status === 'fail') fail++
      else if (r.status === 'warning') warning++
      else na++
    }
    return { pass, fail, warning, na, total: results.length }
  }, [results])

  const tested = counts.total - counts.na
  const passRate = tested > 0 ? Math.round((counts.pass / tested) * 100) : 0

  return (
    <div
      className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl text-[12px]"
      style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
    >
      <div className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--ink)' }}>
        <Shield size={14} strokeWidth={2} style={{ color: 'var(--signal)' }} />
        {counts.total} criteria tested
      </div>
      <span style={{ color: 'var(--rule-2)' }}>|</span>
      <span className="flex items-center gap-1" style={{ color: 'var(--ok)' }}>
        <Check size={12} strokeWidth={2.5} /> {counts.pass} pass
      </span>
      <span className="flex items-center gap-1" style={{ color: 'var(--severe)' }}>
        <X size={12} strokeWidth={2.5} /> {counts.fail} fail
      </span>
      <span className="flex items-center gap-1" style={{ color: 'var(--warn)' }}>
        <AlertTriangle size={12} strokeWidth={2} /> {counts.warning} warnings
      </span>
      {counts.na > 0 && (
        <span className="flex items-center gap-1" style={{ color: 'var(--m-muted)' }}>
          <Minus size={12} strokeWidth={2} /> {counts.na} N/A
        </span>
      )}
      <span className="ml-auto font-bold tabular-nums" style={{ color: passRate >= 80 ? 'var(--ok)' : passRate >= 50 ? 'var(--warn)' : 'var(--severe)' }}>
        {passRate}% conformance
      </span>
    </div>
  )
}

/* ── Main component ───────────────────────────────────────── */

export default function WcagChecklist({ checklistJson, score, pageUrl, compact }: WcagChecklistProps) {
  const results: WcagCheckResult[] = useMemo(() => {
    if (!checklistJson) return []
    try {
      const parsed = JSON.parse(checklistJson)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }, [checklistJson])

  const [filter, setFilter] = useState<'all' | 'fail' | 'warning' | 'pass'>('all')

  const byPrinciple = useMemo(() => {
    const map: Record<WcagPrinciple, WcagCheckResult[]> = {
      perceivable: [],
      operable: [],
      understandable: [],
      robust: [],
    }
    for (const r of results) {
      if (filter !== 'all' && r.status !== filter) continue
      const p = r.criterion.principle
      if (map[p]) map[p].push(r)
    }
    return map
  }, [results, filter])

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <Shield size={28} strokeWidth={1.5} style={{ color: 'var(--m-muted)' }} />
        <p className="text-[13px] font-medium" style={{ color: 'var(--m-muted)' }}>
          No WCAG checklist data available for this page
        </p>
        <p className="text-[11px] max-w-xs" style={{ color: 'var(--m-muted-2)' }}>
          WCAG conformance checks run automatically during the audit pipeline.
          Re-run the audit to generate accessibility compliance data.
        </p>
      </div>
    )
  }

  if (compact) {
    // Compact mode: just show failing/warning criteria inline
    const issues = results.filter((r) => r.status === 'fail' || r.status === 'warning')
    const passing = results.filter((r) => r.status === 'pass')

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <Shield size={11} style={{ color: 'var(--signal)' }} />
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: 'var(--m-muted)' }}
          >
            WCAG 2.1 AA conformance
          </span>
          {score !== null && <ScoreBadge score={score} />}
        </div>

        <div className="rounded-md overflow-hidden" style={{ border: '1px solid var(--rule)' }}>
          {issues.length > 0 ? (
            <ul className="divide-y" style={{ borderColor: 'var(--rule)' }}>
              {issues.slice(0, 8).map((r, i) => (
                <li
                  key={r.criterion.id}
                  className="flex items-start gap-2 px-3 py-2 text-[11px] leading-[1.5]"
                  style={{ background: i % 2 === 0 ? 'transparent' : 'var(--paper-2)' }}
                >
                  <span className="flex-shrink-0 mt-0.5">
                    <StatusIcon status={r.status} size={11} />
                  </span>
                  <span style={{ color: 'var(--ink)' }}>
                    <span className="font-mono text-[10px]" style={{ color: 'var(--m-muted)' }}>
                      {r.criterion.id}
                    </span>{' '}
                    {r.criterion.name}
                    {r.issues.length > 0 && (
                      <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>
                        {' '}({r.issues.length} {r.issues.length === 1 ? 'issue' : 'issues'})
                      </span>
                    )}
                  </span>
                </li>
              ))}
              {issues.length > 8 && (
                <li className="px-3 py-2 text-[10px] text-center" style={{ color: 'var(--m-muted)', background: 'var(--paper-2)' }}>
                  + {issues.length - 8} more
                </li>
              )}
            </ul>
          ) : (
            <div className="px-3 py-3 text-[11px] text-center" style={{ color: 'var(--ok)' }}>
              <Check size={14} className="inline mb-0.5 mr-1" />
              All {passing.length} tested criteria pass
            </div>
          )}
        </div>
      </div>
    )
  }

  // Full mode
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield size={20} strokeWidth={1.75} style={{ color: 'var(--signal)' }} />
          <div>
            <h3 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
              WCAG 2.1 Level AA conformance
            </h3>
            {pageUrl && (
              <p className="text-[11px] mt-0.5 truncate max-w-md" style={{ color: 'var(--m-muted)' }}>
                {pageUrl}
              </p>
            )}
          </div>
        </div>
        {score !== null && <ScoreBadge score={score} />}
      </div>

      {/* Summary bar */}
      <SummaryBar results={results} />

      {/* Filter pills */}
      <div className="flex items-center gap-1.5">
        {(['all', 'fail', 'warning', 'pass'] as const).map((f) => {
          const active = filter === f
          const label = f === 'all' ? 'All' : f === 'fail' ? 'Failing' : f === 'warning' ? 'Warnings' : 'Passing'
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all',
                active
                  ? 'shadow-sm'
                  : 'hover:bg-paper-2/50',
              )}
              style={active ? {
                background: 'var(--card)',
                color: 'var(--ink)',
                border: '1px solid var(--rule)',
              } : {
                color: 'var(--m-muted)',
                border: '1px solid transparent',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Principle sections */}
      <div className="flex flex-col gap-3">
        {PRINCIPLES.map((p) => {
          const sectionResults = byPrinciple[p.key]
          if (sectionResults.length === 0) return null
          return (
            <PrincipleSection
              key={p.key}
              principle={p}
              results={sectionResults}
              defaultOpen={sectionResults.some((r) => r.status === 'fail' || r.status === 'warning')}
            />
          )
        })}
      </div>
    </div>
  )
}

/* ── Multi-page WCAG overview ─────────────────────────────── */

export interface WcagOverviewProps {
  pages: Array<{
    url: string
    wcag_checklist: string | null
    wcag_score: number | null
  }>
}

/**
 * Overview of WCAG scores across all audited pages.
 * Shows a summary table and allows drilling into per-page checklists.
 */
export function WcagOverview({ pages }: WcagOverviewProps) {
  const pagesWithData = pages.filter((p) => p.wcag_checklist && p.wcag_score !== null)
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)

  if (pagesWithData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <Shield size={28} strokeWidth={1.5} style={{ color: 'var(--m-muted)' }} />
        <p className="text-[13px] font-medium" style={{ color: 'var(--m-muted)' }}>
          No WCAG compliance data available
        </p>
        <p className="text-[11px] max-w-xs" style={{ color: 'var(--m-muted-2)' }}>
          WCAG 2.1 AA conformance checks run during the audit pipeline.
          Re-run the audit to generate compliance data.
        </p>
      </div>
    )
  }

  // Aggregate stats
  const avgScore = Math.round(
    pagesWithData.reduce((sum, p) => sum + (p.wcag_score ?? 0), 0) / pagesWithData.length
  )

  const selectedPage = selectedUrl
    ? pagesWithData.find((p) => p.url === selectedUrl)
    : null

  if (selectedPage) {
    return (
      <div className="flex flex-col gap-4">
        <button
          className="flex items-center gap-1.5 text-[12px] font-medium self-start"
          style={{ color: 'var(--signal)' }}
          onClick={() => setSelectedUrl(null)}
        >
          <ChevronRight size={13} className="rotate-180" />
          Back to overview
        </button>
        <WcagChecklist
          checklistJson={selectedPage.wcag_checklist}
          score={selectedPage.wcag_score}
          pageUrl={selectedPage.url}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Aggregate header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield size={20} strokeWidth={1.75} style={{ color: 'var(--signal)' }} />
          <div>
            <h3 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
              WCAG 2.1 Level AA conformance
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
              {pagesWithData.length} {pagesWithData.length === 1 ? 'page' : 'pages'} tested
            </p>
          </div>
        </div>
        <ScoreBadge score={avgScore} />
      </div>

      {/* Per-page scores */}
      <div className="flex flex-col gap-1.5">
        {pagesWithData.map((page) => {
          const score = page.wcag_score ?? 0
          const scoreColor = score >= 80 ? 'var(--ok)' : score >= 50 ? 'var(--warn)' : 'var(--severe)'
          let path: string
          try {
            path = new URL(page.url).pathname
          } catch {
            path = page.url
          }

          // Parse to get fail count
          let failCount = 0
          try {
            const parsed: WcagCheckResult[] = JSON.parse(page.wcag_checklist || '[]')
            failCount = parsed.filter((r) => r.status === 'fail').length
          } catch { /* ignore */ }

          return (
            <button
              key={page.url}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:shadow-sm transition-all group"
              style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
              onClick={() => setSelectedUrl(page.url)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium truncate" style={{ color: 'var(--ink)' }}>
                  {path === '/' ? 'Homepage' : path}
                </div>
                <div className="text-[11px] truncate" style={{ color: 'var(--m-muted)' }}>
                  {page.url}
                </div>
              </div>

              {failCount > 0 && (
                <span
                  className="text-[11px] font-medium flex items-center gap-1 flex-shrink-0"
                  style={{ color: 'var(--severe)' }}
                >
                  <X size={11} strokeWidth={2.5} />
                  {failCount} {failCount === 1 ? 'failure' : 'failures'}
                </span>
              )}

              <span
                className="text-[13px] font-bold tabular-nums flex-shrink-0"
                style={{ color: scoreColor }}
              >
                {Math.round(score)}%
              </span>

              <ChevronRight
                size={14}
                className="flex-shrink-0 group-hover:translate-x-0.5 transition-transform"
                style={{ color: 'var(--m-muted)' }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
