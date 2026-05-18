'use client';

/**
 * Fix — Redesigned fix queue with visual clarity.
 *
 * Design principles:
 * - Flat layout, no card-in-card nesting
 * - Module filters as clickable chips (not dropdown)
 * - Compact single-line action bar per finding (copy, download, status, push)
 * - AI suggestion only when it adds value (copy/title changes)
 * - AI helper button for deeper explanation of any issue
 * - Perfect spacing, type hierarchy, and alignment
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowRight,
  Check,
  Copy,
  CheckCircle2,
  Download,
  ExternalLink,
  Search,
  Sparkles,
  X,
  ChevronDown,
  Loader2,
  HelpCircle,
  Upload,
} from 'lucide-react';
import {
  loadLatestAuditBundle,
  severityColor,
  severityLabel,
  moduleNameForFinding,
  fixEffort,
  extractSnippet,
  PHASE1_MODULES,
  type LatestAuditBundle,
} from '@/lib/dashboard/latest-audit';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';
import type { AuditFinding, FindingStatus } from '@/types/database';

/* ── Status config ────────────────────────────────────── */

const STATUS_META: Record<FindingStatus, { label: string; color: string; bg: string }> = {
  open:        { label: 'Open',        color: 'var(--m-muted)', bg: 'var(--paper-2)' },
  in_progress: { label: 'In progress', color: 'var(--warn)',    bg: 'color-mix(in srgb, var(--warn) 10%, transparent)' },
  fixed:       { label: 'Fixed',       color: 'var(--ok)',      bg: 'color-mix(in srgb, var(--ok) 10%, transparent)' },
  backlog:     { label: 'Backlog',     color: 'var(--signal)',  bg: 'color-mix(in srgb, var(--signal) 10%, transparent)' },
};

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'] as const;

/* ── Helpers ──────────────────────────────────────────── */

function fixPriority(f: AuditFinding): number {
  const sevW: Record<string, number> = { critical: 100, high: 80, medium: 50, low: 25 };
  const effortBonus = fixEffort(f) === 'Quick win' ? 20 : fixEffort(f) === 'Standard' ? 0 : -15;
  return (sevW[f.severity] || 0) + effortBonus;
}

/** Returns true if the recommendation contains an AI-suggestible text change (title, copy, heading, meta). */
function hasTextSuggestion(f: AuditFinding): boolean {
  const rec = (f.recommendation || '').toLowerCase();
  const title = (f.title || '').toLowerCase();
  const textSignals = ['change the title', 'update the title', 'rename', 'rewrite', 'rephrase',
    'change the heading', 'update the heading', 'change the copy', 'update the copy',
    'change the text', 'update the text', 'meta description', 'meta title', 'alt text',
    'aria-label', 'button text', 'link text', 'cta text', 'placeholder'];
  return textSignals.some(s => rec.includes(s) || title.includes(s));
}

/* ── AI Helper Panel ─────────────────────────────────── */

function AiHelperPanel({ finding, onClose }: { finding: AuditFinding; onClose: () => void }) {
  // Breaks recommendation into bullet points for clarity
  const bullets = useMemo(() => {
    const rec = finding.recommendation || '';
    // Try to split on numbered items, dashes, or sentences
    const lines = rec.split(/(?:\n|(?<=\.)\s+(?=[A-Z]))/).filter(l => l.trim());
    if (lines.length <= 1) {
      // Fall back to sentence splitting
      return rec.split(/\.\s+/).filter(l => l.trim()).map(l => l.endsWith('.') ? l : l + '.');
    }
    return lines.map(l => l.trim());
  }, [finding.recommendation]);

  return (
    <div
      className="mt-3 rounded-lg px-4 py-3"
      style={{ background: 'color-mix(in srgb, var(--signal) 5%, var(--card))', border: '1px solid color-mix(in srgb, var(--signal) 15%, transparent)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles size={12} style={{ color: 'var(--signal)' }} />
          <span className="text-[11px] font-semibold" style={{ color: 'var(--signal)' }}>How to fix this</span>
        </div>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-paper-2 transition-colors">
          <X size={12} style={{ color: 'var(--m-muted)' }} />
        </button>
      </div>

      {finding.description && (
        <p className="text-[12px] leading-relaxed mb-2.5" style={{ color: 'var(--ink-2)' }}>
          {finding.description}
        </p>
      )}

      <ul className="space-y-1.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2 text-[12px] leading-relaxed" style={{ color: 'var(--ink)' }}>
            <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-semibold mt-0.5" style={{ background: 'var(--paper-2)', color: 'var(--m-muted)' }}>
              {i + 1}
            </span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── AI Suggestion Box (compact, only for text/copy changes) ── */

function AiSuggestionBox({ finding, onCopy }: { finding: AuditFinding; onCopy: (text: string) => void }) {
  const snippet = extractSnippet(finding.recommendation);
  const [copied, setCopied] = useState(false);

  if (!snippet) return null;

  const handleCopy = () => {
    onCopy(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="mt-3 rounded-lg overflow-hidden"
      style={{ border: '1px solid color-mix(in srgb, var(--signal) 20%, transparent)' }}
    >
      <div className="flex items-center justify-between px-3 py-1.5" style={{ background: 'color-mix(in srgb, var(--signal) 8%, transparent)' }}>
        <div className="flex items-center gap-1.5">
          <Sparkles size={10} style={{ color: 'var(--signal)' }} />
          <span className="text-[10px] font-semibold" style={{ color: 'var(--signal)' }}>Suggested change</span>
        </div>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-[10px] font-semibold transition-all"
          style={{ color: copied ? 'var(--ok)' : 'var(--signal)' }}
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        className="text-[11px] leading-relaxed px-3 py-2 overflow-x-auto font-mono"
        style={{ background: 'var(--ink)', color: 'var(--paper)' }}
      >
        <code>{snippet}</code>
      </pre>
    </div>
  );
}

/* ── Fix Row ─────────────────────────────────────────── */

function FixRow({
  finding,
  onStatus,
  pending,
  onCopySnippet,
}: {
  finding: AuditFinding;
  onStatus: (id: string, status: FindingStatus) => void;
  pending: boolean;
  onCopySnippet: (text: string) => void;
}) {
  const [showHelper, setShowHelper] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [copiedRec, setCopiedRec] = useState(false);
  const meta = STATUS_META[finding.status] || STATUS_META.open;
  const snippet = extractSnippet(finding.recommendation);
  const canSuggest = hasTextSuggestion(finding) && snippet;
  const effort = fixEffort(finding);

  const handleCopyRec = () => {
    const text = [finding.title, '', finding.description, '', 'Fix:', finding.recommendation].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedRec(true);
      setTimeout(() => setCopiedRec(false), 2000);
    }).catch(() => {});
  };

  const handleDownload = () => {
    if (!snippet) return;
    const blob = new Blob([snippet], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fix-${finding.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="group"
      style={{ borderBottom: '1px solid var(--rule)' }}
      id={`finding-${finding.id}`}
    >
      {/* ── Main row ── */}
      <div className="px-4 sm:px-5 py-3.5 flex items-start gap-3">
        {/* Severity dot */}
        <span
          className="w-2 h-2 rounded-full mt-[7px] flex-shrink-0"
          style={{ background: severityColor(finding.severity) }}
          aria-hidden
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
            {finding.title}
          </h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px]" style={{ color: 'var(--m-muted)' }}>
            <span className="font-semibold" style={{ color: severityColor(finding.severity) }}>
              {severityLabel(finding.severity)}
            </span>
            <span style={{ color: 'var(--rule)' }}>|</span>
            <span>{moduleNameForFinding(finding)}</span>
            <span style={{ color: 'var(--rule)' }}>|</span>
            <span>{effort}</span>
            {finding.page_url && (
              <>
                <span style={{ color: 'var(--rule)' }}>|</span>
                <a
                  href={finding.page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 hover:underline truncate max-w-[200px]"
                  style={{ color: 'var(--m-muted)' }}
                >
                  {new URL(finding.page_url).pathname || '/'}
                  <ExternalLink size={8} />
                </a>
              </>
            )}
          </div>

          {/* ── Action bar: all controls in one clean line ── */}
          <div className="flex items-center gap-1 mt-2.5 flex-wrap">
            {/* Status */}
            <select
              value={finding.status}
              onChange={(e) => onStatus(finding.id, e.target.value as FindingStatus)}
              disabled={pending}
              className="text-[10px] font-semibold pl-2 pr-5 py-1 rounded-md outline-none cursor-pointer appearance-none"
              style={{
                background: meta.bg,
                color: meta.color,
                border: '1px solid var(--rule)',
                opacity: pending ? 0.6 : 1,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='none' stroke='%23999' stroke-width='1.5'%3E%3Cpath d='M2.5 3.5L5 6l2.5-2.5'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 4px center',
              }}
              aria-label="Change status"
            >
              {(Object.keys(STATUS_META) as FindingStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>

            <div className="w-px h-4 mx-0.5" style={{ background: 'var(--rule)' }} />

            {/* Copy */}
            <button
              onClick={handleCopyRec}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors hover:bg-paper-2"
              style={{ color: copiedRec ? 'var(--ok)' : 'var(--m-muted)' }}
              title="Copy finding details"
            >
              {copiedRec ? <Check size={10} /> : <Copy size={10} />}
              {copiedRec ? 'Copied' : 'Copy'}
            </button>

            {/* Download snippet */}
            {snippet && (
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors hover:bg-paper-2"
                style={{ color: 'var(--m-muted)' }}
                title="Download fix snippet"
              >
                <Download size={10} />
                Download
              </button>
            )}

            {/* AI suggestion toggle (only for text/copy changes) */}
            {canSuggest && (
              <button
                onClick={() => setShowSuggestion(!showSuggestion)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors"
                style={{
                  color: showSuggestion ? 'var(--paper)' : 'var(--signal)',
                  background: showSuggestion ? 'var(--signal)' : 'color-mix(in srgb, var(--signal) 8%, transparent)',
                }}
              >
                <Sparkles size={10} />
                Suggestion
              </button>
            )}

            {/* AI helper — always available */}
            <button
              onClick={() => setShowHelper(!showHelper)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors"
              style={{
                color: showHelper ? 'var(--paper)' : 'var(--m-muted)',
                background: showHelper ? 'var(--ink)' : 'transparent',
              }}
              title="AI explains the issue step by step"
            >
              <HelpCircle size={10} />
              Explain
            </button>

            {/* Push to site */}
            <Link
              href={`/dashboard/deploy?findingId=${finding.id}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors hover:bg-paper-2"
              style={{ color: 'var(--m-muted)' }}
              title="Deploy fix to site"
            >
              <Upload size={10} />
              Push
            </Link>
          </div>
        </div>
      </div>

      {/* ── Expandable panels ── */}
      {showSuggestion && canSuggest && (
        <div className="px-4 sm:px-5 pb-3.5">
          <AiSuggestionBox finding={finding} onCopy={onCopySnippet} />
        </div>
      )}

      {showHelper && (
        <div className="px-4 sm:px-5 pb-3.5">
          <AiHelperPanel finding={finding} onClose={() => setShowHelper(false)} />
        </div>
      )}
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────── */

export default function FixPage() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const [bundle, setBundle] = useState<LatestAuditBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  // Filters
  const [query, setQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [sevFilter, setSevFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (authLoading || !user || !ready) {
      if (!authLoading) setLoading(false);
      return;
    }
    setLoading(true);
    loadLatestAuditBundle(user.id, selection)
      .then(setBundle)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, user, ready, selection]);

  // Auto-expand finding from URL hash
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const scrollTo = () => {
      const h = window.location.hash.replace(/^#finding-/, '');
      if (h) {
        const el = document.getElementById(`finding-${h}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };
    scrollTo();
    window.addEventListener('hashchange', scrollTo);
    return () => window.removeEventListener('hashchange', scrollTo);
  }, [bundle]);

  const queue = useMemo(() => {
    if (!bundle) return [];
    return [...bundle.findings].sort((a, b) => fixPriority(b) - fixPriority(a));
  }, [bundle]);

  // Apply filters
  const filtered = useMemo(() => {
    return queue.filter((f) => {
      if (moduleFilter !== 'all' && moduleNameForFinding(f) !== moduleFilter) return false;
      if (sevFilter !== 'all' && f.severity !== sevFilter) return false;
      if (statusFilter !== 'all' && f.status !== statusFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${f.title} ${f.description} ${f.page_url || ''} ${f.recommendation || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [queue, moduleFilter, sevFilter, statusFilter, query]);

  // Stats
  const stats = useMemo(() => {
    const s: Record<string, number> = { open: 0, in_progress: 0, fixed: 0, backlog: 0 };
    for (const f of queue) s[f.status]++;
    return s;
  }, [queue]);

  // Module counts for filter chips
  const moduleCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of queue) {
      const m = moduleNameForFinding(f);
      c[m] = (c[m] || 0) + 1;
    }
    return c;
  }, [queue]);

  const handleCopySnippet = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  }, []);

  const handleStatus = async (id: string, status: FindingStatus) => {
    setPending((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`/api/findings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok && bundle) {
        setBundle({
          ...bundle,
          findings: bundle.findings.map((f) => f.id === id ? { ...f, status } : f),
        });
      }
    } catch {} finally {
      setPending((p) => ({ ...p, [id]: false }));
    }
  };

  /* ── Loading ── */
  if (authLoading || loading || !ready) {
    return (
      <div>
        <div className="h-7 w-24 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-4 w-72 rounded-md animate-pulse mb-6" style={{ background: 'var(--paper-2)' }} />
        <div className="space-y-0">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-[72px] animate-pulse" style={{ background: 'var(--paper-2)', borderBottom: '1px solid var(--rule)' }} />
          ))}
        </div>
      </div>
    );
  }

  /* ── Empty ── */
  if (!bundle?.audit) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Fix</h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
            {selection ? 'No audit for this brand yet.' : 'Run an audit to populate your fix queue.'}
          </p>
        </div>
        <EmptyAudit
          title="No fixes ready"
          body="Run your first audit and we will surface fixes and snippets you can apply."
        />
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-5">
        <h1 className="text-[20px] font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Fix</h1>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
          {queue.length} findings ordered by impact. {stats.fixed} fixed, {stats.in_progress} in progress.
        </p>
      </div>

      {/* ── Filter bar: search + chips ── */}
      <div className="mb-4">
        {/* Search */}
        <div className="relative mb-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--m-muted)' }} />
          <input
            type="search"
            placeholder="Search findings..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
            style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
            aria-label="Search findings"
          />
        </div>

        {/* Filter chips row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Module chips */}
          <button
            onClick={() => setModuleFilter('all')}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
            style={{
              background: moduleFilter === 'all' ? 'var(--ink)' : 'var(--paper-2)',
              color: moduleFilter === 'all' ? 'var(--paper)' : 'var(--m-muted)',
              border: moduleFilter === 'all' ? '1px solid var(--ink)' : '1px solid var(--rule)',
            }}
          >
            All ({queue.length})
          </button>
          {PHASE1_MODULES.filter(m => moduleCounts[m]).map((m) => (
            <button
              key={m}
              onClick={() => setModuleFilter(moduleFilter === m ? 'all' : m)}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
              style={{
                background: moduleFilter === m ? 'var(--ink)' : 'var(--paper-2)',
                color: moduleFilter === m ? 'var(--paper)' : 'var(--m-muted)',
                border: moduleFilter === m ? '1px solid var(--ink)' : '1px solid var(--rule)',
              }}
            >
              {m} ({moduleCounts[m]})
            </button>
          ))}

          {/* Spacer */}
          <div className="w-px h-4 mx-1" style={{ background: 'var(--rule)' }} />

          {/* Severity chips */}
          {SEVERITY_ORDER.map((s) => {
            const count = queue.filter(f => f.severity === s).length;
            if (!count) return null;
            return (
              <button
                key={s}
                onClick={() => setSevFilter(sevFilter === s ? 'all' : s)}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
                style={{
                  background: sevFilter === s ? severityColor(s) : 'transparent',
                  color: sevFilter === s ? 'white' : severityColor(s),
                  border: `1px solid ${sevFilter === s ? severityColor(s) : 'var(--rule)'}`,
                }}
              >
                {severityLabel(s)} ({count})
              </button>
            );
          })}

          {/* Spacer */}
          <div className="w-px h-4 mx-1" style={{ background: 'var(--rule)' }} />

          {/* Status chips */}
          {(Object.keys(STATUS_META) as FindingStatus[]).map((s) => {
            if (!stats[s]) return null;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
                style={{
                  background: statusFilter === s ? STATUS_META[s].color : 'transparent',
                  color: statusFilter === s ? 'white' : STATUS_META[s].color,
                  border: `1px solid ${statusFilter === s ? STATUS_META[s].color : 'var(--rule)'}`,
                }}
              >
                {STATUS_META[s].label} ({stats[s]})
              </button>
            );
          })}

          {/* Clear all */}
          {(moduleFilter !== 'all' || sevFilter !== 'all' || statusFilter !== 'all' || query) && (
            <button
              onClick={() => { setModuleFilter('all'); setSevFilter('all'); setStatusFilter('all'); setQuery(''); }}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all hover:bg-paper-2"
              style={{ color: 'var(--m-muted)' }}
            >
              <X size={10} className="inline -mt-px mr-0.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Results count ── */}
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
          {filtered.length === queue.length ? `${queue.length} findings` : `${filtered.length} of ${queue.length}`}
        </span>
      </div>

      {/* ── Fix list ── */}
      {filtered.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          {queue.length === 0 ? (
            <>
              <CheckCircle2 size={22} style={{ color: 'var(--ok)' }} className="mx-auto mb-3" />
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>Nothing to fix</p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--m-muted)' }}>
                Re-audit to surface new findings and confirm your fixes landed.
              </p>
              <Link
                href="/dashboard/new-audit"
                className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-[13px] font-semibold"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              >
                Run re-audit <ArrowRight size={12} />
              </Link>
            </>
          ) : (
            <>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>No findings match these filters</p>
              <button
                onClick={() => { setModuleFilter('all'); setSevFilter('all'); setStatusFilter('all'); setQuery(''); }}
                className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-[13px] font-semibold"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          {filtered.map((f) => (
            <FixRow
              key={f.id}
              finding={f}
              onStatus={handleStatus}
              pending={!!pending[f.id]}
              onCopySnippet={handleCopySnippet}
            />
          ))}
        </div>
      )}
    </div>
  );
}
