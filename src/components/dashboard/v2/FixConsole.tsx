'use client';

/**
 * FixConsole — unified Deploy Console for a single finding.
 *
 * Two resolution paths:
 *  1. "Fix it yourself" — Generate Fix → Preview → Approve → Deploy.
 *     Status tracking is fully manual — nothing here auto-changes status.
 *     Every deployed change is reversible (backup + undo).
 *  2. "Let your team handle it" — read-only recommendation + Copy / Download.
 *     Lightweight handoff, no deploy controls.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Copy,
  Check,
  Download,
  Sparkles,
  RotateCcw,
  AlertCircle,
  Loader2,
  HelpCircle,
  Upload,
  X,
  Server,
  Wrench,
  Users,
} from 'lucide-react';
import FixPreviewPanel from './FixPreviewPanel';
import type { AuditFinding } from '@/types/database';
import DiffPreview from './DiffPreview';
import type { SurgicalFixResult } from '@/lib/surgical-fix';

export interface FtpConnectionForDeploy {
  id: string;
  label: string;
  protocol: string;
  host: string;
  remote_path: string;
}

type FixType =
  | 'copy'
  | 'heading'
  | 'meta'
  | 'schema'
  | 'accessibility'
  | 'content'
  | 'technical';


export function inferFixType(finding: AuditFinding): FixType {
  const blob = `${finding.title} ${finding.description} ${finding.recommendation || ''}`.toLowerCase();
  if (/json|schema\.org|ld\+json|structured data|jsonld/.test(blob)) return 'schema';
  if (/meta description|og:|open graph|<meta/.test(blob)) return 'meta';
  if (/heading|h1|h2|h3|title tag/.test(blob)) return 'heading';
  if (/alt text|aria|contrast|wcag|screen reader|accessib/.test(blob)) return 'accessibility';
  if (/faq|paragraph|copy|tagline|wording|message|cta|button text/.test(blob)) return 'copy';
  if (/redirect|sitemap|robots|canonical|performance|cache|lazy/.test(blob)) return 'technical';
  return 'content';
}

function isAiHelperApplicable(fixType: FixType, _recommendation: string): boolean {
  // AI Suggest is strictly for rewriting phrases or headings — nothing else.
  return fixType === 'copy' || fixType === 'heading';
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

/** Map a finding's page_url to a likely server file path. */
function suggestRemotePath(pageUrl: string | null | undefined, remoteRoot: string): string {
  if (!pageUrl) return '';
  let pathname: string;
  try { pathname = new URL(pageUrl).pathname; } catch { return ''; }
  const root = remoteRoot.replace(/\/+$/, '') || '';
  if (/\.\w{2,5}$/.test(pathname)) return `${root}${pathname}`;
  const clean = pathname.replace(/\/+$/, '') || '';
  if (!clean || clean === '/') return `${root}/index.html`;
  return `${root}${clean}/index.html`;
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

/* ── Tab Bar (shared between both panels) ────────────────── */

function TabBar({
  active,
  onSwitch,
}: {
  active: 'self' | 'handoff';
  onSwitch: (tab: 'self' | 'handoff') => void;
}) {
  return (
    <div
      className="flex items-center gap-0"
      style={{ borderBottom: '1px solid var(--rule)' }}
    >
      <button
        type="button"
        onClick={() => onSwitch('self')}
        className="relative px-4 py-2.5 text-[12.5px] font-medium transition-colors"
        style={{
          color: active === 'self' ? 'var(--ink)' : 'var(--m-muted)',
          background: 'transparent',
        }}
      >
        <span className="flex items-center gap-1.5">
          <Wrench size={12} />
          Fix it yourself
        </span>
        {active === 'self' && (
          <span
            className="absolute bottom-0 left-0 right-0 h-[2px]"
            style={{ background: 'var(--ink)' }}
          />
        )}
      </button>
      <button
        type="button"
        onClick={() => onSwitch('handoff')}
        className="relative px-4 py-2.5 text-[12.5px] font-medium transition-colors"
        style={{
          color: active === 'handoff' ? 'var(--ink)' : 'var(--m-muted)',
          background: 'transparent',
        }}
      >
        <span className="flex items-center gap-1.5">
          <Users size={12} />
          Let your team handle it
        </span>
        {active === 'handoff' && (
          <span
            className="absolute bottom-0 left-0 right-0 h-[2px]"
            style={{ background: 'var(--ink)' }}
          />
        )}
      </button>
    </div>
  );
}

/* ── Reversibility Notice ────────────────────────────────── */

function ReversibilityNotice() {
  return (
    <p className="text-[10.5px] flex items-center gap-1.5" style={{ color: 'var(--m-muted)' }}>
      <RotateCcw size={10} />
      Every deployed change is reversible. A backup is captured before each deploy.
    </p>
  );
}

/* ── Handoff Panel (read-only + Copy/Download) ────────────── */

function HandoffPanel({
  finding,
  patch,
  fixType,
}: {
  finding: AuditFinding;
  patch: string;
  fixType: FixType;
}) {
  const [copied, setCopied] = useState(false);
  const isJson = fixType === 'schema' || looksLikeJson(patch);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(patch);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { setCopied(false); }
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

  return (
    <div className="space-y-4 pt-4">
      <p className="text-[12px] leading-[1.6]" style={{ color: 'var(--m-muted)' }}>
        Share the recommended fix below with your developer or content team. Update the status manually once the fix is live.
      </p>

      {/* Read-only recommendation */}
      <div
        className="px-3 py-3 rounded-lg text-[12.5px] leading-[1.65] whitespace-pre-wrap font-mono"
        style={{
          background: 'var(--paper-2)',
          border: '1px solid var(--rule)',
          color: 'var(--ink)',
          minHeight: '80px',
        }}
      >
        {patch || (
          <span style={{ color: 'var(--m-muted)', fontStyle: 'italic' }}>
            No recommendation captured for this finding.
          </span>
        )}
      </div>

      {/* Copy / Download bar */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          disabled={!patch.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-semibold transition-colors disabled:opacity-50"
          style={{
            background: copied ? 'color-mix(in srgb, var(--ok) 12%, transparent)' : 'var(--ink)',
            color: copied ? 'var(--ok)' : 'var(--paper)',
            border: copied ? '1px solid var(--ok)' : '1px solid var(--ink)',
          }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy to clipboard'}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!patch.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-medium transition-colors disabled:opacity-50"
          style={{ background: 'transparent', border: '1px solid var(--rule)', color: 'var(--ink)' }}
        >
          <Download size={11} />
          {isJson ? 'Download .json' : 'Download .md'}
        </button>
      </div>
    </div>
  );
}

/* ── Self-Serve Console (edit + AI + deploy) ──────────────── */

function SelfServeConsole({
  finding,
  ftpConnections = [],
  onStatusChange,
  onPatchChange,
}: {
  finding: AuditFinding;
  ftpConnections?: FtpConnectionForDeploy[];
  onStatusChange?: (status: string) => void;
  onPatchChange?: (patch: string) => void;
}) {
  const initialPatch = (finding.recommendation || '').trim();
  const [patch, setPatch] = useState<string>(initialPatch);

  // Report patch changes to parent for live preview
  useEffect(() => {
    onPatchChange?.(patch);
  }, [patch, onPatchChange]);
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
  const lastPatchRef = useRef<string>(initialPatch);
  const [hasRefined, setHasRefined] = useState(false);

  // Deploy state
  const [deployConnectionId, setDeployConnectionId] = useState<string>(
    ftpConnections.length === 1 ? ftpConnections[0].id : '',
  );
  const [deployPath, setDeployPath] = useState<string>('');
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ ok: boolean; msg: string; deployLogId?: string } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [lastDeployId, setLastDeployId] = useState<string | null>(null);

  // Surgical fix state
  const [surgicalLoading, setSurgicalLoading] = useState(false);
  const [surgicalResult, setSurgicalResult] = useState<SurgicalFixResult | null>(null);
  const [surgicalError, setSurgicalError] = useState<string | null>(null);

  // Load most recent deploy log for this finding (so Undo works across page reloads)
  React.useEffect(() => {
    if (!finding.id || ftpConnections.length === 0) return;
    fetch('/api/ftp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deploy-history', findingId: finding.id, limit: 1 }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.entries?.[0]?.id && data.entries[0].hasBackup) {
          setLastDeployId(data.entries[0].id);
        }
      })
      .catch(() => {});
  }, [finding.id, ftpConnections.length]);

  const selectedConn = useMemo(
    () => ftpConnections.find((c) => c.id === deployConnectionId),
    [ftpConnections, deployConnectionId],
  );

  // Auto-suggest deploy path
  React.useEffect(() => {
    if (deployPath) return;
    const root = selectedConn?.remote_path || '';
    const suggested = suggestRemotePath(finding.page_url, root);
    if (suggested) setDeployPath(suggested);
  }, [selectedConn]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasFtp = ftpConnections.length > 0;
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
    } catch { setCopied(false); }
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
    if (explainText) return;
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
      if (!t) { setExplainError('No guidance returned.'); return; }
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

  const handleSurgicalFix = async () => {
    if (!deployConnectionId || !deployPath.trim() || !patch.trim()) return;
    setSurgicalLoading(true);
    setSurgicalError(null);
    setSurgicalResult(null);
    try {
      const res = await fetch('/api/surgical-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: deployConnectionId,
          filePath: deployPath.trim(),
          recommendation: patch,
          findingId: finding.id,
          findingTitle: finding.title,
          findingDescription: finding.description || '',
          findingCategory: '',
          pageUrl: finding.page_url || null,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setSurgicalError(data?.error || `Surgical fix failed (${res.status}).`);
        return;
      }
      setSurgicalResult(data as SurgicalFixResult);
    } catch (err: any) {
      setSurgicalError(err?.message || 'Network error generating surgical fix.');
    } finally {
      setSurgicalLoading(false);
    }
  };

  const handleSurgicalDeploy = async (finalContent: string) => {
    if (!deployConnectionId || !deployPath.trim()) return;
    setDeploying(true);
    setDeployResult(null);
    try {
      const res = await fetch('/api/ftp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'write',
          connectionId: deployConnectionId,
          filePath: deployPath.trim(),
          content: finalContent,
          auditId: finding.audit_id,
          findingId: finding.id,
          createBackup: true,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setDeployResult({ ok: false, msg: data?.error || `Deploy failed (${res.status}).` });
        return;
      }
      setDeployResult({
        ok: true,
        msg: data?.hadBackup
          ? 'Deployed successfully — backup captured. You can undo this at any time.'
          : 'Deployed successfully.',
        deployLogId: data?.deployLogId,
      });
      if (data?.deployLogId) setLastDeployId(data.deployLogId);
      // Don't clear surgicalResult — the diff preview hides itself via deployResult.ok,
      // and we need to keep surgicalResult truthy so "Generate surgical fix" button stays hidden.
      // Auto-set finding status to "fixed" after successful deploy
      onStatusChange?.('fixed');
    } catch (err: any) {
      setDeployResult({ ok: false, msg: err?.message || 'Network error during deploy.' });
    } finally {
      setDeploying(false);
    }
  };

  const handleRollback = async () => {
    const logId = deployResult?.deployLogId || lastDeployId;
    if (!logId || restoring) return;
    setRestoring(true);
    try {
      const res = await fetch('/api/ftp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore',
          deployLogId: logId,
          connectionId: deployConnectionId,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setDeployResult({ ok: false, msg: data?.error || 'Rollback failed.' });
      } else {
        setDeployResult({ ok: true, msg: 'Original file restored.' });
        setLastDeployId(null);
      }
    } catch (err: any) {
      setDeployResult({ ok: false, msg: err?.message || 'Network error during rollback.' });
    } finally {
      setRestoring(false);
    }
  };

  const canDeploy = hasFtp && deployConnectionId && deployPath.trim() && patch.trim();

  return (
    <section aria-label="Self-serve deploy console" className="text-[12px] space-y-5 pt-4">
      {/* ── Section 1: Review the fix ─────────────────────── */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2.5" style={{ color: 'var(--ink)' }}>
          1. Review the fix
        </p>
        <textarea
          id={`patch-${finding.id}`}
          value={patch}
          onChange={(e) => setPatch(e.target.value)}
          spellCheck
          rows={Math.min(12, Math.max(3, patch.split('\n').length + 1))}
          className="w-full px-3 py-2.5 text-[12.5px] leading-[1.6] outline-none focus-visible:ring-2 focus-visible:ring-signal/30 font-mono"
          style={{
            background: '#ffffff',
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

        {/* Inline action bar: AI suggest, Explain, Copy, Reset */}
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
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
          >
            <HelpCircle size={11} />
            Explain
          </button>

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
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copied' : 'Copy'}
          </button>

          {dirty && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium"
              style={{ background: 'transparent', border: '1px solid var(--rule)', color: 'var(--m-muted)' }}
            >
              <RotateCcw size={11} />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* AI suggest panel */}
      {showAi && aiApplicable && (
        <div
          className="px-3 py-2.5 rounded-md"
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
              style={{ background: '#ffffff', border: '1px solid var(--rule)', color: 'var(--ink)' }}
              aria-label="AI rewrite instruction"
            />
            <button
              type="button"
              onClick={handleAiRefine}
              disabled={aiBusy || !instruction.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-semibold transition-opacity disabled:opacity-50"
              style={{ background: 'var(--ink)', color: 'var(--paper)' }}
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
          className="px-3 py-2.5 rounded-md"
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
              Generating guidance...
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

      {/* ── Section 2: Deploy to server ─────────────────── */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2.5" style={{ color: 'var(--ink)' }}>
          2. Deploy to server
        </p>

        {hasFtp ? (
          <div
            className="px-3 py-3 rounded-lg space-y-2.5"
            style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
          >
            {/* Connection selector */}
            {ftpConnections.length > 1 && (
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--m-muted)' }}>
                  Server
                </label>
                <select
                  value={deployConnectionId}
                  onChange={(e) => {
                    setDeployConnectionId(e.target.value);
                    setDeployPath('');
                  }}
                  className="w-full px-2.5 py-1.5 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-signal/30 rounded-md"
                  style={{ background: '#ffffff', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                >
                  <option value="">Select a target...</option>
                  {ftpConnections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} ({c.protocol.toUpperCase()} · {c.host})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Remote file path */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--m-muted)' }}>
                Remote file path
              </label>
              <input
                type="text"
                value={deployPath}
                onChange={(e) => setDeployPath(e.target.value)}
                placeholder="/path/to/file.html"
                className="w-full px-2.5 py-1.5 text-[12px] font-mono outline-none focus-visible:ring-2 focus-visible:ring-signal/30 rounded-md"
                style={{ background: '#ffffff', border: '1px solid var(--rule)', color: 'var(--ink)' }}
              />
              {finding.page_url && deployPath && (
                <p className="mt-1 text-[10px]" style={{ color: 'var(--signal)' }}>
                  Suggested from crawled page: {finding.page_url}
                </p>
              )}
            </div>

            {/* Deploy result */}
            {deployResult && (
              <div
                className="flex items-start gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md"
                style={{
                  background: deployResult.ok
                    ? 'color-mix(in srgb, var(--ok) 8%, transparent)'
                    : 'color-mix(in srgb, var(--warn) 8%, transparent)',
                  color: deployResult.ok ? 'var(--ok)' : 'var(--warn)',
                }}
              >
                {deployResult.ok ? <Check size={11} className="mt-px flex-shrink-0" /> : <AlertCircle size={11} className="mt-px flex-shrink-0" />}
                <span>{deployResult.msg}</span>
              </div>
            )}

            {/* Surgical fix error */}
            {surgicalError && (
              <div
                className="flex items-start gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md"
                style={{
                  background: 'color-mix(in srgb, var(--warn) 8%, transparent)',
                  color: 'var(--warn)',
                }}
              >
                <AlertCircle size={11} className="mt-px flex-shrink-0" />
                <span>{surgicalError}</span>
              </div>
            )}

            {/* Surgical diff preview */}
            {surgicalResult && !deployResult?.ok && (
              <DiffPreview
                filePath={deployPath.trim()}
                operation={surgicalResult.operation}
                originalContent={surgicalResult.originalContent}
                patchedContent={surgicalResult.patchedContent}
                changes={surgicalResult.changes}
                confidence={surgicalResult.confidence}
                aiExplanation={surgicalResult.aiExplanation}
                warning={surgicalResult.warning}
                onApprove={handleSurgicalDeploy}
                onCancel={() => setSurgicalResult(null)}
                deploying={deploying}
              />
            )}

            {/* Deploy actions — hidden after successful surgical deploy */}
            {!surgicalResult && !deployResult?.ok && (
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={handleSurgicalFix}
                  disabled={surgicalLoading || deploying || restoring || !canDeploy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-[12px] font-semibold disabled:opacity-50 transition-opacity"
                  style={{ background: 'var(--ink)', color: 'var(--paper)' }}
                >
                  {surgicalLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {surgicalLoading ? 'Generating fix...' : 'Generate surgical fix'}
                </button>

                {(lastDeployId || (deployResult?.ok && deployResult.deployLogId)) && (
                  <button
                    type="button"
                    onClick={handleRollback}
                    disabled={restoring}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11.5px] font-semibold disabled:opacity-50"
                    style={{ background: 'transparent', border: '1px solid var(--warn)', color: 'var(--warn)' }}
                  >
                    {restoring ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                    {restoring ? 'Restoring...' : 'Undo deploy'}
                  </button>
                )}

                <ReversibilityNotice />
              </div>
            )}
          </div>
        ) : (
          <div
            className="px-4 py-4 rounded-lg text-center"
            style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
          >
            <Server size={20} style={{ color: 'var(--m-muted)' }} className="mx-auto mb-2" />
            <p className="text-[12px] font-medium mb-1" style={{ color: 'var(--ink)' }}>
              No server connected
            </p>
            <p className="text-[11px] mb-3" style={{ color: 'var(--m-muted)' }}>
              Connect your FTP/SFTP server to deploy fixes directly.
            </p>
            <Link
              href="/dashboard/connect"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold"
              style={{ background: 'var(--ink)', color: 'var(--paper)' }}
            >
              <Server size={11} />
              Connect server
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Main FixConsole Export ────────────────────────────────── */

export default function FixConsole({
  finding,
  pending,
  ftpConnections = [],
  onStatusChange,
}: {
  finding: AuditFinding;
  pending: boolean;
  /** Site-scoped FTP connections — when present, enables inline deploy. */
  ftpConnections?: FtpConnectionForDeploy[];
  /** Called when deploy auto-transitions the finding status (e.g. to 'fixed'). */
  onStatusChange?: (status: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'self' | 'handoff'>('self');
  const fixType = useMemo(() => inferFixType(finding), [finding]);
  const basePatch = (finding.recommendation || '').trim();
  const [livePatch, setLivePatch] = useState(basePatch);

  return (
    <div>
      <TabBar active={activeTab} onSwitch={setActiveTab} />

      {activeTab === 'handoff' ? (
        <HandoffPanel
          finding={finding}
          patch={basePatch}
          fixType={fixType}
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4 items-start">
          <SelfServeConsole
            finding={finding}
            ftpConnections={ftpConnections}
            onStatusChange={onStatusChange}
            onPatchChange={setLivePatch}
          />
          <div className="hidden xl:block sticky top-4">
            <FixPreviewPanel fixType={fixType} finding={finding} patch={livePatch} />
          </div>
        </div>
      )}
    </div>
  );
}
