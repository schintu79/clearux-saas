'use client';

/**
 * Fix — flat, full-width action workspace.
 *
 * Visual rules (redesign):
 *  - No card-in-card layering. Each finding is a single flat row that
 *    expands inline; the action bar lives flush at the bottom of the
 *    expanded row, not inside a sub-panel.
 *  - Status is a color-coded select dropdown directly on the collapsed
 *    row, so a finding can be moved through the lifecycle without
 *    expanding it.
 *  - Module / severity / status filters render as compact select
 *    dropdowns. An active dropdown turns dark to signal a filter is on.
 *  - Dismiss is an action alongside Status, gated on a reason input.
 *    Dismissed findings collapse to a single strikethrough row.
 *  - Push remains explicitly gated. Nothing is sent to a live site
 *    without user approval and a connected deployment target.
 */

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowRight,
  Search,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  X,
} from 'lucide-react';
import {
  loadLatestAuditBundle,
  severityColor,
  severityLabel,
  moduleIndexForFinding,
  MODULE_TINTS,
  PHASE1_MODULES,
  type LatestAuditBundle,
} from '@/lib/dashboard/latest-audit';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';
import OverviewBreadcrumb from '@/components/dashboard/OverviewBreadcrumb';
import FixConsole from '@/components/dashboard/v2/FixConsole';
import FindingText from '@/components/dashboard/v2/FindingText';
import { groupFindingsForDisplay, type GroupedFinding } from '@/lib/audit-findings-presentation';
import type { AuditFinding, FindingStatus } from '@/types/database';

const STATUS_META: Record<FindingStatus, { label: string; color: string; bg: string; dot: string }> = {
  open:        { label: 'Open',        color: 'var(--m-muted)', bg: 'var(--paper-2)',                                       dot: 'var(--m-muted)' },
  in_progress: { label: 'In Progress', color: 'var(--warn)',    bg: 'color-mix(in srgb, var(--warn) 10%, transparent)',     dot: 'var(--warn)' },
  fixed:       { label: 'Fixed',       color: 'var(--ok)',      bg: 'color-mix(in srgb, var(--ok) 10%, transparent)',       dot: 'var(--ok)' },
  backlog:     { label: 'Backlog',     color: 'var(--signal)',  bg: 'color-mix(in srgb, var(--signal) 10%, transparent)',   dot: 'var(--signal)' },
};

const STATUS_KEYS: FindingStatus[] = ['open', 'in_progress', 'fixed', 'backlog'];
const SEVERITIES: Array<'all' | 'critical' | 'high' | 'medium' | 'low'> = ['all', 'critical', 'high', 'medium', 'low'];
const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function hostnameOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

/** Tiny pill used for module + severity meta on the collapsed row. */
function MetaChip({ children, color, bg, border }: { children: React.ReactNode; color?: string; bg?: string; border?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium normal-case tracking-normal"
      style={{ background: bg || 'var(--paper-2)', color: color || 'var(--m-muted)', border: border || '1px solid var(--rule)' }}
    >
      {children}
    </span>
  );
}

/** Filter dropdown shared by Status, Severity, Module. Goes dark when active. */
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
      className="text-[12px] font-medium pl-3 pr-7 py-1.5 rounded-md outline-none cursor-pointer appearance-none focus-visible:ring-2 focus-visible:ring-signal/30"
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

function FixRow({
  group,
  expanded,
  onToggle,
  onStatus,
  onDismiss,
  pending,
}: {
  group: GroupedFinding;
  expanded: boolean;
  onToggle: (id: string) => void;
  onStatus: (id: string, status: FindingStatus) => void;
  onDismiss: (id: string, reason: string) => void;
  pending: boolean;
}) {
  const finding = group.primary;
  const [showDismiss, setShowDismiss] = useState(false);
  const [dismissReason, setDismissReason] = useState('');
  const meta = STATUS_META[finding.status] || STATUS_META.open;
  const moduleNames = group.affectedModuleIndices.filter((i) => i >= 0).map((i) => PHASE1_MODULES[i]);
  const multiModule = moduleNames.length > 1;
  const grouped = group.isConsolidated;
  const host = hostnameOf(finding.page_url);
  const sevColor = severityColor(finding.severity);
  const hasImpact = Boolean(finding.estimated_impact && finding.estimated_impact.trim());

  // Dismissed findings collapse to a single muted, strikethrough row.
  if (finding.dismissed) {
    return (
      <li id={`finding-${finding.id}`} data-testid="fix-card" data-card data-dismissed>
        <div
          className="px-4 py-2.5 flex items-center gap-3 opacity-60"
          style={{ borderTop: '1px solid var(--rule)' }}
        >
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--rule)' }} aria-hidden />
          <span className="text-[12px] line-through flex-1 truncate" style={{ color: 'var(--m-muted)' }}>
            {finding.title}
          </span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: 'var(--paper-2)', color: 'var(--m-muted)', border: '1px solid var(--rule)' }}
          >
            Dismissed
          </span>
        </div>
      </li>
    );
  }

  const handleConfirmDismiss = () => {
    const r = dismissReason.trim();
    if (!r) return;
    onDismiss(finding.id, r);
    setShowDismiss(false);
    setDismissReason('');
  };

  return (
    <li id={`finding-${finding.id}`} data-testid="fix-card" data-card>
      <div style={{ borderTop: '1px solid var(--rule)' }}>
        {/* Collapsed row — single flat line, no nested card */}
        <div className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[color:var(--paper-2)]/50 transition-colors">
          {/* Severity dot */}
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sevColor }} aria-hidden />

          <button
            type="button"
            onClick={() => onToggle(finding.id)}
            className="flex-1 min-w-0 text-left"
            aria-expanded={expanded}
            aria-controls={`fix-body-${finding.id}`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[13.5px] font-semibold leading-snug truncate" style={{ color: 'var(--ink)' }}>
                {finding.title}
              </h3>
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px]" style={{ color: 'var(--m-muted)' }}>
              <span className="font-semibold uppercase tracking-[0.04em]" style={{ color: sevColor }}>
                {severityLabel(finding.severity)}
              </span>
              {moduleNames.slice(0, multiModule ? 3 : 1).map((m, i) => {
                const idx = group.affectedModuleIndices.filter((x) => x >= 0)[i];
                const tint = idx != null ? MODULE_TINTS[idx] : null;
                return (
                  <React.Fragment key={`${m}-${i}`}>
                    <span aria-hidden>·</span>
                    <MetaChip color="var(--ink)" bg={tint?.bg} border={`1px solid ${tint?.border || 'var(--rule)'}`}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: tint?.dot || 'var(--m-muted)' }} aria-hidden />
                      {m}
                    </MetaChip>
                  </React.Fragment>
                );
              })}
              {multiModule && moduleNames.length > 3 && (
                <span>+{moduleNames.length - 3}</span>
              )}
              {grouped && (
                <>
                  <span aria-hidden>·</span>
                  <span>{group.members.length} similar</span>
                </>
              )}
              {finding.page_url && (
                <>
                  <span aria-hidden>·</span>
                  <a
                    href={finding.page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 hover:underline truncate max-w-[280px]"
                  >
                    <ExternalLink size={10} />
                    {host || finding.page_url}
                  </a>
                </>
              )}
            </div>
          </button>

          {/* Color-coded status select — change status without expanding */}
          <select
            value={finding.status}
            onChange={(e) => onStatus(finding.id, e.target.value as FindingStatus)}
            disabled={pending}
            onClick={(e) => e.stopPropagation()}
            className="text-[10.5px] font-semibold pl-2 pr-6 py-1 rounded-full outline-none cursor-pointer appearance-none flex-shrink-0 focus-visible:ring-2 focus-visible:ring-signal/30"
            style={{
              background: meta.bg,
              color: meta.color,
              border: `1px solid ${meta.dot}`,
              opacity: pending ? 0.6 : 1,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='none' stroke='%23999' stroke-width='1.5'%3E%3Cpath d='M2.5 3.5L5 6l2.5-2.5'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 5px center',
            }}
            aria-label={`Status for ${finding.title}`}
          >
            {STATUS_KEYS.map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>

          {/* Dismiss — visible alongside other actions */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowDismiss((v) => !v); }}
            disabled={pending}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-medium transition-colors hover:bg-paper-2 disabled:opacity-50 flex-shrink-0"
            style={{ color: showDismiss ? 'var(--severe)' : 'var(--m-muted)', border: '1px solid var(--rule)' }}
            aria-label="Dismiss this finding with a reason"
          >
            <X size={11} />
            Dismiss
          </button>

          <button
            type="button"
            onClick={() => onToggle(finding.id)}
            className="text-[var(--m-muted)] flex-shrink-0 p-1"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Dismiss-with-reason input — sits under the row when open */}
        {showDismiss && (
          <div className="px-4 pb-3 flex items-center gap-2" data-testid="fix-dismiss-row">
            <input
              type="text"
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmDismiss(); }}
              placeholder="Why are you dismissing this?"
              className="flex-1 px-3 py-1.5 rounded-md text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-signal/30"
              style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
              autoFocus
              aria-label="Dismissal reason"
            />
            <button
              type="button"
              onClick={handleConfirmDismiss}
              disabled={!dismissReason.trim() || pending}
              className="px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all disabled:opacity-50"
              style={{
                background: dismissReason.trim() ? 'var(--severe)' : 'var(--paper-2)',
                color: dismissReason.trim() ? 'white' : 'var(--m-muted)',
              }}
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => { setShowDismiss(false); setDismissReason(''); }}
              className="p-1.5 rounded-md hover:bg-paper-2 transition-colors"
              style={{ color: 'var(--m-muted)' }}
              aria-label="Cancel dismiss"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {expanded && (
          <div id={`fix-body-${finding.id}`} className="px-4 pb-4">
            {/* What we found + Why it matters — plain text, no inner cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-3 mt-1 mb-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--m-muted)' }}>
                  What we found
                </p>
                <div className="max-w-prose"><FindingText text={finding.description} /></div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--m-muted)' }}>
                  Why it matters
                </p>
                <div className="max-w-prose">
                  {hasImpact ? (
                    <FindingText text={finding.estimated_impact} />
                  ) : (
                    <p className="text-[12px] leading-[1.65] italic" style={{ color: 'var(--m-muted)' }}>
                      Business impact not captured for this finding.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Recommended fix label sits flush above the editor */}
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1.5" style={{ color: 'var(--signal)' }}>
              Recommended fix
            </p>

            {/* Action bar lives inside FixConsole, flush in the row */}
            <FixConsole
              finding={finding}
              onApproveLocal={() => onStatus(finding.id, 'fixed')}
              onStatus={(s) => onStatus(finding.id, s)}
              pending={pending}
            />

            {/* Affected pages — compact, no extra panel */}
            {group.affectedPages.length > 1 && (
              <div className="mt-3 text-[11px]" style={{ color: 'var(--m-muted)' }}>
                <span className="font-semibold uppercase tracking-[0.06em] mr-2 text-[10px]">Pages</span>
                <span className="inline-flex items-center gap-1 flex-wrap">
                  {group.affectedPages.slice(0, 5).map((p) => {
                    const h = hostnameOf(p);
                    return (
                      <a
                        key={p}
                        href={p}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:underline px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--paper-2)', color: 'var(--ink-2)' }}
                      >
                        <ExternalLink size={9} />
                        {h || p}
                      </a>
                    );
                  })}
                  {group.affectedPages.length > 5 && (
                    <span>+{group.affectedPages.length - 5} more</span>
                  )}
                </span>
              </div>
            )}

          </div>
        )}
      </div>
    </li>
  );
}

function fixPriority(f: AuditFinding): number {
  return SEVERITY_RANK[f.severity] || 0;
}

function FixPageInner() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const searchParams = useSearchParams();
  const [bundle, setBundle] = useState<LatestAuditBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [query, setQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [sevFilter, setSevFilter] = useState<typeof SEVERITIES[number]>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | FindingStatus>('all');

  // Hydrate filters from URL so deep links from Overview & category cards
  // land on the right slice of the queue.
  useEffect(() => {
    const sev = searchParams.get('severity');
    if (sev && (SEVERITIES as readonly string[]).includes(sev)) {
      setSevFilter(sev as typeof SEVERITIES[number]);
    }
    const mod = searchParams.get('module');
    if (mod && (PHASE1_MODULES as readonly string[]).includes(mod)) {
      setModuleFilter(mod);
    }
    const status = searchParams.get('status');
    if (status && (STATUS_KEYS as readonly string[]).includes(status)) {
      setStatusFilter(status as FindingStatus);
    }
  }, [searchParams]);

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

  // Auto-expand and scroll to the finding referenced by URL hash —
  // preserves the /dashboard/fix#finding-<id> deep link from Find.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const apply = () => {
      const raw = window.location.hash.replace(/^#/, '');
      const m = raw.match(/^finding-(.+)$/);
      if (!m) return;
      const id = m[1];
      setExpanded((e) => (e[id] ? e : { ...e, [id]: true }));
      requestAnimationFrame(() => {
        const el = document.getElementById(`finding-${id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      setTimeout(() => {
        const el = document.getElementById(`finding-${id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 250);
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [bundle]);

  const groups = useMemo<GroupedFinding[]>(() => {
    if (!bundle) return [];
    const grouped = groupFindingsForDisplay(bundle.findings, (f) => moduleIndexForFinding(f));
    return [...grouped].sort((a, b) => fixPriority(b.primary) - fixPriority(a.primary));
  }, [bundle]);

  const stats = useMemo(() => {
    const s: Record<FindingStatus, number> = { open: 0, in_progress: 0, fixed: 0, backlog: 0 };
    for (const g of groups) s[g.primary.status]++;
    return s;
  }, [groups]);

  const sevCounts = useMemo(() => {
    const out: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const g of groups) {
      const s = g.primary.severity as keyof typeof out;
      if (out[s] != null) out[s]++;
    }
    return out;
  }, [groups]);

  const moduleCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const g of groups) {
      const names = g.affectedModuleIndices.filter((i) => i >= 0).map((i) => PHASE1_MODULES[i]);
      for (const n of names) out[n] = (out[n] || 0) + 1;
    }
    return out;
  }, [groups]);

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const f = g.primary;
      if (statusFilter !== 'all' && f.status !== statusFilter) return false;
      if (sevFilter !== 'all' && f.severity !== sevFilter) return false;
      if (moduleFilter !== 'all') {
        const names = g.affectedModuleIndices.filter((i) => i >= 0).map((i) => PHASE1_MODULES[i]);
        if (!names.includes(moduleFilter as (typeof PHASE1_MODULES)[number])) return false;
      }
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${f.title} ${f.description} ${f.recommendation || ''} ${f.page_url || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [groups, query, moduleFilter, sevFilter, statusFilter]);

  const updateLocal = (id: string, patch: Partial<AuditFinding>) => {
    setBundle((b) => b ? { ...b, findings: b.findings.map((f) => f.id === id ? { ...f, ...patch } : f) } : b);
  };

  const handleStatus = async (id: string, status: FindingStatus) => {
    const prev = bundle?.findings.find((f) => f.id === id)?.status;
    setPending((p) => ({ ...p, [id]: true }));
    updateLocal(id, { status });
    try {
      const res = await fetch(`/api/findings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok && prev) updateLocal(id, { status: prev });
    } catch {
      if (prev) updateLocal(id, { status: prev });
    } finally {
      setPending((p) => ({ ...p, [id]: false }));
    }
  };

  const handleDismiss = async (id: string, reason: string) => {
    setPending((p) => ({ ...p, [id]: true }));
    const trimmed = reason.trim() || 'Dismissed from Fix queue';
    try {
      const res = await fetch(`/api/findings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismiss: true, dismissal_reason: trimmed }),
      });
      if (res.ok) {
        // Keep the finding in the list so the compact strikethrough row renders;
        // it is excluded from active counts via the `dismissed` flag.
        updateLocal(id, { dismissed: true, dismissal_reason: trimmed, dismissed_at: new Date().toISOString() });
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
          {[1, 2, 3].map((i) => <div key={i} className="h-[64px] rounded-md animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
      </div>
    );
  }

  if (!bundle?.audit) {
    return (
      <div>
        <OverviewBreadcrumb current="Fix" />
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

  const hasActiveFilters = query.trim() || moduleFilter !== 'all' || sevFilter !== 'all' || statusFilter !== 'all';

  return (
    <div>
      <OverviewBreadcrumb current="Fix" />
      <div className="mb-5">
        <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Fix</h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
          Your action queue. Click a row to expand, then review the fix, copy or download the snippet, and approve. Nothing is pushed without your approval.
        </p>
      </div>

      {/* Filter rail — Status / Severity / Module as compact dropdowns + search */}
      <div className="mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 max-w-md min-w-[180px]">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--m-muted)' }} />
            <input
              type="search"
              placeholder="Search fixes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-md text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-signal/30"
              style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
              aria-label="Search fixes"
            />
          </div>

          <FilterDropdown
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as 'all' | FindingStatus)}
            label="Status"
            options={[
              { value: 'all', label: `All status (${groups.length})` },
              ...STATUS_KEYS.map((s) => ({ value: s, label: `${STATUS_META[s].label} (${stats[s] || 0})` })),
            ]}
          />

          <FilterDropdown
            value={sevFilter}
            onChange={(v) => setSevFilter(v as typeof SEVERITIES[number])}
            label="Severity"
            options={[
              { value: 'all', label: 'All severities' },
              ...(SEVERITIES.filter((s) => s !== 'all') as Array<'critical' | 'high' | 'medium' | 'low'>).map((s) => ({
                value: s,
                label: `${severityLabel(s)} (${sevCounts[s] || 0})`,
              })),
            ]}
          />

          <FilterDropdown
            value={moduleFilter}
            onChange={setModuleFilter}
            label="Module"
            options={[
              { value: 'all', label: 'All modules' },
              ...PHASE1_MODULES.filter((m) => moduleCounts[m]).map((m) => ({
                value: m,
                label: `${m} (${moduleCounts[m] || 0})`,
              })),
            ]}
          />

          {hasActiveFilters && (
            <button
              onClick={() => { setQuery(''); setModuleFilter('all'); setSevFilter('all'); setStatusFilter('all'); }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11.5px] font-medium"
              style={{ background: 'transparent', border: '1px solid var(--rule)', color: 'var(--ink-2)' }}
            >
              <X size={11} /> Clear
            </button>
          )}

          <span className="ml-auto text-[11.5px]" style={{ color: 'var(--m-muted)' }}>
            {filteredGroups.length} of {groups.length}
          </span>
        </div>
      </div>

      {groups.length === 0 ? (
        <div
          className="rounded-lg p-8 text-center"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
          data-testid="fix-empty"
        >
          <CheckCircle2 size={24} style={{ color: 'var(--ok)' }} className="mx-auto mb-3" />
          <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>Nothing to fix right now</p>
          <p className="text-[12px] mt-1.5" style={{ color: 'var(--m-muted)' }}>
            Re-audit to surface new findings and confirm your fixes landed.
          </p>
          <Link
            href="/dashboard/new-audit"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-md text-[13px] font-semibold"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            Run re-audit
            <ArrowRight size={12} />
          </Link>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div
          className="rounded-lg p-8 text-center"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>No fixes match these filters</p>
          <button
            onClick={() => { setQuery(''); setModuleFilter('all'); setSevFilter('all'); setStatusFilter('all'); }}
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-md text-[13px] font-semibold"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul
          className="rounded-lg overflow-hidden"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)', borderTop: 'none' }}
        >
          {filteredGroups.map((g) => (
            <FixRow
              key={g.primary.id}
              group={g}
              expanded={!!expanded[g.primary.id]}
              onToggle={toggleExpand}
              onStatus={handleStatus}
              onDismiss={handleDismiss}
              pending={!!pending[g.primary.id]}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function FixPage() {
  return (
    <Suspense
      fallback={
        <div>
          <div className="h-8 w-32 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
          <div className="h-5 w-80 rounded-md animate-pulse mb-8" style={{ background: 'var(--paper-2)' }} />
        </div>
      }
    >
      <FixPageInner />
    </Suspense>
  );
}