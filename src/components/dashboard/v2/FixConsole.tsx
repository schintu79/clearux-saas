'use client';

/**
 * FixConsole — practical implementation panel for a single finding.
 *
 * Sits inside the expanded Fix card. Gives the user:
 *  - an editable patch area seeded from the AI-recommended fix
 *  - copy / download actions
 *  - a small AI helper to refine the fix in-place
 *  - a clearly gated "Approve & push" CTA
 *
 * Safety contract: this component NEVER mutates a live site. The push
 * action is intentionally gated until a deployment target is connected
 * (WordPress / CMS / FTP). All copy in the UI reinforces "you are in
 * control — nothing changes silently".
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  Copy,
  Check,
  Download,
  Sparkles,
  Lock,
  ShieldCheck,
  Send,
  RotateCcw,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { AuditFinding } from '@/types/database';

type FixType =
  | 'copy'
  | 'heading'
  | 'meta'
  | 'schema'
  | 'accessibility'
  | 'content'
  | 'technical';

const FIX_TYPE_LABEL: Record<FixType, string> = {
  copy: 'Copy / Text',
  heading: 'Heading',
  meta: 'Meta description',
  schema: 'Schema / JSON-LD',
  accessibility: 'Accessibility',
  content: 'Content block',
  technical: 'Technical',
};

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

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (!(t.startsWith('{') || t.startsWith('['))) return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
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
  pending,
}: {
  finding: AuditFinding;
  /** Called when user clicks "Mark as Fixed" — wires into existing status flow. */
  onApproveLocal: () => void;
  pending: boolean;
}) {
  const initialPatch = (finding.recommendation || '').trim();
  const [patch, setPatch] = useState<string>(initialPatch);
  const [copied, setCopied] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [showPushNotice, setShowPushNotice] = useState(false);
  // Tracks whether an AI refine has happened in this session so we can show
  // Undo and snap back to the pre-refine patch (even if that was empty).
  const lastPatchRef = useRef<string>(initialPatch);
  const [hasRefined, setHasRefined] = useState(false);

  const fixType = useMemo(() => inferFixType(finding), [finding]);
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
    <div style={{ borderTop: '1px solid var(--rule)', background: 'var(--card)' }}>
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={13} style={{ color: 'var(--signal)' }} />
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: 'var(--m-muted)' }}
          >
            Deploy this fix · Implementation console
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{
            background: 'var(--paper-2)',
            color: 'var(--ink-2)',
            border: '1px solid var(--rule)',
          }}
          title="Inferred from finding category and recommendation"
        >
          {FIX_TYPE_LABEL[fixType]}
        </span>
      </div>

      <div
        className="mx-4 mb-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[11px]"
        style={{
          background: 'color-mix(in srgb, var(--signal) 5%, transparent)',
          border: '1px solid color-mix(in srgb, var(--signal) 25%, transparent)',
          color: 'var(--ink-2)',
        }}
      >
        <ShieldCheck
          size={13}
          className="mt-px flex-shrink-0"
          style={{ color: 'var(--signal)' }}
          aria-hidden
        />
        <span>
          Nothing changes on your site until you approve and push. Edit freely below, ask the AI
          helper for refinements, and copy or download the result for your team.
        </span>
      </div>

      <div className="px-4 pb-3">
        <label
          htmlFor={`patch-${finding.id}`}
          className="block text-[10px] font-semibold uppercase tracking-[0.06em] mb-1.5"
          style={{ color: 'var(--m-muted)' }}
        >
          Editable fix
        </label>
        <textarea
          id={`patch-${finding.id}`}
          value={patch}
          onChange={(e) => setPatch(e.target.value)}
          spellCheck
          rows={Math.min(12, Math.max(4, patch.split('\n').length + 1))}
          className="w-full rounded-lg px-3 py-2.5 text-[13px] leading-[1.6] outline-none focus-visible:ring-2 focus-visible:ring-signal/40 font-mono"
          style={{
            background: 'var(--paper-2)',
            border: '1px solid var(--rule)',
            color: 'var(--ink)',
            minHeight: '110px',
            resize: 'vertical',
          }}
          aria-label="Editable fix text"
        />
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!patch.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors disabled:opacity-50"
            style={{
              background: copied ? 'color-mix(in srgb, var(--ok) 12%, transparent)' : 'var(--paper-2)',
              border: '1px solid var(--rule)',
              color: copied ? 'var(--ok)' : 'var(--ink)',
            }}
            aria-label="Copy fix to clipboard"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy fix'}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!patch.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors disabled:opacity-50"
            style={{
              background: 'var(--paper-2)',
              border: '1px solid var(--rule)',
              color: 'var(--ink)',
            }}
            aria-label={isJson ? 'Download fix as JSON' : 'Download fix as Markdown'}
          >
            <Download size={12} />
            Download {isJson ? '.json' : '.md'}
          </button>
          {dirty && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors"
              style={{
                background: 'transparent',
                border: '1px solid var(--rule)',
                color: 'var(--m-muted)',
              }}
              aria-label="Reset to original recommendation"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          )}
          <span
            className="ml-auto text-[11px]"
            style={{ color: dirty ? 'var(--warn)' : 'var(--m-muted)' }}
          >
            {dirty ? 'Edited (not saved)' : 'Unchanged'}
          </span>
        </div>
      </div>

      <div
        className="mx-4 mb-4 rounded-lg p-3"
        style={{
          background: 'var(--paper-2)',
          border: '1px solid var(--rule)',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={12} style={{ color: 'var(--signal)' }} />
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: 'var(--m-muted)' }}
          >
            AI copy helper
          </p>
        </div>
        <p className="text-[11px] mb-2" style={{ color: 'var(--m-muted)' }}>
          Ask for a refinement — e.g. &ldquo;make the title clearer&rdquo;, &ldquo;tighten this meta
          description&rdquo;, &ldquo;make this more brand aligned&rdquo;. If the fix above is empty,
          the helper will draft one from the finding. The suggestion replaces the fix; you can undo or edit.
        </p>
        <div className="flex items-stretch gap-2 flex-col sm:flex-row">
          <input
            type="text"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAiRefine();
              }
            }}
            placeholder="Describe how to refine the fix..."
            disabled={aiBusy}
            className="flex-1 rounded-md px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--rule)',
              color: 'var(--ink)',
            }}
            aria-label="AI rewrite instruction"
          />
          <button
            type="button"
            onClick={handleAiRefine}
            disabled={aiBusy || !instruction.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-[12px] font-semibold transition-opacity disabled:opacity-50"
            style={{
              background: 'var(--ink)',
              color: 'var(--paper)',
            }}
            aria-label="Generate AI suggestion"
          >
            {aiBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {aiBusy ? 'Thinking...' : patch.trim() ? 'Suggest' : 'Draft fix'}
          </button>
          {hasRefined && (
            <button
              type="button"
              onClick={handleUndo}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-medium"
              style={{
                background: 'transparent',
                border: '1px solid var(--rule)',
                color: 'var(--m-muted)',
              }}
            >
              <RotateCcw size={12} />
              Undo
            </button>
          )}
        </div>
        {aiError && (
          <div
            className="mt-2 flex items-start gap-1.5 text-[11px]"
            style={{ color: 'var(--warn)' }}
          >
            <AlertCircle size={11} className="mt-px flex-shrink-0" />
            <span>{aiError}</span>
          </div>
        )}
        {aiNote && (
          <p className="mt-2 text-[11px]" style={{ color: 'var(--m-muted)' }}>
            {aiNote}
          </p>
        )}
      </div>

      <div
        className="px-4 py-3 flex items-center gap-3 flex-wrap"
        style={{
          background: 'var(--paper-2)',
          borderTop: '1px solid var(--rule)',
        }}
      >
        <div className="flex-1 min-w-[200px]">
          <p className="text-[11px] font-semibold" style={{ color: 'var(--ink)' }}>
            Ready to ship this fix?
          </p>
          <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
            Copy or download the snippet for your team, or mark it fixed once it&apos;s live.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowPushNotice((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium"
          style={{
            background: 'transparent',
            border: '1px dashed var(--rule)',
            color: 'var(--m-muted)',
            cursor: 'pointer',
          }}
          aria-expanded={showPushNotice}
          aria-label="Push fix to site (deployment target required)"
        >
          <Lock size={12} />
          Push to site
        </button>
        <button
          type="button"
          onClick={onApproveLocal}
          disabled={pending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-opacity disabled:opacity-50"
          style={{
            background: 'var(--ok)',
            color: 'var(--paper)',
          }}
          aria-label="Approve fix and mark as fixed"
        >
          <Send size={12} />
          Approve &amp; mark fixed
        </button>
      </div>

      {showPushNotice && (
        <div
          className="mx-4 mb-4 rounded-lg px-3 py-3 text-[12px]"
          style={{
            background: 'color-mix(in srgb, var(--warn) 6%, transparent)',
            border: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)',
            color: 'var(--ink-2)',
          }}
          role="status"
        >
          <div className="flex items-start gap-2">
            <Lock size={13} className="mt-px flex-shrink-0" style={{ color: 'var(--warn)' }} />
            <div>
              <p className="font-semibold mb-1" style={{ color: 'var(--ink)' }}>
                Deployment target not connected
              </p>
              <p style={{ color: 'var(--m-muted)' }}>
                Direct push to your site isn&apos;t available yet. Connect WordPress, a CMS, or a
                deployment target to enable one-click push. Until then, use{' '}
                <strong style={{ color: 'var(--ink)' }}>Copy fix</strong> or{' '}
                <strong style={{ color: 'var(--ink)' }}>Download</strong> and hand the snippet to
                your team — then mark this finding as fixed when it&apos;s live.
              </p>
              <p className="mt-1" style={{ color: 'var(--m-muted)' }}>
                We will never change your site without your explicit approval.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
