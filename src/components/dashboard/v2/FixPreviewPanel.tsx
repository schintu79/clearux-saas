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
  }
  patch: string
}

type PreviewMode = 'visual' | 'technical'

const VISUAL_TYPES = new Set(['copy', 'heading', 'content'])

function resolveMode(fixType: FixPreviewPanelProps['fixType']): PreviewMode {
  return VISUAL_TYPES.has(fixType) ? 'visual' : 'technical'
}

function looksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text.trim())
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

/* ── Visual Preview ─────────────────────────────────────────── */

function VisualPreview({ patch, finding }: { patch: string; finding: FixPreviewPanelProps['finding'] }) {
  const isHtml = looksLikeHtml(patch)

  return (
    <div className="flex flex-col gap-2">
      {/* Label */}
      <div className="flex items-center gap-1.5">
        <Eye size={11} style={{ color: 'var(--signal)' }} />
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: 'var(--m-muted)' }}
        >
          Live preview
        </span>
      </div>

      {/* Fake browser chrome */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--rule)' }}
      >
        {/* Title bar */}
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ background: 'var(--paper-2)', borderBottom: '1px solid var(--rule)' }}
        >
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5">
            <span className="block w-[8px] h-[8px] rounded-full" style={{ background: '#ff5f57' }} />
            <span className="block w-[8px] h-[8px] rounded-full" style={{ background: '#febc2e' }} />
            <span className="block w-[8px] h-[8px] rounded-full" style={{ background: '#28c840' }} />
          </div>
          {/* URL bar */}
          <div
            className="flex-1 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono truncate"
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--rule)',
              color: 'var(--m-muted)',
            }}
          >
            <Globe size={9} className="flex-shrink-0" />
            <span className="truncate">{displayUrl(finding.page_url)}</span>
          </div>
        </div>

        {/* Page content area */}
        <div
          className="px-4 py-4 max-h-[280px] overflow-y-auto"
          style={{ background: '#ffffff' }}
        >
          {isHtml ? (
            <div
              className="text-[12px] leading-[1.65] font-sans"
              style={{ color: 'var(--ink)' }}
              dangerouslySetInnerHTML={{ __html: patch }}
            />
          ) : (
            <div className="space-y-2">
              {finding.target_element && (
                <p
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded inline-block mb-1"
                  style={{ background: 'var(--paper-2)', color: 'var(--m-muted)' }}
                >
                  {finding.target_element}
                </p>
              )}
              <p
                className="text-[13px] leading-[1.65] font-sans whitespace-pre-wrap"
                style={{ color: 'var(--ink)' }}
              >
                {patch}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
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
  // Match JSON keys, string values, numbers, booleans, null
  const parts: React.ReactNode[] = []
  let remaining = line
  let key = 0

  while (remaining.length > 0) {
    // Key pattern: "key":
    const keyMatch = remaining.match(/^(\s*)"([^"]+)"(\s*:)/)
    if (keyMatch) {
      parts.push(<span key={key++}>{keyMatch[1]}</span>)
      parts.push(<span key={key++} style={{ color: 'var(--signal)' }}>&quot;{keyMatch[2]}&quot;</span>)
      parts.push(<span key={key++}>{keyMatch[3]}</span>)
      remaining = remaining.slice(keyMatch[0].length)
      continue
    }

    // String value
    const strMatch = remaining.match(/^(\s*)"([^"]*)"/)
    if (strMatch) {
      parts.push(<span key={key++}>{strMatch[1]}</span>)
      parts.push(<span key={key++} style={{ color: 'var(--ok)' }}>&quot;{strMatch[2]}&quot;</span>)
      remaining = remaining.slice(strMatch[0].length)
      continue
    }

    // Number
    const numMatch = remaining.match(/^(\s*)(\d+\.?\d*)/)
    if (numMatch) {
      parts.push(<span key={key++}>{numMatch[1]}</span>)
      parts.push(<span key={key++} style={{ color: 'var(--warn)' }}>{numMatch[2]}</span>)
      remaining = remaining.slice(numMatch[0].length)
      continue
    }

    // Boolean / null
    const boolMatch = remaining.match(/^(\s*)(true|false|null)/)
    if (boolMatch) {
      parts.push(<span key={key++}>{boolMatch[1]}</span>)
      parts.push(<span key={key++} style={{ color: 'var(--warn)' }}>{boolMatch[2]}</span>)
      remaining = remaining.slice(boolMatch[0].length)
      continue
    }

    // Default: consume one character
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
    // Lines that look like action items or recommendations
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

export default function FixPreviewPanel({ fixType, finding, patch }: FixPreviewPanelProps) {
  const mode = resolveMode(fixType)

  // Design fixes have no preview — handled by DesignFixGuidance in FixConsole
  if (fixType === 'design') return null

  if (!patch.trim()) {
    return (
      <div
        className="mt-8 px-4 py-6 rounded-lg text-center text-[12px]"
        style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--m-muted)' }}
      >
        No preview available — generate or enter a fix first.
      </div>
    )
  }

  return (
    <div className="mt-8 max-h-[480px] overflow-y-auto space-y-0">
      {mode === 'visual' ? (
        <VisualPreview patch={patch} finding={finding} />
      ) : fixType === 'meta' ? (
        <MetaPreview patch={patch} finding={finding} />
      ) : fixType === 'schema' ? (
        <SchemaPreview patch={patch} />
      ) : fixType === 'accessibility' ? (
        <AccessibilityPreview finding={finding} />
      ) : (
        <TechnicalPreview finding={finding} patch={patch} />
      )}
    </div>
  )
}
