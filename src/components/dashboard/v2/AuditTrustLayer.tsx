'use client'

/**
 * Audit Trust Layer — Find & Fix confidence/evidence components.
 *
 * This file contains all 11 components defined in the UI component brief:
 *   1. AuditConfidenceStrip   — page-level trust summary row
 *   2. AuditConfidenceCard    — individual card in the strip
 *   3. CategoryTrustMeta      — compact trust metadata on category cards
 *   4. CategoryTrustBadge     — reusable badge primitive
 *   5. FindingEvidenceBadge   — verified/observed/heuristic badge
 *   6. FindingSourceLabel     — detection method label
 *   7. FindingSurfaceScope    — desktop/mobile scope indicator
 *   8. FindingEvidencePanel   — expandable proof section
 *   9. EvidenceBulletList     — evidence detail bullets
 *  10. ConfidenceInfoTooltip  — explanation for confidence labels
 *  11. CoverageInfoTooltip    — explanation for coverage labels
 *
 * Design principle: secondary support UI, not the hero of the page.
 * Compact, muted, scan-friendly. No charts, no long explanations.
 */

import React, { useState } from 'react'
import type { AuditFinding, CrawlSummary } from '@/types/database'
import {
  computeAuditTrustSummary,
  computeFindingTrust,
  mapEvidenceType,
  mapSourceLabel,
  mapAffectedSurfaces,
  type AuditTrustSummary,
  type EvidenceType,
  type ConfidenceLabel,
  type CoverageLabel,
  type FindingTrustMeta,
} from '@/lib/audit-engine/pipeline/trust-summary'

/* ── 1. AuditConfidenceStrip ────────────────────────────────── */

interface AuditConfidenceStripProps {
  findings: AuditFinding[]
  crawlSummary: CrawlSummary | null
  className?: string
}

/**
 * Compact page-level trust summary — one horizontal row of 4 cards.
 * Placed below page header, above category grid / findings list.
 */
export function AuditConfidenceStrip({ findings, crawlSummary, className = '' }: AuditConfidenceStripProps) {
  const trust = computeAuditTrustSummary(findings, crawlSummary)

  if (findings.length === 0) return null

  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-2 ${className}`}>
      <AuditConfidenceCard
        label="Crawl coverage"
        value={trust.crawl_coverage_text}
        subvalue={coverageLabelText(trust.crawl_coverage_label)}
        tone={trust.crawl_coverage_label === 'full' ? 'good' : trust.crawl_coverage_label === 'partial' ? 'neutral' : 'warning'}
      />
      <AuditConfidenceCard
        label="Confidence"
        value={confidenceLabelText(trust.confidence_label)}
        subvalue={trust.confidence_text}
        tone={trust.confidence_label === 'high' ? 'good' : trust.confidence_label === 'medium' ? 'neutral' : 'warning'}
      />
      <AuditConfidenceCard
        label="Evidence mix"
        value={`${trust.verified_percent}% verified`}
        subvalue={`${trust.observed_percent}% observed · ${trust.heuristic_percent}% heuristic`}
        tone={trust.verified_percent >= 50 ? 'good' : trust.verified_percent >= 25 ? 'neutral' : 'warning'}
      />
      <AuditConfidenceCard
        label="Checks run"
        value={trust.checks_run.join(', ')}
        subvalue="Independent checks completed"
        tone="neutral"
      />
    </div>
  )
}

/* ── 2. AuditConfidenceCard ─────────────────────────────────── */

interface AuditConfidenceCardProps {
  label: string
  value: string
  subvalue?: string
  tone?: 'neutral' | 'good' | 'warning'
}

function AuditConfidenceCard({ label, value, subvalue, tone = 'neutral' }: AuditConfidenceCardProps) {
  const toneColors = {
    good: 'border-green-200 dark:border-green-900/40',
    neutral: 'border-ink/10 dark:border-ink/10',
    warning: 'border-amber-200 dark:border-amber-900/40',
  }

  return (
    // White card background (2026-06-10): the paper/cream background made the
    // strip blend into the page — white gives the trust data clear separation.
    <div className={`px-3 py-2.5 rounded-lg border bg-white dark:bg-white/[0.04] ${toneColors[tone]}`}>
      <div className="text-[10px] font-medium uppercase tracking-wider text-ink/40 mb-1">
        {label}
      </div>
      <div className="text-[12px] font-medium text-ink/80 leading-tight">
        {value}
      </div>
      {subvalue && (
        <div className="text-[10px] text-ink/40 mt-0.5 leading-tight">
          {subvalue}
        </div>
      )}
    </div>
  )
}

/* ── 3. CategoryTrustMeta ───────────────────────────────────── */

interface CategoryTrustMetaProps {
  findings: AuditFinding[]
  coverageLabel?: CoverageLabel
  compact?: boolean
}

/**
 * Compact trust metadata for a category card header.
 * Shows "Medium confidence · Partial coverage" inline.
 */
export function CategoryTrustMeta({ findings, coverageLabel = 'partial', compact = true }: CategoryTrustMetaProps) {
  if (findings.length === 0) return null

  // Compute category-level confidence from its findings
  const types = findings.map(f => mapEvidenceType(f))
  const verified = types.filter(t => t === 'verified').length
  const observed = types.filter(t => t === 'observed').length
  const total = types.length || 1
  const strongPercent = ((verified + observed) / total) * 100

  let confidence: ConfidenceLabel = 'medium'
  if (strongPercent >= 60 && coverageLabel !== 'limited') confidence = 'high'
  else if (strongPercent < 30 || coverageLabel === 'limited') confidence = 'low'

  if (compact) {
    return (
      <span className="text-[10px] text-ink/35 font-normal">
        {confidenceLabelText(confidence)} · {coverageLabelText(coverageLabel)}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <CategoryTrustBadge kind="confidence" label={confidenceLabelText(confidence)} />
      <CategoryTrustBadge kind="coverage" label={coverageLabelText(coverageLabel)} />
    </div>
  )
}

/* ── 4. CategoryTrustBadge ──────────────────────────────────── */

interface CategoryTrustBadgeProps {
  kind: 'confidence' | 'coverage'
  label: string
}

function CategoryTrustBadge({ label }: CategoryTrustBadgeProps) {
  return (
    <span className="text-[10px] text-ink/40 font-normal px-1.5 py-0.5 rounded bg-ink/[0.03] dark:bg-ink/[0.06]">
      {label}
    </span>
  )
}

/* ── 5. FindingEvidenceBadge ────────────────────────────────── */

interface FindingEvidenceBadgeProps {
  finding: AuditFinding
}

/**
 * Compact pill showing Verified / Observed / Heuristic / Not enough evidence.
 * Place in the finding metadata row next to severity.
 */
export function FindingEvidenceBadge({ finding }: FindingEvidenceBadgeProps) {
  const evidenceType = mapEvidenceType(finding)
  const { label, className } = evidenceBadgeStyle(evidenceType)

  return (
    <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ${className}`}>
      {label}
    </span>
  )
}

/** Raw badge variant that takes a pre-computed evidence type */
export function EvidenceBadge({ type }: { type: EvidenceType }) {
  const { label, className } = evidenceBadgeStyle(type)
  return (
    <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ${className}`}>
      {label}
    </span>
  )
}

function evidenceBadgeStyle(type: EvidenceType): { label: string; className: string } {
  switch (type) {
    case 'verified':
      return {
        label: 'Verified',
        className: 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400',
      }
    case 'observed':
      return {
        label: 'Observed',
        className: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
      }
    case 'heuristic':
      return {
        label: 'Heuristic',
        className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
      }
    case 'undetermined':
      return {
        label: 'Not enough evidence',
        className: 'bg-ink/5 text-ink/40 dark:bg-ink/10 dark:text-ink/50',
      }
  }
}

/* ── 6. FindingSourceLabel ──────────────────────────────────── */

interface FindingSourceLabelProps {
  finding: AuditFinding
}

/**
 * Optional source label: "WCAG checker", "Schema validator", etc.
 * Only renders if the detection source maps to a meaningful label.
 */
export function FindingSourceLabel({ finding }: FindingSourceLabelProps) {
  const label = mapSourceLabel(finding.detection_source)

  // Don't show "AI review" by default — it's the least informative
  if (label === 'AI review') return null

  return (
    <span className="text-[10px] text-ink/35 font-normal">
      {label}
    </span>
  )
}

/* ── 7. FindingSurfaceScope ─────────────────────────────────── */

interface FindingSurfaceScopeProps {
  finding: AuditFinding
}

/**
 * Shows "Mobile", "Desktop", or "Both" based on viewport field.
 * Returns null if scope is not surface-specific.
 */
export function FindingSurfaceScope({ finding }: FindingSurfaceScopeProps) {
  const surfaces = mapAffectedSurfaces(finding.viewport)
  if (!surfaces || surfaces.length === 0) return null

  const label = surfaces.length === 2 ? 'Both' : surfaces[0] === 'mobile' ? 'Mobile' : 'Desktop'

  return (
    <span className="text-[10px] text-ink/35 font-normal">
      {label}
    </span>
  )
}

/* ── 8. FindingEvidencePanel ────────────────────────────────── */

interface FindingEvidencePanelProps {
  finding: AuditFinding
  defaultOpen?: boolean
}

/**
 * Inline evidence metadata row (2026-06-10 — was a collapsible dropdown).
 * One clean row that COMPLETES the info already shown near the finding
 * title: the evidence-type badge (Heuristic/Verified/Observed) is already
 * up there, so this row only adds method, scope, surface, and result.
 * No interaction, no hidden state — clean and simple.
 */
export function FindingEvidencePanel({ finding }: FindingEvidencePanelProps) {
  const trust = computeFindingTrust(finding)

  const parts: Array<{ label: string; value: string }> = []
  // Method — the FindingSourceLabel near the title hides "AI review",
  // so always include the method here.
  if (trust.source_label) parts.push({ label: 'Method', value: trust.source_label })
  if (finding.page_url) parts.push({ label: 'Scope', value: truncateUrl(finding.page_url) })
  if (trust.affected_surfaces && trust.affected_surfaces.length > 0) {
    const surfaceLabel = trust.affected_surfaces.length === 2
      ? 'Desktop and mobile'
      : trust.affected_surfaces[0] === 'mobile' ? 'Mobile only' : 'Desktop only'
    parts.push({ label: 'Surface', value: surfaceLabel })
  }
  if (trust.evidence_summary) parts.push({ label: 'Result', value: truncate(trust.evidence_summary, 90) })
  else if (finding.proposed_value) parts.push({ label: 'Proposed fix', value: truncate(finding.proposed_value, 90) })

  if (parts.length === 0) return null

  return (
    <div className="border-t border-ink/5 mt-3 pt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] leading-relaxed">
      <span className="font-medium text-ink/60">Evidence</span>
      {parts.map((p) => (
        <span key={p.label} className="text-ink/50">
          <span className="text-ink/35">{p.label}:</span> {p.value}
        </span>
      ))}
    </div>
  )
}

/* ── 9. (removed) EvidenceBulletList ─────────────────────────
 * Folded into the inline FindingEvidencePanel row (2026-06-10). */

/* ── 10. ConfidenceInfoTooltip ──────────────────────────────── */

interface InfoTooltipProps {
  children: React.ReactNode
  content: string
}

function InfoTooltip({ children, content }: InfoTooltipProps) {
  const [show, setShow] = useState(false)

  return (
    <span className="relative inline-flex items-center">
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="cursor-help"
      >
        {children}
      </span>
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 text-[10px] text-ink/70 bg-paper border border-ink/10 rounded-md shadow-sm whitespace-nowrap max-w-[220px] whitespace-normal">
          {content}
        </span>
      )}
    </span>
  )
}

export function ConfidenceInfoTooltip({ label }: { label: ConfidenceLabel }) {
  const text = {
    high: 'Mostly verified or directly observed evidence',
    medium: 'Mixed verified and heuristic evidence',
    low: 'Limited coverage or mostly heuristic evaluation',
  }[label]

  return (
    <InfoTooltip content={text}>
      <svg className="w-3 h-3 text-ink/25 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
    </InfoTooltip>
  )
}

/* ── 11. CoverageInfoTooltip ────────────────────────────────── */

export function CoverageInfoTooltip({ label }: { label: CoverageLabel }) {
  const text = {
    full: 'Most priority pages were audited',
    partial: 'Some important sections were audited',
    limited: 'Audit visibility was constrained',
  }[label]

  return (
    <InfoTooltip content={text}>
      <svg className="w-3 h-3 text-ink/25 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
    </InfoTooltip>
  )
}

/* ── Helpers ─────────────────────────────────────────────────── */

function confidenceLabelText(label: ConfidenceLabel): string {
  return { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' }[label]
}

function coverageLabelText(label: CoverageLabel): string {
  return { full: 'Full coverage', partial: 'Partial coverage', limited: 'Limited coverage' }[label]
}

function truncateUrl(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname === '/' ? 'Homepage' : u.pathname
    return path.length > 40 ? path.slice(0, 37) + '...' : path
  } catch {
    return url.length > 40 ? url.slice(0, 37) + '...' : url
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 3) + '...' : text
}
