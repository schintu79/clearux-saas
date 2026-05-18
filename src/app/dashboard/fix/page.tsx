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

function severityCardBg(sev: string): string {
  switch (sev) {
    case 'critical': return 'color-mix(in srgb, var(--severe) 4%, #ffffff)';
    case 'high':     return 'color-mix(in srgb, var(--warn) 4%, #ffffff)';
    case 'medium':   return 'color-mix(in srgb, var(--signal) 4%, #ffffff)';
    case 'low':      return 'color-mix(in srgb, var(--ok) 4%, #ffffff)';
    default:         return '#ffffff';
  }
}

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
  onDismiss,
  pending,
  onCopySnippet,
}: {
  finding: AuditFinding;
  onStatus: (id: string, status: FindingStatus) => void;
  onDismiss: (id: string, reason: string) => void;
  pending: boolean;
  onCopySnippet: (text: string) => void;
}) {
  const [showHelper, setShowHelper] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [showDismiss, setShowDismiss] = useState(false);
  const [dismissReason, setDismissReason] = useState('');
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

  const handleDismiss = () => {
    if (!dismissReason.trim()) return;
    onDismiss(finding.id, dismissReason.trim());
    setShowDismiss(false);
    setDismissReason('');
  };

  // If dismissed, show compact row
  if (finding.dismissed) {
    return (
      <div
        className="px-4 sm:px-5 py-2.5 flex items-center gap-3 opacity-50"
        style={{ borderBottom: '1px solid var(--rule)' }}
        id={`finding-${finding.id}`}
      >
        <span className="text-[12px] line-through flex-1 truncate" style={{ color: 'var(--m-muted)' }}>{finding.title}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--paper-2)', color: 'var(--m-muted)' }}>Dismissed</span>
      </div>
    );
  }

  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="group"
      style={{ borderBottom: '1px solid var(--rule)' }}
      id={`finding-${finding.id}`}
    >
      {/* ── Title header — severity-colored background ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left px-4 sm:px-5 flex items-start gap-3 cursor-pointer"
        style={{ paddingTop: '1rem', paddingBottom: '1rem', background: severityCardBg(finding.severity), borderLeft: `3px solid ${severityColor(finding.severity)}` }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[13px] font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
              {finding.title}
            </h3>
            <ChevronDown
              size={14}
              className="flex-shrink-0 mt-0.5 transition-transform"
              style={{ color: 'var(--m-muted)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]" style={{ color: 'var(--m-muted)', marginTop: '0.6rem' }}>
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
                <span
                  className="inline-flex items-center gap-0.5 truncate max-w-[200px]"
                  style={{ color: 'var(--m-muted)' }}
                >
                  {(() => { try { return new URL(finding.page_url).pathname || '/'; } catch { return finding.page_url; } })()}
                  <ExternalLink size={8} />
                </span>
              </>
            )}
          </div>
        </div>
      </button>

      {/* ── Expanded content — white background ── */}
      {isOpen && (
        <div className="px-4 sm:px-5 pb-4" style={{ background: '#ffffff' }}>
          {/* What we found + Why it matters side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {finding.description && (
              <div className="rounded-lg p-3.5" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                <span className="text-[9px] font-bold uppercase tracking-[0.08em] block mb-1.5" style={{ color: 'var(--m-muted)' }}>What we found</span>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink)' }}>{finding.description}</p>
              </div>
            )}
            {finding.estimated_impact && (
              <div className="rounded-lg p-3.5" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                <span className="text-[9px] font-bold uppercase tracking-[0.08em] block mb-1.5" style={{ color: 'var(--m-muted)' }}>Why it matters</span>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink)' }}>{finding.estimated_impact}</p>
              </div>
            )}
          </div>

          {/* Recommended fix */}
          {finding.recommendation && (
            <div className="mt-3 rounded-lg p-3.5" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
              <span className="text-[9px] font-bold uppercase tracking-[0.08em] block mb-1.5" style={{ color: 'var(--m-muted)' }}>Recommended fix</span>
              <pre
                className="text-[12px] leading-relaxed whitespace-pre-wrap font-body"
                style={{ color: 'var(--ink)' }}
              >{finding.recommendation}</pre>
            </div>
          )}

          {/* ── Action bar ── */}
          <div className="flex items-center gap-1 mt-3 flex-wrap">
            {/* Status dropdown */}
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
                .md
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
                AI suggest
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

            {/* Approve (mark as fixed) */}
            {finding.status !== 'fixed' && (
              <button
                onClick={() => onStatus(finding.id, 'fixed')}
                disabled={pending}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors"
                style={{ background: 'color-mix(in srgb, var(--ok) 10%, transparent)', color: 'var(--ok)', border: '1px solid color-mix(in srgb, var(--ok) 20%, transparent)' }}
              >
                <CheckCircle2 size={10} />
                Approve
              </button>
            )}

            <div className="flex-1" />

            {/* Dismiss */}
            <button
              onClick={() => setShowDismiss(!showDismiss)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors hover:bg-paper-2"
              style={{ color: showDismiss ? 'var(--severe)' : 'var(--m-muted)' }}
              title="Dismiss this finding with a reason"
            >
              <X size={10} />
              Dismiss
            </button>
          </div>

          {/* Dismiss reason input */}
          {showDismiss && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDismiss()}
                placeholder="Why are you dismissing this?"
                className="flex-1 px-3 py-1.5 rounded-md text-[12px] outline-none"
                style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                autoFocus
              />
              <button
                onClick={handleDismiss}
                disabled={!dismissReason.trim() || pending}
                className="px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all"
                style={{
                  background: dismissReason.trim() ? 'var(--severe)' : 'var(--paper-2)',
                  color: dismissReason.trim() ? 'white' : 'var(--m-muted)',
                  opacity: pending ? 0.6 : 1,
                }}
              >
                Confirm
              </button>
              <button
                onClick={() => { setShowDismiss(false); setDismissReason(''); }}
                className="p-1.5 rounded-md hover:bg-paper-2 transition-colors"
                style={{ color: 'var(--m-muted)' }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* ── Expandable panels ── */}
          {showSuggestion && canSuggest && (
            <div className="mt-3">
              <AiSuggestionBox finding={finding} onCopy={onCopySnippet} />
            </div>
          )}

          {showHelper && (
            <div className="mt-3">
              <AiHelperPanel finding={finding} onClose={() => setShowHelper(false)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Filter Dropdown ─────────────────────────────────── */

function FilterDropdown({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: { value: string; label: string }[];
}) {
  const isActive = value !== 'all';
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-[12px] font-medium pl-3 pr-7 py-2 rounded-lg outline-none cursor-pointer appearance-none"
      style={{
        background: isActive ? 'var(--ink)' : 'var(--card)',
        color: isActive ? 'var(--paper)' : 'var(--ink)',
        border: `1px solid ${isActive ? 'var(--ink)' : 'var(--rule)'}`,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='${isActive ? '%23fff' : '%23999'}' stroke-width='1.5'%3E%3Cpath d='M3 4.5L6 7.5l3-3'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 6px center',
      }}
      aria-label={label}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
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

  const handleDismiss = async (id: string, reason: string) => {
    setPending((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`/api/findings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismiss: true, dismissal_reason: reason }),
      });
      if (res.ok && bundle) {
        setBundle({
          ...bundle,
          findings: bundle.findings.map((f) => f.id === id ? { ...f, dismissed: true, dismissal_reason: reason } : f),
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

      {/* ── Filter bar: search + 3 dropdowns ── */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
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

        {/* Status dropdown */}
        <FilterDropdown
          value={statusFilter}
          onChange={setStatusFilter}
          label="Status"
          options={[
            { value: 'all', label: `All (${queue.length})` },
            ...(Object.keys(STATUS_META) as FindingStatus[]).map(s => ({
              value: s,
              label: `${STATUS_META[s].label} (${stats[s] || 0})`,
            })),
          ]}
        />

        {/* Severity dropdown */}
        <FilterDropdown
          value={sevFilter}
          onChange={setSevFilter}
          label="Severity"
          options={[
            { value: 'all', label: 'All severities' },
            ...SEVERITY_ORDER.map(s => ({
              value: s,
              label: `${severityLabel(s)} (${queue.filter(f => f.severity === s).length})`,
            })),
          ]}
        />

        {/* Module dropdown */}
        <FilterDropdown
          value={moduleFilter}
          onChange={setModuleFilter}
          label="Module"
          options={[
            { value: 'all', label: 'All modules' },
            ...PHASE1_MODULES.filter(m => moduleCounts[m]).map(m => ({
              value: m,
              label: `${m} (${moduleCounts[m]})`,
            })),
          ]}
        />

        {/* Clear */}
        {(moduleFilter !== 'all' || sevFilter !== 'all' || statusFilter !== 'all' || query) && (
          <button
            onClick={() => { setModuleFilter('all'); setSevFilter('all'); setStatusFilter('all'); setQuery(''); }}
            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-[11px] font-medium transition-all hover:bg-paper-2"
            style={{ color: 'var(--m-muted)' }}
          >
            <X size={10} /> Clear
          </button>
        )}
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
              onDismiss={handleDismiss}
              pending={!!pending[f.id]}
              onCopySnippet={handleCopySnippet}
            />
          ))}
        </div>
      )}
    </div>
  );
}
