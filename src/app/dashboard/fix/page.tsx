'use client';

/**
 * Fix — answers "What can I fix right now?"
 *
 * Queue of fixable findings prioritised by quick-wins + severity. Each card
 * exposes the exact recommended fix (with copy-paste snippet when available
 * or manual steps), status, and a "coming later" hint for WordPress / FTP
 * automation (Phase 2 — not implemented here per the bible).
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowRight,
  Check,
  Copy,
  CheckCircle2,
  Clock,
  ListChecks,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import {
  loadLatestAuditBundle,
  rankFindings,
  severityColor,
  severityLabel,
  moduleNameForFinding,
  fixEffort,
  extractSnippet,
  type LatestAuditBundle,
} from '@/lib/dashboard/latest-audit';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';
import type { AuditFinding, FindingStatus } from '@/types/database';

const STATUS_META: Record<FindingStatus, { label: string; color: string; bg: string }> = {
  open:        { label: 'Not started', color: 'var(--m-muted)', bg: 'var(--paper-2)' },
  in_progress: { label: 'In progress', color: 'var(--warn)',    bg: 'color-mix(in srgb, var(--warn) 10%, transparent)' },
  fixed:       { label: 'Fixed',       color: 'var(--ok)',      bg: 'color-mix(in srgb, var(--ok) 10%, transparent)' },
  backlog:     { label: 'Backlog',     color: 'var(--signal)',  bg: 'color-mix(in srgb, var(--signal) 10%, transparent)' },
};

/** Score: quick wins on top, then severity, then sort_order. */
function fixPriority(f: AuditFinding): number {
  const sevW = { critical: 100, high: 80, medium: 50, low: 25 } as Record<string, number>;
  const effortBonus = fixEffort(f) === 'Quick win' ? 20 : fixEffort(f) === 'Standard' ? 0 : -15;
  return (sevW[f.severity] || 0) + effortBonus;
}

function FixCard({
  finding,
  copied,
  onCopy,
  onStatus,
  pending,
}: {
  finding: AuditFinding;
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
        className="rounded-xl p-5"
        style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        data-testid="fix-card"
      >
        <div className="flex items-start gap-3 mb-3">
          <span
            className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
            style={{ background: severityColor(finding.severity) }}
            aria-hidden
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
              {finding.title}
            </h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px]" style={{ color: 'var(--m-muted)' }}>
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
          <span
            className="text-[10px] font-semibold tracking-[0.04em] uppercase px-2 py-1 rounded-md flex-shrink-0"
            style={{ color: meta.color, background: meta.bg }}
          >
            {meta.label}
          </span>
        </div>

        <p className="text-[12px] mb-3 leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          {finding.description}
        </p>

        {/* Recommended fix */}
        <div
          className="rounded-lg p-3 mb-3"
          style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
        >
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
                  Copy-paste snippet
                </p>
                <button
                  onClick={() => onCopy(finding.id, snippet)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold transition-all"
                  style={{ color: copied ? 'var(--ok)' : 'var(--signal)' }}
                  aria-live="polite"
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? 'Copied' : 'Copy snippet'}
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
          {!snippet && (
            <p className="text-[11px] mt-2 italic" style={{ color: 'var(--m-muted)' }}>
              No code snippet for this finding — follow the steps above.
            </p>
          )}
        </div>

        {/* Status actions */}
        <div className="flex flex-wrap items-center gap-2">
          {(['open', 'in_progress', 'fixed', 'backlog'] as FindingStatus[]).map((s) => {
            const active = finding.status === s;
            return (
              <button
                key={s}
                onClick={() => onStatus(finding.id, s)}
                disabled={pending}
                className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all"
                style={{
                  background: active ? STATUS_META[s].bg : 'transparent',
                  color: active ? STATUS_META[s].color : 'var(--m-muted)',
                  border: '1px solid var(--rule)',
                  opacity: pending ? 0.6 : 1,
                }}
                aria-pressed={active}
              >
                {STATUS_META[s].label}
              </button>
            );
          })}
          {snippet && finding.status === 'open' && (
            <button
              onClick={() => { onCopy(finding.id, snippet); onStatus(finding.id, 'in_progress'); }}
              disabled={pending}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all hover:opacity-90"
              style={{ background: 'var(--ink)', color: 'var(--paper)', opacity: pending ? 0.6 : 1 }}
            >
              Copy fix &amp; mark in progress
              <ArrowRight size={11} />
            </button>
          )}
        </div>
      </article>
    </li>
  );
}

export default function FixPage() {
  const { user, loading: authLoading } = useAuth();
  const [bundle, setBundle] = useState<LatestAuditBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      return;
    }
    loadLatestAuditBundle(user.id)
      .then(setBundle)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, user]);

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

  if (authLoading || loading) {
    return (
      <div>
        <div className="h-8 w-32 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-5 w-80 rounded-md animate-pulse mb-8" style={{ background: 'var(--paper-2)' }} />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-[240px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
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
            What can you fix right now? Run an audit to populate your fix queue.
          </p>
        </div>
        <EmptyAudit
          title="No fixes ready"
          body="Run your first audit and Fixpath will surface copy-paste snippets and step-by-step fixes."
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Fix</h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
          What you can fix right now, ordered by impact + effort. Mark each one as you go.
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

      {/* Phase 2 hint */}
      <div
        className="rounded-xl p-3 mb-4 flex items-start gap-2.5"
        style={{ background: 'color-mix(in srgb, var(--signal) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--signal) 12%, transparent)' }}
      >
        <Sparkles size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--signal)' }} />
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          <span className="font-semibold" style={{ color: 'var(--ink)' }}>Coming later:</span>{' '}
          one-click WordPress deploy and FTP auto-fix. For now, every finding ships with a copy-paste snippet or manual steps you can apply yourself.
        </p>
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
            Re-audit to surface any new findings and confirm your last fixes landed.
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
        <div className="flex items-center gap-2 mb-2 text-[11px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>
          <ListChecks size={13} />
          Fix queue · {queue.length} item{queue.length === 1 ? '' : 's'}
        </div>
      )}

      <ul className="space-y-3">
        {queue.map((f) => (
          <FixCard
            key={f.id}
            finding={f}
            copied={copiedId === f.id}
            onCopy={handleCopy}
            onStatus={handleStatus}
            pending={!!pending[f.id]}
          />
        ))}
      </ul>
    </div>
  );
}
