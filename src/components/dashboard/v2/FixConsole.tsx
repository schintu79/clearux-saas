'use client';

/**
 * FixConsole — flat, single-row action bar for a single finding.
 *
 * Design intent (Fix tab redesign):
 *  - No card-in-card nesting. The console sits flush inside the parent
 *    finding row with light dividers, not its own framed container.
 *  - One horizontal action bar: status pills, Copy, Download, AI suggest,
 *    Explain, Push. Auxiliary panels (AI / Explain) expand inline below.
 *  - AI suggestion is gated to text/copy-style fixes only.
 *  - Explain helper provides step-by-step guidance.
 *  - Push remains explicitly gated: nothing is sent to a live site
 *    without an explicit user approval and a connected target.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  Copy,
  Check,
  Download,
  Sparkles,
  Lock,
  Send,
  RotateCcw,
  AlertCircle,
  Loader2,
  HelpCircle,
  X,
} from 'lucide-react';
import type { AuditFinding, FindingStatus } from '@/types/database';

type FixType =
  | 'copy'
  | 'heading'
  | 'meta'
  | 'schema'
  | 'accessibility'
  | 'content'
  | 'technical';

const STATUS_META: Record<FindingStatus, { label: string; color: string; bg: string; dot: string }> = {
  open:        { label: 'Open',        color: 'var(--m-muted)', bg: 'var(--paper-2)',                                       dot: 'var(--m-muted)' },
  in_progress: { label: 'In Progress', color: 'var(--warn)',    bg: 'color-mix(in srgb, var(--warn) 10%, transparent)',     dot: 'var(--warn)' },
  fixed:       { label: 'Fixed',       color: 'var(--ok)',      bg: 'color-mix(in srgb, var(--ok) 10%, transparent)',       dot: 'var(--ok)' },
  backlog:     { label: 'Backlog',     color: 'var(--signal)',  bg: 'color-mix(in srgb, var(--signal) 10%, transparent)',   dot: 'var(--signal)' },
};
const STATUS_KEYS: FindingStatus[] = ['open', 'in_progress', 'fixed', 'backlog'];

function inferFixType(finding: AuditFinding): FixType {
  const blob = `${finding.title} ${finding.description} ${finding.recommendation || ''}`.toLowerCase();
  if (/json|schema\.org|ld\+json|structured data|jsonld/.test(blob)) return 'schema';
  if (/meta description|og:|open graph|<meta/.test(blob)) return 'meta';
  if (/heading|h1|h2|h3|title tag/.test(blob)) return 'heading';
  if (/alt text|aria|contrast|wcag|screen reader|accessib/.test(blob)) return 'accessibility';
  if (/faq|paragraph|copy|tagline|wording|message|cta|button text/.test(blob)) return 'copy';
  if (/redirect|sitemap|robots|canonical|performance|cache|lazy/.test(blob)) return 'technical';
  return 'content';
}

function isAiHelperApplicable(fixType: FixType, recommendation: string): boolean {
  if (fixType === 'copy' || fixType === 'heading' || fixType === 'meta' || fixType === 'content') return true;
  const rec = recommendation || '';
  if (fixType === 'accessibility') {
    if (/alt text|alt=|aria-label|button text|link text|describe|label/.test(rec.toLowerCase())) return true;
    return false;
  }
  if (fixType === 'schema') {
    if (/"[^"]{20,}"/.test(rec) || /\{[\s\S]*"/.test(rec)) return true;
    return false;
  }
  if (fixType === 'technical') {
    if (/"[^"]{20,}"/.test(rec)) return true;
    if (/(write|rewrite|update|tagline|heading|paragraph|description) /i.test(rec) && rec.length > 80) return true;
    return false;
  }
  return false;
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (!(t.startsWith('{') || t.startsWith('['))) return false;
  try { JSON.parse(t); return true; } catch { return false; }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'fix';
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function FixConsole({
  finding,
  onApproveLocal,
  onStatus,
  pending,
}: {
  finding: AuditFinding;
  /** Called when user clicks "Approve & mark fixed" — wires into existing status flow. */
  onApproveLocal: () => void;
  /** Optional: status pill clicks. When omitted the status row is hidden. */
  onStatus?: (status: FindingStatus) => void;
  pending: boolean;
}) {
  const initialPatch = (finding.recommendation || '').trim();
  const [patch, setPatch] = useState<string>(initialPatch);
  const [copied, setCopied] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [explainBusy, setExplainBusy] = useState(false);
  const [explainText, setExplainText] = useState<string | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [showPushNotice, setShowPushNotice] = useState(false);
  const lastPatchRef = useRef<string>(initialPatch);
  const [hasRefined, setHasRefined] = useState(false);

  const fixType = useMemo(() => inferFixType(finding), [finding]);
  const aiApplicable = useMemo(
    () => isAiHelperApplicable(fixType, finding.recommendation || ''),
    [fixType, finding.recommendation],
  );
  const isJson = useMemo(() => fixType === 'schema' || looksLikeJson(patch), [fixType, patch]);
  const dirty = patch !== initialPatch;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(patch);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleDownload = () => {
    const base = slugify(finding.title);
    if (isJson) {
      downloadFile(`${base}.json`, patch, 'application/json');
      return;
    }
    const md = [
      `# ${finding.title}`,
      '',
      `## Finding`,
      finding.description || '(no description)',
      '',
      `## Recommended fix`,
      patch,
      '',
      `## Business impact`,
      finding.estimated_impact || '(not captured)',
      '',
    ].join('\n');
    downloadFile(`${base}.md`, md, 'text/markdown');
  };

  const handleAiRefine = async () => {
    if (!instruction.trim() || aiBusy) return;
    setAiBusy(true);
    setAiError(null);
    setAiNote(null);
    try {
      const res = await fetch(`/api/findings/${finding.id}/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch, instruction }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setAiError(data?.error || `Could not generate a suggestion (status ${res.status}).`);
        return;
      }
      if (typeof data.suggestion === 'string' && data.suggestion.trim()) {
        lastPatchRef.current = patch;
        setHasRefined(true);
        setPatch(data.suggestion);
        setInstruction('');
        if (data.source === 'fallback') {
          setAiNote(data.note || 'Used a basic local rewrite. Review before approving.');
        }
      } else {
        setAiError('No suggestion returned.');
      }
    } catch {
      setAiError('Network error. Try again.');
    } finally {
      setAiBusy(false);
    }
  };

  const handleExplain = async () => {
    if (explainBusy) return;
    setShowExplain(true);
    if (explainText) return; // already loaded
    setExplainBusy(true);
    setExplainError(null);
    try {
      const res = await fetch(`/api/findings/${finding.id}/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setExplainError(data?.error || `Could not generate guidance (status ${res.status}).`);
        return;
      }
      const t = typeof data.explanation === 'string' ? data.explanation.trim() : '';
      if (!t) {
        setExplainError('No guidance returned.');
        return;
      }
      setExplainText(t);
    } catch {
      setExplainError('Network error. Try again.');
    } finally {
      setExplainBusy(false);
    }
  };

  const handleUndo = () => {
    setPatch(lastPatchRef.current);
    setHasRefined(false);
    setAiNote(null);
  };

  const handleReset = () => {
    setPatch(initialPatch);
    setAiNote(null);
    setAiError(null);
  };

  return (
    <section aria-label="Fix console" className="text-[12px]">
      {/* Editable patch */}
      <textarea
        id={`patch-${finding.id}`}
        value={patch}
        onChange={(e) => setPatch(e.target.value)}
        spellCheck
        rows={Math.min(12, Math.max(3, patch.split('\n').length + 1))}
        className="w-full px-3 py-2.5 text-[12.5px] leading-[1.6] outline-none focus-visible:ring-2 focus-visible:ring-signal/30 font-mono"
        style={{
          background: 'var(--paper-2)',
          border: '1px solid var(--rule)',
          borderRadius: '8px',
          color: 'var(--ink)',
          minHeight: '96px',
          resize: 'vertical',
        }}
        placeholder={
          initialPatch
            ? undefined
            : 'No recommendation captured — draft your fix here, or use the AI helper if available.'
        }
        aria-label="Editable fix text"
      />

      {/* Single-line action bar */}
      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
        {onStatus && (
          <div className="flex items-center gap-1 mr-1" role="group" aria-label="Status">
            {STATUS_KEYS.map((s) => {
              const active = finding.status === s;
              return (
                <button
                  key={s}
                  onClick={() => onStatus(s)}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all disabled:opacity-50"
                  style={
                    active
                      ? { background: STATUS_META[s].bg, color: STATUS_META[s].color, border: `1px solid ${STATUS_META[s].color}` }
                      : { background: 'transparent', color: 'var(--m-muted)', border: '1px solid var(--rule)' }
                  }
                  aria-pressed={active}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? STATUS_META[s].dot : 'var(--rule)' }} aria-hidden />
                  {STATUS_META[s].label}
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={handleCopy}
          disabled={!patch.trim()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-colors disabled:opacity-50"
          style={{
            background: copied ? 'color-mix(in srgb, var(--ok) 12%, transparent)' : 'var(--paper-2)',
            border: '1px solid var(--rule)',
            color: copied ? 'var(--ok)' : 'var(--ink)',
          }}
          aria-label="Copy fix to clipboard"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!patch.trim()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-colors disabled:opacity-50"
          style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
          aria-label={isJson ? 'Download as JSON' : 'Download as Markdown'}
        >
          <Download size={11} />
          {isJson ? '.json' : '.md'}
        </button>

        {aiApplicable && (
          <button
            type="button"
            onClick={() => setShowAi((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-colors"
            style={{
              background: showAi ? 'color-mix(in srgb, var(--signal) 10%, transparent)' : 'var(--paper-2)',
              border: `1px solid ${showAi ? 'var(--signal)' : 'var(--rule)'}`,
              color: showAi ? 'var(--signal)' : 'var(--ink)',
            }}
            aria-expanded={showAi}
            aria-label="Toggle AI suggestion panel"
          >
            <Sparkles size={11} />
            AI suggest
          </button>
        )}

        <button
          type="button"
          onClick={handleExplain}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-colors"
          style={{
            background: showExplain ? 'color-mix(in srgb, var(--signal) 10%, transparent)' : 'var(--paper-2)',
            border: `1px solid ${showExplain ? 'var(--signal)' : 'var(--rule)'}`,
            color: showExplain ? 'var(--signal)' : 'var(--ink)',
          }}
          aria-expanded={showExplain}
          aria-label="Explain this fix step-by-step"
        >
          <HelpCircle size={11} />
          Explain
        </button>

        {dirty && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium"
            style={{ background: 'transparent', border: '1px solid var(--rule)', color: 'var(--m-muted)' }}
            aria-label="Reset to original recommendation"
          >
            <RotateCcw size={11} />
            Reset
          </button>
        )}

        <span className="flex-1" />

        <button
          type="button"
          onClick={() => setShowPushNotice((v) => !v)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium"
          style={{ background: 'transparent', border: '1px dashed var(--rule)', color: 'var(--m-muted)' }}
          aria-expanded={showPushNotice}
          aria-label="Push fix to site (deployment target required)"
        >
          <Lock size={11} />
          Push
        </button>
        <button
          type="button"
          onClick={onApproveLocal}
          disabled={pending}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11.5px] font-semibold transition-opacity disabled:opacity-50"
          style={{ background: 'var(--ok)', color: 'var(--paper)' }}
          aria-label="Approve and mark fixed"
        >
          <Send size={11} />
          Approve
        </button>
      </div>

      {/* Safety / push notice */}
      {showPushNotice && (
        <div
          className="mt-2 px-3 py-2 rounded-md text-[11.5px] flex items-start gap-2"
          style={{
            background: 'color-mix(in srgb, var(--warn) 6%, transparent)',
            border: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)',
            color: 'var(--ink-2)',
          }}
          role="status"
        >
          <Lock size={12} className="mt-px flex-shrink-0" style={{ color: 'var(--warn)' }} />
          <div className="flex-1">
            <p className="font-semibold mb-0.5" style={{ color: 'var(--ink)' }}>Deployment target not connected</p>
            <p style={{ color: 'var(--m-muted)' }}>
              Direct push isn&apos;t available yet. Connect WordPress, a CMS, or an FTP target from{' '}
              <strong style={{ color: 'var(--ink)' }}>Connect site</strong> to enable one-click push. Until then, use{' '}
              <strong style={{ color: 'var(--ink)' }}>Copy</strong> or{' '}
              <strong style={{ color: 'var(--ink)' }}>Download</strong> and hand the snippet to your team — nothing
              is pushed without your explicit approval.
            </p>
          </div>
          <button onClick={() => setShowPushNotice(false)} aria-label="Dismiss notice" className="text-[var(--m-muted)] hover:text-[var(--ink)]">
            <X size={12} />
          </button>
        </div>
      )}

      {/* AI suggest panel */}
      {showAi && aiApplicable && (
        <div
          className="mt-2 px-3 py-2.5 rounded-md"
          style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
        >
          <div className="flex items-stretch gap-2 flex-col sm:flex-row">
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiRefine(); }
              }}
              placeholder='e.g. "tighten this", "make it warmer", "shorten to one sentence"'
              disabled={aiBusy}
              className="flex-1 rounded-md px-2.5 py-1.5 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-signal/30"
              style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
              aria-label="AI rewrite instruction"
            />
            <button
              type="button"
              onClick={handleAiRefine}
              disabled={aiBusy || !instruction.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-semibold transition-opacity disabled:opacity-50"
              style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              aria-label="Generate AI suggestion"
            >
              {aiBusy ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {aiBusy ? 'Thinking...' : patch.trim() ? 'Suggest' : 'Draft'}
            </button>
            {hasRefined && (
              <button
                type="button"
                onClick={handleUndo}
                className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11.5px] font-medium"
                style={{ background: 'transparent', border: '1px solid var(--rule)', color: 'var(--m-muted)' }}
              >
                <RotateCcw size={11} />
                Undo
              </button>
            )}
          </div>
          {aiError && (
            <div className="mt-1.5 flex items-start gap-1.5 text-[11px]" style={{ color: 'var(--warn)' }}>
              <AlertCircle size={11} className="mt-px flex-shrink-0" />
              <span>{aiError}</span>
            </div>
          )}
          {aiNote && (
            <p className="mt-1.5 text-[11px]" style={{ color: 'var(--m-muted)' }}>{aiNote}</p>
          )}
        </div>
      )}

      {/* Explain panel */}
      {showExplain && (
        <div
          className="mt-2 px-3 py-2.5 rounded-md"
          style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <HelpCircle size={12} style={{ color: 'var(--signal)' }} aria-hidden />
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--m-muted)' }}>
              Step-by-step
            </span>
            <button
              onClick={() => setShowExplain(false)}
              className="ml-auto text-[var(--m-muted)] hover:text-[var(--ink)]"
              aria-label="Close explain panel"
            >
              <X size={12} />
            </button>
          </div>
          {explainBusy && (
            <div className="flex items-center gap-1.5 text-[11.5px]" style={{ color: 'var(--m-muted)' }}>
              <Loader2 size={11} className="animate-spin" />
              Generating guidance…
            </div>
          )}
          {explainError && (
            <div className="flex items-start gap-1.5 text-[11.5px]" style={{ color: 'var(--warn)' }}>
              <AlertCircle size={11} className="mt-px flex-shrink-0" />
              <span>{explainError}</span>
            </div>
          )}
          {explainText && !explainBusy && (
            <div className="text-[12.5px] leading-[1.65] whitespace-pre-wrap" style={{ color: 'var(--ink-2)' }}>
              {explainText}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
