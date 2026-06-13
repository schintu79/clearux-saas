'use client'

/**
 * Audit Trust Layer — Find & Fix confidence/evidence components.
 *
 * This file contains all 11 components defined in the UI component brief:
 *   1. AuditConfidenceStrip   — page-level trust summary row
 *   2. AuditConfidenceCard    — individual card in the strip
 *   3. CategoryTrustMeta      — compact trust metadata on category cards
 *   4. CategoryTrustBadge     — reusable badge primitive
 *   5. FindingEvidenceBadge   — Verified / AI-assessed badge
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
import { ShieldCheck } from 'lucide-react'
import type { AuditFinding, CrawlSummary } from '@/types/database'
import {
  computeAuditTrustSummary,
  computeFindingTrust,
  mapEvidenceType,
  evidenceDisplayLabel,
  mapSourceLabel,
  mapAffectedSurfaces,
  type AuditTrustSummary,
  type EvidenceType,
  type ConfidenceLabel,
  type CoverageLabel,
  type FindingTrustMeta,
} from '@/lib/audit-engine/pipeline/trust-summary'

/* ── Brand Consistency panel (§10) ──────────────────────────────
 * Read-only "Brand Consistency" group for the Find/Fix pages. Renders the
 * grouped brand mismatches from report.raw_json.brandConsistency. These are
 * intentionally NOT audit_findings — the Brand Consistency score is separate
 * and never affects the site health score. Renders nothing when no brand
 * data was checked. */
export interface BrandConsistencyData {
  score: number
  attributesChecked: string[]
  mismatches: Array<{
    attribute: 'color' | 'voice' | 'tone'
    severity: 'high' | 'medium' | 'low'
    title: string
    detail: string
    evidence: string
    trustHarming: boolean
  }>
}

export function BrandConsistencyPanel({ data, className = '' }: { data: BrandConsistencyData | null; className?: string }) {
  if (!data || !Array.isArray(data.attributesChecked) || data.attributesChecked.length === 0) return null

  const sevColor: Record<string, string> = { high: 'var(--severe)', medium: 'var(--warn)', low: 'var(--m-muted)' }
  const checkedLabel = data.attributesChecked
    .map((a) => (a === 'color' ? 'colours' : a === 'voice' ? 'voice & tone' : a))
    .join(' · ')
  const scoreColor = data.score >= 80 ? 'var(--ok)' : data.score >= 60 ? 'var(--warn)' : 'var(--severe)'

  return (
    <div className={`rounded-xl overflow-hidden ${className}`} style={{ border: '1px dashed color-mix(in srgb, var(--ink) 22%, transparent)', background: 'var(--card)' }}>
      <div className="px-4 py-3 flex items-start justify-between gap-3" style={{ borderBottom: data.mismatches.length > 0 ? '1px solid var(--rule)' : undefined }}>
        <div className="flex items-start gap-2.5 min-w-0">
          <ShieldCheck size={16} style={{ color: 'var(--m-muted)' }} className="flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>Brand Consistency</h3>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
              Your live site vs your declared Brand DNA · checked: {checkedLabel} · separate score, does not affect your health score
            </p>
          </div>
        </div>
        <div className="flex items-baseline gap-1 flex-shrink-0">
          <span className="text-[20px] font-bold tabular-nums leading-none" style={{ color: scoreColor }}>{data.score}</span>
          <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>/100</span>
        </div>
      </div>

      {data.mismatches.length === 0 ? (
        <div className="px-4 py-2.5 flex items-center gap-2 text-[12px]" style={{ color: 'var(--ok)' }}>
          <ShieldCheck size={13} />
          <span>On brand — no mismatches found against your declared Brand DNA.</span>
        </div>
      ) : (
        <ul className="divide-y" style={{ borderColor: 'var(--rule)' }}>
          {data.mismatches.map((m, i) => (
            <li key={i} className="px-4 py-3 flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: sevColor[m.severity] || 'var(--m-muted)' }} />
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium leading-tight" style={{ color: 'var(--ink)' }}>{m.title}</p>
                <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--m-muted)' }}>{m.detail}</p>
                <p className="text-[10.5px] mt-1 leading-snug font-mono break-words" style={{ color: 'var(--m-muted)' }}>{m.evidence}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

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

  // 2026-06-13: elevated from a quiet footer row to a labelled trust band —
  // this is the evidence behind every finding and deserves to be seen. The
  // header frames the four cards as "why you can trust this"; the cards
  // themselves are enlarged (see AuditConfidenceCard).
  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck size={15} style={{ color: 'var(--ok)' }} className="flex-shrink-0" />
        <h3 className="text-[12px] font-semibold tracking-[-0.005em]" style={{ color: 'var(--ink)' }}>
          How this audit was verified
        </h3>
        <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
          · coverage, evidence mix, and the independent checks behind every finding
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
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
        subvalue={`${trust.ai_assessed_percent}% AI-assessed${trust.undetermined_percent > 0 ? ` · ${trust.undetermined_percent}% not enough evidence` : ''}`}
        tone={trust.verified_percent >= 50 ? 'good' : trust.verified_percent >= 25 ? 'neutral' : 'warning'}
      />
      <AuditConfidenceCard
        label="Checks run"
        value={trust.checks_run.join(', ')}
        subvalue="Independent checks completed"
        tone="neutral"
      />
      </div>
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
    <div className={`px-3.5 py-3 rounded-lg border bg-white dark:bg-white/[0.04] ${toneColors[tone]}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink/55 mb-1.5">
        {label}
      </div>
      <div className="text-[14px] font-semibold text-ink/90 leading-tight">
        {value}
      </div>
      {subvalue && (
        <div className="text-[11px] text-ink/55 mt-1 leading-tight">
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
      <span className="text-[10px] text-ink/60 font-normal">
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
    <span className="text-[10px] text-ink/60 font-normal px-1.5 py-0.5 rounded bg-ink/[0.03] dark:bg-ink/[0.06]">
      {label}
    </span>
  )
}

/* ── 5. FindingEvidenceBadge ────────────────────────────────── */

interface FindingEvidenceBadgeProps {
  finding: AuditFinding
}

/**
 * Compact pill showing Verified / AI-assessed / Not enough evidence.
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

// 2026-06-12 unified evidence vocabulary: labels come from
// evidenceDisplayLabel() — two tiers (Verified / AI-assessed) plus the
// honesty valve. 'Observed' and 'Heuristic' no longer appear anywhere
// user-facing; the export labels (findings-formatter) use the same words.
function evidenceBadgeStyle(type: EvidenceType): { label: string; className: string } {
  const label = evidenceDisplayLabel(type)
  switch (type) {
    case 'verified':
      return {
        label,
        className: 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400',
      }
    case 'observed':
    case 'heuristic':
      return {
        label,
        className: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
      }
    case 'undetermined':
      return {
        label,
        className: 'bg-ink/5 text-ink/60 dark:bg-ink/10 dark:text-ink/60',
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
    <span className="text-[10px] text-ink/60 font-normal">
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
    <span className="text-[10px] text-ink/60 font-normal">
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

  const screenshot = (finding as { screenshot_url?: string | null }).screenshot_url || null

  if (parts.length === 0 && !screenshot) return null

  // Pill style (2026-06-10): each evidence item sits in its own pill for
  // visibility. Text at ink/70+ for WCAG AA contrast (ink/50 failed ~4:1).
  return (
    <div className="border-t border-ink/10 mt-3 pt-2.5">
      {parts.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] leading-relaxed">
          <span className="font-semibold text-ink/80 mr-1">Evidence</span>
          {parts.map((p) => (
            <span
              key={p.label}
              className="inline-flex items-baseline gap-1 px-2.5 py-1 rounded-full border border-ink/10 bg-ink/[0.04] text-ink/80"
            >
              <span className="font-medium text-ink/60">{p.label}:</span> {p.value}
            </span>
          ))}
        </div>
      )}
      {/* Visual evidence (2026-06-13, Phase 1 item 4): element-highlighted
          screenshot for deterministic findings that carry a selector. */}
      {screenshot && (
        <div className="mt-2.5">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-ink/55 mb-1.5">Visual evidence</span>
          <a href={screenshot} target="_blank" rel="noopener noreferrer" className="inline-block">
            <img
              src={screenshot}
              alt="Visual evidence for this finding"
              loading="lazy"
              className="rounded-lg border border-ink/10 max-h-[160px] w-auto object-contain hover:opacity-90 transition-opacity"
            />
          </a>
        </div>
      )}
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
    high: 'Mostly instrument-verified evidence',
    medium: 'Mixed verified and AI-assessed evidence',
    low: 'Limited coverage or mostly AI-assessed evaluation',
  }[label]

  return (
    <InfoTooltip content={text}>
      <svg className="w-3 h-3 text-ink/50 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
      <svg className="w-3 h-3 text-ink/50 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
