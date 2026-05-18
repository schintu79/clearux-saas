'use client';

/**
 * FixConsole — practical implementation panel for a single finding.
 *
 * Sits inside the expanded Fix card but reads visually as a separate
 * console layer (distinct header bar, console-tinted surface, clear zones).
 *
 * Zones, top to bottom:
 *  1. Console header — status pill, fix type, lock indicator
 *  2. Prepare fix — editable patch + dirty state
 *  3. AI copy helper — ONLY rendered when the fix is content-like
 *     (the user explicitly asked for this gating; for technical/
 *     performance/config issues a rewrite is not what's needed)
 *  4. Export — copy / download / reset
 *  5. Approve & deploy — push (gated) + mark fixed
 *
 * Safety contract: this component NEVER mutates a live site. The push
 * action stays gated until a deployment target is connected.
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
  Terminal,
  FileEdit,
  PackageCheck,
  Rocket,
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

/**
 * Decide whether the AI copy helper has anything useful to offer here.
 *
 * Strict rule: content-like types always get the helper. Technical /
 * structural fixes only get it if the recommendation actually contains
 * editable user-facing text (heuristic: contains quoted copy or a
 * sentence longer than ~40 chars). This keeps the helper out of the
 * way of pure ops fixes — redirects, caching, lazy-loading, etc. —
 * where a rewrite would be noise.
 */
function isAiHelperApplicable(fixType: FixType, recommendation: string): boolean {
  if (fixType === 'copy' || fixType === 'heading' || fixType === 'meta' || fixType === 'content') {
    return true;
  }
  const rec = recommendation || '';
  // alt text — content if the recommendation suggests writing copy
  if (fixType === 'accessibility') {
    if (/alt text|alt=|aria-label|button text|link text|describe|label/.test(rec.toLowerCase())) return true;
    return false;
  }
  // schema/JSON-LD — content only if there's actual JSON or copy text to refine
  if (fixType === 'schema') {
    if (/"[^"]{20,}"/.test(rec) || /\{[\s\S]*"/.test(rec)) return true;
    return false;
  }
  // technical — only if the recommendation has a long user-facing sentence
  // (heuristic catches copy embedded inside otherwise-technical guidance)
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
    <section
      aria-label="Deploy console"
      className="mx-3 mt-4 mb-4 rounded-xl overflow-hidden"
      style={{
        // Console reads as a distinct surface — slightly darker than the
        // parent card, with a more pronounced border + soft shadow.
        background: 'var(--paper-2)',
        border: '1px solid var(--rule)',
        boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--ink) 3%, transparent)',
      }}
    >
      {/* ── Console header bar ───────────────────────────────────── */}
      <header
        className="px-4 py-2.5 flex items-center gap-3 flex-wrap"
        style={{
          background: 'color-mix(in srgb, var(--ink) 92%, transparent)',
          color: 'var(--paper)',
          borderBottom: '1px solid var(--rule)',
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Terminal size={14} aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] truncate">
            Deploy console
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{
            background: 'color-mix(in srgb, var(--paper) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--paper) 18%, transparent)',
          }}
          title="Inferred from finding category and recommendation"
        >
          {FIX_TYPE_LABEL[fixType]}
        </span>
        {dirty && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{
              background: 'color-mix(in srgb, var(--warn) 28%, transparent)',
              border: '1px solid color-mix(in srgb, var(--warn) 48%, transparent)',
            }}
          >
            <FileEdit size={10} />
            Edited (not saved)
          </span>
        )}
        <span
          className="ml-auto inline-flex items-center gap-1.5 text-[10px]"
          style={{ color: 'color-mix(in srgb, var(--paper) 75%, transparent)' }}
          title="No live changes are made until you explicitly approve and push."
        >
          <Lock size={11} aria-hidden />
          Safe mode · No silent changes
        </span>
      </header>

      {/* ── Safety strip ─────────────────────────────────────────── */}
      <div
        className="px-4 py-2.5 flex items-start gap-2 text-[11px]"
        style={{
          background: 'color-mix(in srgb, var(--signal) 5%, transparent)',
          borderBottom: '1px solid var(--rule)',
          color: 'var(--ink-2)',
        }}
      >
        <ShieldCheck size={12} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--signal)' }} aria-hidden />
        <span>
          Three steps: <strong style={{ color: 'var(--ink)' }}>review &amp; edit</strong> the suggested fix,{' '}
          <strong style={{ color: 'var(--ink)' }}>copy or download</strong> for your team, then{' '}
          <strong style={{ color: 'var(--ink)' }}>approve</strong>. Nothing is pushed to your site without your
          explicit approval.
        </span>
      </div>

      {/* ── Zone 1 · Prepare fix ─────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3" style={{ background: 'var(--card)' }}>
        <ZoneHeader
          step={1}
          icon={FileEdit}
          label="Review & edit the fix"
          hint="This is the recommended snippet — edit anything before you ship it"
        />
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
          placeholder={
            initialPatch
              ? undefined
              : 'No recommendation captured — draft your fix here, or use the AI helper below if available.'
          }
          aria-label="Editable fix text"
        />
      </div>

      {/* ── Zone 2 · AI copy helper (gated) ──────────────────────── */}
      {aiApplicable ? (
        <div
          className="px-4 pt-3 pb-3"
          style={{
            background: 'var(--card)',
            borderTop: '1px solid var(--rule)',
          }}
        >
          <ZoneHeader
            icon={Sparkles}
            label="Refine with AI"
            hint='Ask for a tweak like "make this clearer" or "tighten this"'
            optional
          />
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
                background: 'var(--paper-2)',
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
            <div className="mt-2 flex items-start gap-1.5 text-[11px]" style={{ color: 'var(--warn)' }}>
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
      ) : null}

      {/* ── Zone 3 · Export ──────────────────────────────────────── */}
      <div
        className="px-4 pt-3 pb-3"
        style={{
          background: 'var(--card)',
          borderTop: '1px solid var(--rule)',
        }}
      >
        <ZoneHeader
          step={2}
          icon={PackageCheck}
          label="Copy or download"
          hint="Hand the snippet to whoever ships the change"
        />
        <div className="flex items-center gap-2 flex-wrap">
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
              Reset to original
            </button>
          )}
        </div>
      </div>

      {/* ── Zone 4 · Approve & deploy ────────────────────────────── */}
      <div
        className="px-4 pt-4 pb-4"
        style={{
          background: 'color-mix(in srgb, var(--ink) 4%, transparent)',
          borderTop: '1px solid var(--rule)',
        }}
      >
        <ZoneHeader
          step={3}
          icon={Rocket}
          label="Approve & deploy"
          hint="Mark this fix as shipped, or push it to a connected target"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onApproveLocal}
            disabled={pending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-[12px] font-semibold transition-opacity disabled:opacity-50"
            style={{
              background: 'var(--ok)',
              color: 'var(--paper)',
            }}
            aria-label="Approve fix and mark as fixed"
          >
            <Send size={12} />
            Approve &amp; mark fixed
          </button>
          <button
            type="button"
            onClick={() => setShowPushNotice((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-medium"
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
          <span className="text-[11px] ml-1" style={{ color: 'var(--m-muted)' }}>
            Direct push requires a connected deployment target.
          </span>
        </div>
      </div>

      {showPushNotice && (
        <div
          className="px-4 py-3 text-[12px]"
          style={{
            background: 'color-mix(in srgb, var(--warn) 6%, transparent)',
            borderTop: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)',
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
                Direct push to your site isn&apos;t available yet. Connect WordPress, a CMS, or an FTP target from{' '}
                <strong style={{ color: 'var(--ink)' }}>Connect site</strong> to enable one-click push. Until then,
                use <strong style={{ color: 'var(--ink)' }}>Copy fix</strong> or{' '}
                <strong style={{ color: 'var(--ink)' }}>Download</strong> and hand the snippet to your team — then
                mark this finding as fixed when it&apos;s live.
              </p>
              <p className="mt-1" style={{ color: 'var(--m-muted)' }}>
                We will never change your site without your explicit approval.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Tiny zone heading used inside the console — keeps every zone visually
 * labelled with the same rhythm so the user can scan top-to-bottom.
 */
function ZoneHeader({
  step,
  icon: Icon,
  label,
  hint,
  optional,
}: {
  step?: number;
  icon: React.ElementType;
  label: string;
  hint?: string;
  optional?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 mb-2.5 flex-wrap">
      {typeof step === 'number' ? (
        <span
          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold tabular-nums"
          style={{
            background: 'var(--ink)',
            color: 'var(--paper)',
          }}
          aria-hidden
        >
          {step}
        </span>
      ) : (
        <Icon size={12} style={{ color: 'var(--m-muted)' }} aria-hidden />
      )}
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: 'var(--ink)' }}
      >
        {label}
      </span>
      {optional && (
        <span
          className="text-[9px] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-full"
          style={{
            background: 'var(--paper-2)',
            color: 'var(--m-muted)',
            border: '1px solid var(--rule)',
          }}
        >
          Optional
        </span>
      )}
      {hint && (
        <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
          {hint}
        </span>
      )}
    </div>
  );
}
