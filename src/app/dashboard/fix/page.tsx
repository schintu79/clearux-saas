'use client';

/**
 * Fix — selected brand only. Prioritised fix queue with clear status
 * controls. The recommendation + copy-paste snippet are hidden behind
 * an explicit "Show fix" toggle so the queue stays scannable.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowRight,
  Check,
  Copy,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import {
  loadLatestAuditBundle,
  severityColor,
  severityLabel,
  moduleNameForFinding,
  fixEffort,
  extractSnippet,
  type LatestAuditBundle,
} from '@/lib/dashboard/latest-audit';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';
import type { AuditFinding, FindingStatus } from '@/types/database';

const STATUS_META: Record<FindingStatus, { label: string; color: string; bg: string }> = {
  open:        { label: 'Open',        color: 'var(--m-muted)', bg: 'var(--paper-2)' },
  in_progress: { label: 'In progress', color: 'var(--warn)',    bg: 'color-mix(in srgb, var(--warn) 10%, transparent)' },
  fixed:       { label: 'Fixed',       color: 'var(--ok)',      bg: 'color-mix(in srgb, var(--ok) 10%, transparent)' },
  backlog:     { label: 'Backlog',     color: 'var(--signal)',  bg: 'color-mix(in srgb, var(--signal) 10%, transparent)' },
};

function fixPriority(f: AuditFinding): number {
  const sevW = { critical: 100, high: 80, medium: 50, low: 25 } as Record<string, number>;
  const effortBonus = fixEffort(f) === 'Quick win' ? 20 : fixEffort(f) === 'Standard' ? 0 : -15;
  return (sevW[f.severity] || 0) + effortBonus;
}

function FixCard({
  finding,
  expanded,
  onToggle,
  copied,
  onCopy,
  onStatus,
  pending,
}: {
  finding: AuditFinding;
  expanded: boolean;
  onToggle: (id: string) => void;
  copied: boolean;
  onCopy: (id: string, text: string) => void;
  onStatus: (id: string, status: FindingStatus) => void;
  pending: boolean;
}) {
  const snippet = extractSnippet(finding.recommendation);
  const meta = STATUS_META[finding.status] || STATUS_META.open;

  return (
    <li id={`finding-${finding.id}`}>
      <article
        className="rounded-xl"
        style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        data-testid="fix-card"
      >
        <div className="p-4 flex items-start gap-3">
          <span
            className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
            style={{ background: severityColor(finding.severity) }}
            aria-hidden
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
              {finding.title}
            </h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px]" style={{ color: 'var(--m-muted)' }}>
              <span className="font-semibold" style={{ color: severityColor(finding.severity) }}>
                {severityLabel(finding.severity)}
              </span>
              <span>{moduleNameForFinding(finding)}</span>
              <span>{fixEffort(finding)}</span>
              {finding.page_url && (
                <a
                  href={finding.page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 hover:underline truncate max-w-[260px]"
                >
                  {finding.page_url}
                  <ExternalLink size={9} />
                </a>
              )}
            </div>
          </div>

          <select
            value={finding.status}
            onChange={(e) => onStatus(finding.id, e.target.value as FindingStatus)}
            disabled={pending}
            className="text-[11px] font-semibold px-2 py-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
            style={{ background: meta.bg, color: meta.color, border: '1px solid var(--rule)', opacity: pending ? 0.6 : 1 }}
            aria-label="Change status"
          >
            {(Object.keys(STATUS_META) as FindingStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>

          <button
            onClick={() => onToggle(finding.id)}
            className="ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all"
            style={{ color: 'var(--ink)', border: '1px solid var(--rule)' }}
            aria-expanded={expanded}
            aria-controls={`fix-body-${finding.id}`}
          >
            {expanded ? 'Hide' : 'Show fix'}
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </div>

        {expanded && (
          <div
            id={`fix-body-${finding.id}`}
            className="px-4 pb-4 pt-1"
            style={{ borderTop: '1px solid var(--rule)' }}
          >
            <p className="text-[12px] mb-3 mt-3 leading-relaxed" style={{ color: 'var(--ink-2)' }}>
              {finding.description}
            </p>

            <p className="text-[10px] font-semibold tracking-[0.06em] uppercase mb-1.5" style={{ color: 'var(--m-muted)' }}>
              Fix this
            </p>
            <p className="text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ink)' }}>
              {finding.recommendation || 'Manual review required — open the audit detail for full context.'}
            </p>

            {snippet && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-semibold tracking-[0.06em] uppercase" style={{ color: 'var(--m-muted)' }}>
                    Snippet
                  </p>
                  <button
                    onClick={() => onCopy(finding.id, snippet)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold transition-all"
                    style={{ color: copied ? 'var(--ok)' : 'var(--signal)' }}
                    aria-live="polite"
                  >
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre
                  className="text-[11px] leading-relaxed overflow-x-auto px-3 py-2.5 rounded-md font-mono"
                  style={{ background: 'var(--ink)', color: 'var(--paper)' }}
                >
                  <code>{snippet}</code>
                </pre>
              </div>
            )}
          </div>
        )}
      </article>
    </li>
  );
}

export default function FixPage() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const [bundle, setBundle] = useState<LatestAuditBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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

  // Auto-expand the finding referenced by URL hash so the legacy
  // /dashboard/fix#finding-<id> deep link still surfaces the body.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const apply = () => {
      const h = window.location.hash.replace(/^#finding-/, '');
      if (h) setExpanded((e) => ({ ...e, [h]: true }));
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [bundle]);

  const queue = useMemo(() => {
    if (!bundle) return [];
    return [...bundle.findings].sort((a, b) => fixPriority(b) - fixPriority(a));
  }, [bundle]);

  const stats = useMemo(() => {
    const s = { open: 0, in_progress: 0, fixed: 0, backlog: 0 };
    for (const f of queue) s[f.status]++;
    return s;
  }, [queue]);

  const handleCopy = (id: string, text: string) => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      });
    } catch {}
  };

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

  const toggleExpand = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  if (authLoading || loading || !ready) {
    return (
      <div>
        <div className="h-8 w-32 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-5 w-80 rounded-md animate-pulse mb-8" style={{ background: 'var(--paper-2)' }} />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-[72px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
      </div>
    );
  }

  if (!bundle?.audit) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Fix</h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
            {selection ? 'No audit for this brand yet.' : 'Run an audit to populate your fix queue.'}
          </p>
        </div>
        <EmptyAudit
          title="No fixes ready"
          body="Run your first audit and Fixpath will surface fixes and snippets you can apply."
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Fix</h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
          Your fix queue, ordered by impact and effort.
        </p>
      </div>

      {/* Status summary */}
      <div
        className="rounded-xl px-4 py-3 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3"
        style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      >
        {(Object.keys(STATUS_META) as FindingStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: STATUS_META[s].color }} aria-hidden />
            <span className="text-[12px]" style={{ color: 'var(--m-muted)' }}>{STATUS_META[s].label}</span>
            <span className="text-[12px] font-semibold tabular-nums ml-auto" style={{ color: 'var(--ink)' }}>{stats[s]}</span>
          </div>
        ))}
      </div>

      {queue.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
          data-testid="fix-empty"
        >
          <CheckCircle2 size={24} style={{ color: 'var(--ok)' }} className="mx-auto mb-3" />
          <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
            Nothing to fix right now
          </p>
          <p className="text-[12px] mt-1.5" style={{ color: 'var(--m-muted)' }}>
            Re-audit to surface new findings and confirm your fixes landed.
          </p>
          <Link
            href="/dashboard/new-audit"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-[13px] font-semibold"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            Run re-audit
            <ArrowRight size={12} />
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {queue.map((f) => (
            <FixCard
              key={f.id}
              finding={f}
              expanded={!!expanded[f.id]}
              onToggle={toggleExpand}
              copied={copiedId === f.id}
              onCopy={handleCopy}
              onStatus={handleStatus}
              pending={!!pending[f.id]}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
