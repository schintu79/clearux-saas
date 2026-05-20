'use client'

import React, { useMemo } from 'react'
import {
  Eye,
  Globe,
  Code,
  Shield,
  Search,
  Share2,
  Bot,
  Check,
  X,
  FileCode,
  Tag,
  ArrowRight,
  TrendingUp,
  Zap,
} from 'lucide-react'

/* ── Types ──────────────────────────────────────────────────── */

interface FixPreviewPanelProps {
  fixType: 'copy' | 'heading' | 'meta' | 'schema' | 'accessibility' | 'content' | 'technical' | 'design'
  finding: {
    title: string
    description: string
    recommendation: string
    page_url?: string | null
    target_element?: string | null
    evidence?: string | null
  }
  patch: string
}

function displayUrl(url: string | null | undefined): string {
  if (!url) return 'example.com'
  try {
    const u = new URL(url)
    return `${u.host}${u.pathname}`
  } catch {
    return url
  }
}

/* ── Impact Preview (copy / heading / content) ─────────────── */

/**
 * For visual fix types, show a "Current vs Proposed" comparison
 * instead of a fake browser chrome mockup.
 */
function ImpactPreview({ patch, finding }: { patch: string; finding: FixPreviewPanelProps['finding'] }) {
  const currentValue = finding.target_element || finding.evidence || null
  const hasComparison = currentValue && patch.trim()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <Eye size={11} style={{ color: 'var(--signal)' }} />
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: 'var(--m-muted)' }}
        >
          {hasComparison ? 'Current vs proposed' : 'Impact preview'}
        </span>
      </div>

      {hasComparison ? (
        <div className="space-y-2">
          {/* Current */}
          <div
            className="rounded-md px-3 py-2.5"
            style={{ background: 'color-mix(in srgb, var(--severe) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--severe) 15%, transparent)' }}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <X size={10} style={{ color: 'var(--severe)' }} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--severe)' }}>
                Current
              </span>
            </div>
            <p
              className="text-[12px] leading-[1.55] whitespace-pre-wrap"
              style={{ color: 'var(--ink-2)' }}
            >
              {(currentValue || '').length > 300 ? currentValue!.slice(0, 300) + '...' : currentValue}
            </p>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowRight size={14} style={{ color: 'var(--m-muted)', transform: 'rotate(90deg)' }} />
          </div>

          {/* Proposed */}
          <div
            className="rounded-md px-3 py-2.5"
            style={{ background: 'color-mix(in srgb, var(--ok) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--ok) 15%, transparent)' }}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <Check size={10} style={{ color: 'var(--ok)' }} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--ok)' }}>
                Proposed
              </span>
            </div>
            <p
              className="text-[12px] leading-[1.55] whitespace-pre-wrap"
              style={{ color: 'var(--ink)' }}
            >
              {patch.length > 300 ? patch.slice(0, 300) + '...' : patch}
            </p>
          </div>
        </div>
      ) : (
        /* No current value available — show readability impact instead */
        <ReadabilityView patch={patch} finding={finding} />
      )}
    </div>
  )
}

/* ── Readability View (fallback for content without current value) ── */

function ReadabilityView({ patch, finding }: { patch: string; finding: FixPreviewPanelProps['finding'] }) {
  const wordCount = patch.trim().split(/\s+/).filter(Boolean).length
  const sentenceCount = patch.split(/[.!?]+/).filter((s) => s.trim().length > 3).length
  const avgWordsPerSentence = sentenceCount > 0 ? Math.round(wordCount / sentenceCount) : 0
  const readabilityScore = avgWordsPerSentence <= 15 ? 'Good' : avgWordsPerSentence <= 22 ? 'Moderate' : 'Complex'
  const readabilityColor = readabilityScore === 'Good' ? 'var(--ok)' : readabilityScore === 'Moderate' ? 'var(--warn)' : 'var(--severe)'

  return (
    <PreviewCard icon={<TrendingUp size={11} />} label="Readability analysis">
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <p className="text-[16px] font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>{wordCount}</p>
            <p className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--m-muted)' }}>Words</p>
          </div>
          <div className="text-center">
            <p className="text-[16px] font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>{sentenceCount}</p>
            <p className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--m-muted)' }}>Sentences</p>
          </div>
          <div className="text-center">
            <p className="text-[16px] font-semibold tabular-nums" style={{ color: readabilityColor }}>{avgWordsPerSentence}</p>
            <p className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--m-muted)' }}>Avg words/sent</p>
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-medium"
          style={{ background: `color-mix(in srgb, ${readabilityColor} 8%, transparent)`, color: readabilityColor }}
        >
          <Zap size={10} />
          {readabilityScore} readability
        </div>
      </div>
    </PreviewCard>
  )
}

/* ── Meta Preview ───────────────────────────────────────────── */

function extractMetaFields(patch: string): { title: string; description: string; ogImage?: string } {
  const titleMatch = patch.match(/(?:title["\s:=>]+)([^"<\n]{3,120})/i)
  const descMatch = patch.match(/(?:description["\s:=>]+)([^"<\n]{3,300})/i)
  const ogMatch = patch.match(/(?:og:image["\s:=>]+)(https?:\/\/[^\s"<]+)/i)

  return {
    title: titleMatch?.[1]?.trim() || patch.split('\n')[0]?.slice(0, 60) || 'Page Title',
    description: descMatch?.[1]?.trim() || patch.split('\n').slice(1).join(' ').slice(0, 160) || 'Page description will appear here.',
    ogImage: ogMatch?.[1]?.trim(),
  }
}

function MetaPreview({ patch, finding }: { patch: string; finding: FixPreviewPanelProps['finding'] }) {
  const meta = useMemo(() => extractMetaFields(patch), [patch])
  const siteUrl = displayUrl(finding.page_url)

  return (
    <div className="flex flex-col gap-3">
      {/* Search preview */}
      <PreviewCard icon={<Search size={11} />} label="Search preview">
        <div className="space-y-1">
          <p className="text-[10px] font-mono truncate" style={{ color: 'var(--m-muted)' }}>
            {siteUrl}
          </p>
          <p
            className="text-[13px] font-medium leading-snug"
            style={{ color: 'var(--signal)' }}
          >
            {meta.title}
          </p>
          <p className="text-[11px] leading-[1.5]" style={{ color: 'var(--m-muted)' }}>
            {meta.description}
          </p>
        </div>
      </PreviewCard>

      {/* Social preview */}
      <PreviewCard icon={<Share2 size={11} />} label="Social preview">
        <div
          className="rounded-md overflow-hidden"
          style={{ border: '1px solid var(--rule)' }}
        >
          {meta.ogImage && (
            <div
              className="h-[80px] bg-cover bg-center"
              style={{
                backgroundImage: `url(${meta.ogImage})`,
                background: meta.ogImage ? undefined : 'var(--paper-2)',
              }}
            />
          )}
          <div className="px-3 py-2" style={{ background: 'var(--paper-2)' }}>
            <p className="text-[10px] uppercase tracking-[0.04em]" style={{ color: 'var(--m-muted)' }}>
              {siteUrl}
            </p>
            <p className="text-[12px] font-semibold leading-snug mt-0.5" style={{ color: 'var(--ink)' }}>
              {meta.title}
            </p>
            <p className="text-[10.5px] leading-[1.4] mt-0.5" style={{ color: 'var(--m-muted)' }}>
              {meta.description.slice(0, 100)}{meta.description.length > 100 ? '...' : ''}
            </p>
          </div>
        </div>
      </PreviewCard>

      {/* AI preview */}
      <PreviewCard icon={<Bot size={11} />} label="AI assistant preview">
        <div className="space-y-1">
          <p className="text-[11px] leading-[1.55]" style={{ color: 'var(--ink)' }}>
            An AI assistant reading this page would interpret it as:
          </p>
          <div
            className="px-2.5 py-2 rounded-md text-[11px] leading-[1.55] font-mono"
            style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
          >
            <span style={{ color: 'var(--m-muted)' }}>Title:</span> {meta.title}
            <br />
            <span style={{ color: 'var(--m-muted)' }}>Description:</span> {meta.description}
          </div>
        </div>
      </PreviewCard>
    </div>
  )
}

/* ── Schema Preview ─────────────────────────────────────────── */

function extractSchemaType(patch: string): string | null {
  const match = patch.match(/"@type"\s*:\s*"([^"]+)"/)
  return match?.[1] || null
}

function formatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

function SchemaPreview({ patch }: { patch: string }) {
  const schemaType = useMemo(() => extractSchemaType(patch), [patch])
  const formatted = useMemo(() => formatJson(patch), [patch])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Code size={11} style={{ color: 'var(--signal)' }} />
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: 'var(--m-muted)' }}
          >
            Structured data
          </span>
        </div>
        {schemaType && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{
              background: 'color-mix(in srgb, var(--signal) 10%, transparent)',
              color: 'var(--signal)',
            }}
          >
            <Tag size={8} />
            {schemaType}
          </span>
        )}
      </div>

      <div
        className="rounded-md overflow-hidden max-h-[320px] overflow-y-auto"
        style={{ border: '1px solid var(--rule)' }}
      >
        <pre
          className="px-3 py-3 text-[11px] leading-[1.55] font-mono whitespace-pre overflow-x-auto"
          style={{ background: 'var(--paper-2)', color: 'var(--ink)', margin: 0 }}
        >
          <JsonHighlighted code={formatted} />
        </pre>
      </div>
    </div>
  )
}

/** Minimal JSON syntax highlighting using inline styles */
function JsonHighlighted({ code }: { code: string }) {
  const lines = code.split('\n')

  return (
    <>
      {lines.map((line, i) => (
        <div key={i}>
          {highlightJsonLine(line)}
        </div>
      ))}
    </>
  )
}

function highlightJsonLine(line: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let remaining = line
  let key = 0

  while (remaining.length > 0) {
    const keyMatch = remaining.match(/^(\s*)"([^"]+)"(\s*:)/)
    if (keyMatch) {
      parts.push(<span key={key++}>{keyMatch[1]}</span>)
      parts.push(<span key={key++} style={{ color: 'var(--signal)' }}>&quot;{keyMatch[2]}&quot;</span>)
      parts.push(<span key={key++}>{keyMatch[3]}</span>)
      remaining = remaining.slice(keyMatch[0].length)
      continue
    }

    const strMatch = remaining.match(/^(\s*)"([^"]*)"/)
    if (strMatch) {
      parts.push(<span key={key++}>{strMatch[1]}</span>)
      parts.push(<span key={key++} style={{ color: 'var(--ok)' }}>&quot;{strMatch[2]}&quot;</span>)
      remaining = remaining.slice(strMatch[0].length)
      continue
    }

    const numMatch = remaining.match(/^(\s*)(\d+\.?\d*)/)
    if (numMatch) {
      parts.push(<span key={key++}>{numMatch[1]}</span>)
      parts.push(<span key={key++} style={{ color: 'var(--warn)' }}>{numMatch[2]}</span>)
      remaining = remaining.slice(numMatch[0].length)
      continue
    }

    const boolMatch = remaining.match(/^(\s*)(true|false|null)/)
    if (boolMatch) {
      parts.push(<span key={key++}>{boolMatch[1]}</span>)
      parts.push(<span key={key++} style={{ color: 'var(--warn)' }}>{boolMatch[2]}</span>)
      remaining = remaining.slice(boolMatch[0].length)
      continue
    }

    parts.push(<span key={key++}>{remaining[0]}</span>)
    remaining = remaining.slice(1)
  }

  return <>{parts}</>
}

/* ── Accessibility Preview ──────────────────────────────────── */

function parseChecklistItems(recommendation: string): Array<{ label: string; pass: boolean }> {
  const lines = recommendation.split(/[\n.;]/).map((l) => l.trim()).filter(Boolean)
  const items: Array<{ label: string; pass: boolean }> = []

  for (const line of lines) {
    if (line.length < 5 || line.length > 200) continue
    const isNegative = /missing|lacks|no |without|absent|incorrect|invalid|doesn't|does not|should/i.test(line)
    items.push({
      label: line.replace(/^[-*]\s*/, ''),
      pass: !isNegative,
    })
    if (items.length >= 8) break
  }

  return items.length > 0
    ? items
    : [{ label: recommendation.slice(0, 120), pass: false }]
}

function AccessibilityPreview({ finding }: { finding: FixPreviewPanelProps['finding'] }) {
  const items = useMemo(() => parseChecklistItems(finding.recommendation), [finding.recommendation])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Shield size={11} style={{ color: 'var(--signal)' }} />
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: 'var(--m-muted)' }}
        >
          Accessibility checklist
        </span>
      </div>

      <div
        className="rounded-md overflow-hidden"
        style={{ border: '1px solid var(--rule)' }}
      >
        <ul className="divide-y" style={{ borderColor: 'var(--rule)' }}>
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2 px-3 py-2 text-[11px] leading-[1.5]"
              style={{ background: i % 2 === 0 ? 'transparent' : 'var(--paper-2)' }}
            >
              <span className="flex-shrink-0 mt-0.5">
                {item.pass ? (
                  <Check size={11} style={{ color: 'var(--ok)' }} />
                ) : (
                  <X size={11} style={{ color: 'var(--warn)' }} />
                )}
              </span>
              <span style={{ color: 'var(--ink)' }}>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ── Technical Preview ──────────────────────────────────────── */

function TechnicalPreview({ finding, patch }: { finding: FixPreviewPanelProps['finding']; patch: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <FileCode size={11} style={{ color: 'var(--signal)' }} />
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: 'var(--m-muted)' }}
        >
          Technical change
        </span>
      </div>

      <div
        className="rounded-md px-3 py-3 space-y-2"
        style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
      >
        <p className="text-[11px] font-semibold" style={{ color: 'var(--ink)' }}>
          {finding.title}
        </p>
        <p className="text-[11px] leading-[1.55]" style={{ color: 'var(--m-muted)' }}>
          {finding.description}
        </p>

        {/* Recommendation / patch content */}
        <div
          className="rounded-md px-2.5 py-2 text-[11px] leading-[1.55] font-mono whitespace-pre-wrap"
          style={{
            background: 'var(--paper)',
            border: '1px solid var(--rule)',
            color: 'var(--ink)',
          }}
        >
          {patch}
        </div>

        {finding.page_url && (
          <p className="text-[10px] flex items-center gap-1" style={{ color: 'var(--m-muted)' }}>
            <Globe size={9} />
            {finding.page_url}
          </p>
        )}
      </div>
    </div>
  )
}

/* ── Shared PreviewCard wrapper ─────────────────────────────── */

function PreviewCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-md px-3 py-2.5"
      style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span style={{ color: 'var(--signal)' }}>{icon}</span>
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: 'var(--m-muted)' }}
        >
          {label}
        </span>
      </div>
      {children}
    </div>
  )
}

/* ── Main Export ─────────────────────────────────────────────── */

/**
 * Adaptive understanding panel — replaces the old fake "live preview".
 *
 * Renders different views based on fix type:
 *  - copy/heading/content → Current vs Proposed comparison (or readability view)
 *  - meta → Search / Social / AI assistant preview
 *  - schema → Syntax-highlighted JSON with type badge
 *  - accessibility → WCAG checklist
 *  - technical → Technical change detail
 *  - design → null (handled by DesignFixGuidance in FixConsole)
 */
export default function FixPreviewPanel({ fixType, finding, patch }: FixPreviewPanelProps) {
  // Design fixes have no preview — handled by DesignFixGuidance in FixConsole
  if (fixType === 'design') return null

  if (!patch.trim()) return null

  // Every fix type now gets a meaningful, non-fake preview
  const isVisual = fixType === 'copy' || fixType === 'heading' || fixType === 'content'

  return (
    <div className="mt-8 max-h-[480px] overflow-y-auto space-y-0">
      {isVisual ? (
        <ImpactPreview patch={patch} finding={finding} />
      ) : fixType === 'meta' ? (
        <MetaPreview patch={patch} finding={finding} />
      ) : fixType === 'schema' ? (
        <SchemaPreview patch={patch} />
      ) : fixType === 'accessibility' ? (
        <AccessibilityPreview finding={finding} />
      ) : fixType === 'technical' ? (
        <TechnicalPreview finding={finding} patch={patch} />
      ) : null}
    </div>
  )
}
