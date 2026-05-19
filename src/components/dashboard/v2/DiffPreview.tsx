'use client'

import React, { useState } from 'react'
import {
  Check,
  AlertTriangle,
  Pencil,
  X,
  Upload,
  Loader2,
  Shield,
  FilePlus,
  RefreshCw,
  PlusCircle,
} from 'lucide-react'
import type { SurgicalOperation, DiffHunk } from '@/lib/surgical-fix'

interface DiffPreviewProps {
  filePath: string
  operation: SurgicalOperation
  originalContent: string
  patchedContent: string
  changes: DiffHunk[]
  confidence: 'high' | 'medium' | 'low'
  aiExplanation: string
  warning?: string
  onApprove: (finalContent: string) => void
  onCancel: () => void
  deploying: boolean
}

const OP_META: Record<SurgicalOperation, { label: string; icon: React.ReactNode; color: string }> = {
  replace: { label: 'Replace', icon: <RefreshCw size={10} />, color: 'var(--signal)' },
  insert: { label: 'Insert', icon: <PlusCircle size={10} />, color: 'var(--ok)' },
  create: { label: 'New file', icon: <FilePlus size={10} />, color: 'var(--signal)' },
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'var(--ok)',
  medium: 'var(--warn)',
  low: 'var(--warn)',
}

export default function DiffPreview({
  filePath,
  operation,
  originalContent,
  patchedContent,
  changes,
  confidence,
  aiExplanation,
  warning,
  onApprove,
  onCancel,
  deploying,
}: DiffPreviewProps) {
  const [editMode, setEditMode] = useState(false)
  const [editContent, setEditContent] = useState(patchedContent)
  const [inlineEdit, setInlineEdit] = useState(false)
  const [inlinePatch, setInlinePatch] = useState(patchedContent)

  const op = OP_META[operation]
  const confColor = CONFIDENCE_COLORS[confidence]
  const totalRemoved = changes.reduce((s, h) => s + h.linesRemoved.length, 0)
  const totalAdded = changes.reduce((s, h) => s + h.linesAdded.length, 0)

  return (
    <div className="flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <code className="text-[10.5px] px-1.5 py-0.5 rounded" style={{ background: 'var(--card)', color: 'var(--ink)' }}>
          {filePath}
        </code>
        <span
          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded"
          style={{ background: `color-mix(in srgb, ${op.color} 12%, transparent)`, color: op.color }}
        >
          {op.icon} {op.label}
        </span>
        <span
          className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded"
          style={{ background: `color-mix(in srgb, ${confColor} 10%, transparent)`, color: confColor }}
        >
          <Shield size={9} />
          {confidence} confidence
        </span>
        {changes.length > 0 && (
          <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>
            {totalRemoved > 0 && <span style={{ color: 'var(--warn)' }}>-{totalRemoved}</span>}
            {totalRemoved > 0 && totalAdded > 0 && ' / '}
            {totalAdded > 0 && <span style={{ color: 'var(--ok)' }}>+{totalAdded}</span>}
            {' lines'}
          </span>
        )}
      </div>

      {/* AI explanation */}
      {aiExplanation && (
        <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>{aiExplanation}</p>
      )}

      {/* Warning */}
      {warning && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-md text-[11px]"
          style={{
            background: 'color-mix(in srgb, var(--warn) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--warn) 25%, transparent)',
            color: 'var(--warn)',
          }}
        >
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
          <span>{warning}</span>
        </div>
      )}

      {/* Diff view or edit mode */}
      {editMode ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Pencil size={10} style={{ color: 'var(--signal)' }} />
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--m-muted)' }}>
              Manual edit
            </span>
            <button
              onClick={() => { setEditMode(false); setEditContent(patchedContent) }}
              className="ml-auto text-[10px] underline"
              style={{ color: 'var(--m-muted)' }}
            >
              Back to diff
            </button>
          </div>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full font-mono text-[11px] leading-[1.5] rounded-md p-3 resize-y"
            style={{
              background: 'var(--paper-2)',
              border: '1px solid var(--rule)',
              color: 'var(--ink)',
              minHeight: 280,
              maxHeight: 500,
            }}
            spellCheck={false}
          />
        </div>
      ) : changes.length > 0 ? (
        <div
          className="rounded-md overflow-hidden"
          style={{ border: '1px solid var(--rule)' }}
        >
          {/* Side-by-side diff */}
          <div className="grid grid-cols-2" style={{ borderBottom: '1px solid var(--rule)' }}>
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--m-muted)', background: 'var(--paper-2)', borderRight: '1px solid var(--rule)' }}>
              Original
            </div>
            <div className="px-3 py-1.5 flex items-center justify-between" style={{ background: 'var(--paper-2)' }}>
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--m-muted)' }}>
                {inlineEdit ? 'Patched (editing)' : 'Patched'}
              </span>
              <button
                type="button"
                onClick={() => { setInlineEdit((v) => !v); if (!inlineEdit) setInlinePatch(patchedContent); }}
                className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded"
                style={{ color: inlineEdit ? 'var(--signal)' : 'var(--m-muted)', background: inlineEdit ? 'color-mix(in srgb, var(--signal) 10%, transparent)' : 'transparent' }}
              >
                <Pencil size={8} />
                {inlineEdit ? 'Editing' : 'Edit'}
              </button>
            </div>
          </div>
          {inlineEdit ? (
            /* Inline editable patched content */
            <div className="grid grid-cols-2">
              <div className="max-h-[400px] overflow-auto" style={{ borderRight: '1px solid var(--rule)' }}>
                {changes.map((hunk, hi) => (
                  <React.Fragment key={hi}>
                    {hunk.contextBefore.map((line, i) => (
                      <DiffLine key={`ctx-b-${hi}-${i}`} lineNo={hunk.startLineOriginal - hunk.contextBefore.length + i} text={line} type="context" side="left" />
                    ))}
                    {hunk.linesRemoved.map((line, i) => (
                      <DiffLine key={`rem-${hi}-${i}`} lineNo={hunk.startLineOriginal + i} text={line} type="removed" side="left" />
                    ))}
                    {hunk.contextAfter.map((line, i) => (
                      <DiffLine key={`ctx-a-${hi}-${i}`} lineNo={hunk.startLineOriginal + hunk.linesRemoved.length + i} text={line} type="context" side="left" />
                    ))}
                  </React.Fragment>
                ))}
              </div>
              <textarea
                value={inlinePatch}
                onChange={(e) => setInlinePatch(e.target.value)}
                className="w-full font-mono text-[10.5px] leading-[1.6] p-3 resize-y"
                style={{
                  background: 'color-mix(in srgb, var(--ok) 4%, transparent)',
                  color: 'var(--ink)',
                  border: 'none',
                  minHeight: 200,
                  maxHeight: 400,
                  outline: 'none',
                }}
                spellCheck={false}
              />
            </div>
          ) : (
            <div className="max-h-[400px] overflow-auto">
              {changes.map((hunk, hi) => (
                <React.Fragment key={hi}>
                  {hi > 0 && (
                    <div className="grid grid-cols-2 text-center text-[10px] py-1" style={{ color: 'var(--m-muted)', background: 'var(--paper-2)', borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)' }}>
                      <span style={{ borderRight: '1px solid var(--rule)' }}>...</span>
                      <span>...</span>
                    </div>
                  )}
                  {/* Context before */}
                  {hunk.contextBefore.map((line, i) => (
                    <div key={`ctx-b-${hi}-${i}`} className="grid grid-cols-2">
                      <DiffLine lineNo={hunk.startLineOriginal - hunk.contextBefore.length + i} text={line} type="context" side="left" />
                      <DiffLine lineNo={hunk.startLinePatched - hunk.contextBefore.length + i} text={line} type="context" side="right" />
                    </div>
                  ))}
                  {/* Changes */}
                  {renderHunkLines(hunk)}
                  {/* Context after */}
                  {hunk.contextAfter.map((line, i) => (
                    <div key={`ctx-a-${hi}-${i}`} className="grid grid-cols-2">
                      <DiffLine lineNo={hunk.startLineOriginal + hunk.linesRemoved.length + i} text={line} type="context" side="left" />
                      <DiffLine lineNo={hunk.startLinePatched + hunk.linesAdded.length + i} text={line} type="context" side="right" />
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div
          className="px-4 py-6 text-center rounded-md text-[12px]"
          style={{ background: 'var(--paper-2)', color: 'var(--m-muted)', border: '1px solid var(--rule)' }}
        >
          No changes detected. Use the manual editor to apply the fix.
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onApprove(editMode ? editContent : inlineEdit ? inlinePatch : patchedContent)}
          disabled={deploying}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-semibold disabled:opacity-50"
          style={{ background: 'var(--ink)', color: 'var(--paper)' }}
        >
          {deploying ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
          {deploying ? 'Deploying...' : 'Approve and deploy'}
        </button>
        {!editMode && (
          <button
            type="button"
            onClick={() => setEditMode(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11.5px] font-medium"
            style={{ background: 'transparent', border: '1px solid var(--rule)', color: 'var(--ink)' }}
          >
            <Pencil size={10} />
            Edit manually
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={deploying}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11.5px] font-medium disabled:opacity-50"
          style={{ background: 'transparent', border: '1px solid var(--rule)', color: 'var(--m-muted)' }}
        >
          <X size={10} />
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Diff line rendering ─────────────────────────────────────

function DiffLine({ lineNo, text, type, side }: {
  lineNo: number
  text: string
  type: 'context' | 'removed' | 'added' | 'empty'
  side: 'left' | 'right'
}) {
  const bg =
    type === 'removed' ? 'color-mix(in srgb, var(--warn) 8%, transparent)' :
    type === 'added' ? 'color-mix(in srgb, var(--ok) 8%, transparent)' :
    type === 'empty' ? 'var(--paper-2)' :
    'transparent'

  const textColor =
    type === 'removed' ? 'var(--warn)' :
    type === 'added' ? 'var(--ok)' :
    'var(--ink)'

  return (
    <div
      className="flex font-mono text-[10.5px] leading-[1.6] overflow-hidden"
      style={{
        background: bg,
        borderRight: side === 'left' ? '1px solid var(--rule)' : undefined,
      }}
    >
      <span
        className="flex-shrink-0 w-8 text-right px-1 select-none"
        style={{ color: 'var(--m-muted)', background: type !== 'empty' ? 'color-mix(in srgb, var(--ink) 4%, transparent)' : 'var(--paper-2)' }}
      >
        {type !== 'empty' ? lineNo : ''}
      </span>
      <span
        className="flex-shrink-0 w-4 text-center select-none"
        style={{ color: textColor }}
      >
        {type === 'removed' ? '-' : type === 'added' ? '+' : ' '}
      </span>
      <span className="flex-1 px-1 whitespace-pre overflow-x-auto" style={{ color: textColor }}>
        {text}
      </span>
    </div>
  )
}

function renderHunkLines(hunk: DiffHunk) {
  const maxLen = Math.max(hunk.linesRemoved.length, hunk.linesAdded.length)
  const rows = []

  for (let i = 0; i < maxLen; i++) {
    const hasRemoved = i < hunk.linesRemoved.length
    const hasAdded = i < hunk.linesAdded.length

    rows.push(
      <div key={`change-${i}`} className="grid grid-cols-2">
        {hasRemoved ? (
          <DiffLine lineNo={hunk.startLineOriginal + i} text={hunk.linesRemoved[i]} type="removed" side="left" />
        ) : (
          <DiffLine lineNo={0} text="" type="empty" side="left" />
        )}
        {hasAdded ? (
          <DiffLine lineNo={hunk.startLinePatched + i} text={hunk.linesAdded[i]} type="added" side="right" />
        ) : (
          <DiffLine lineNo={0} text="" type="empty" side="right" />
        )}
      </div>,
    )
  }

  return rows
}
