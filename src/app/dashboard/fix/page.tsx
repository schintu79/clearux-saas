'use client';

/**
 * Fix — actionable remediation workspace. Each finding is a collapsed
 * card that expands to show Why it matters / Recommended fix / Business
 * impact, plus AI vs Human context when present. Grouped duplicate
 * findings collapse into one card with a "similar findings grouped"
 * chip. Multi-module impact is surfaced as module chips in the header.
 *
 * Filtering + search + status tracking live here (moved out of Find)
 * because this is the action queue.
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
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  Brain,
  Users,
  X,
} from 'lucide-react';
import {
  loadLatestAuditBundle,
  severityColor,
  severityLabel,
  moduleNameForFinding,
  moduleIndexForFinding,
  MODULE_TINTS,
  PHASE1_MODULES,
  type LatestAuditBundle,
} from '@/lib/dashboard/latest-audit';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';
import FixConsole from '@/components/dashboard/v2/FixConsole';
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

function FixCard({
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
  onDismiss: (id: string) => void;
  pending: boolean;
}) {
  const finding = group.primary;
  const meta = STATUS_META[finding.status] || STATUS_META.open;
  const moduleNames = group.affectedModuleIndices
    .filter((i) => i >= 0)
    .map((i) => PHASE1_MODULES[i]);
  const multiModule = moduleNames.length > 1;
  const grouped = group.isConsolidated;
  const host = hostnameOf(finding.page_url);
  const hasAIvsHuman = Boolean(finding.ai_interpretation && finding.human_interpretation);
  const hasImpact = Boolean(finding.estimated_impact && finding.estimated_impact.trim());

  return (
    <li id={`finding-${finding.id}`}>
      <article
        className="rounded-xl overflow-hidden transition-shadow"
        style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        data-testid="fix-card"
      >
        {/* Top context strip — only renders when there's something to show */}
        {(multiModule || grouped) && (
          <div
            className="flex items-center justify-between px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.06em]"
            style={{ background: 'var(--paper-2)', color: 'var(--m-muted)', borderBottom: '1px solid var(--rule)' }}
          >
            <div className="flex items-center gap-3 flex-wrap">
              {multiModule && (
                <>
                  <span>Affects {moduleNames.length} modules</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {group.affectedModuleIndices.filter((i) => i >= 0).map((i) => {
                      const tint = MODULE_TINTS[i] || MODULE_TINTS[0];
                      return (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold normal-case tracking-normal"
                          style={{ background: tint.bg, color: 'var(--ink)', border: `1px solid ${tint.border}` }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: tint.dot }} aria-hidden />
                          {PHASE1_MODULES[i]}
                        </span>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            {grouped && (
              <span>{group.members.length} similar findings grouped</span>
            )}
          </div>
        )}

        {/* Header — entirely clickable to expand */}
        <button
          type="button"
          onClick={() => onToggle(finding.id)}
          className="w-full text-left p-4 flex items-start gap-3 hover:bg-[color:var(--paper-2)]/30 transition-colors"
          aria-expanded={expanded}
          aria-controls={`fix-body-${finding.id}`}
        >
          <div className="flex-1 min-w-0">
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.04em]"
              style={{
                background: `color-mix(in srgb, ${severityColor(finding.severity)} 12%, transparent)`,
                color: severityColor(finding.severity),
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: severityColor(finding.severity) }} aria-hidden />
              {severityLabel(finding.severity)}
            </span>
            <h3 className="text-[15px] font-semibold leading-snug mt-2" style={{ color: 'var(--ink)' }}>
              {finding.title}
            </h3>
            <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px]" style={{ color: 'var(--m-muted)' }}>
              {!multiModule && moduleNames[0] && (
                <span>{moduleNames[0]}</span>
              )}
              {!multiModule && moduleNames[0] && (host || finding.page_url) && (
                <span aria-hidden>·</span>
              )}
              {finding.page_url ? (
                <a
                  href={finding.page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 hover:underline truncate max-w-[320px]"
                >
                  <ExternalLink size={10} />
                  {host || finding.page_url}
                </a>
              ) : null}
            </div>
          </div>

          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0"
            style={{ background: meta.bg, color: meta.color, border: '1px solid var(--rule)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} aria-hidden />
            {meta.label}
          </span>
          <span className="ml-1 flex-shrink-0 text-[var(--m-muted)]" aria-hidden>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>

        {expanded && (
          <div
            id={`fix-body-${finding.id}`}
            style={{ borderTop: '1px solid var(--rule)' }}
          >
            {/* AI vs Human (only when both present) */}
            {hasAIvsHuman && (
              <div
                className="grid grid-cols-1 md:grid-cols-2"
                style={{ borderBottom: '1px solid var(--rule)' }}
              >
                <div
                  className="p-4"
                  style={{ borderBottom: '1px solid var(--rule)' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Brain size={12} style={{ color: 'var(--signal)' }} />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--m-muted)' }}>
                      How AI reads this
                    </p>
                  </div>
                  <p className="text-[13px] leading-[1.65]" style={{ color: 'var(--ink-2)' }}>
                    {finding.ai_interpretation}
                  </p>
                </div>
                <div
                  className="p-4"
                  style={{ borderBottom: '1px solid var(--rule)' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={12} style={{ color: 'var(--ok)' }} />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--m-muted)' }}>
                      How a human sees this
                    </p>
                  </div>
                  <p className="text-[13px] leading-[1.65]" style={{ color: 'var(--ink-2)' }}>
                    {finding.human_interpretation}
                  </p>
                </div>
              </div>
            )}

            {/* Finding / Fix / Impact — clearly sectioned */}
            <div
              className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.06em]"
              style={{ color: 'var(--m-muted)' }}
            >
              Overview
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3">
              <div
                className="p-4"
                style={{ borderRight: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={12} style={{ color: severityColor(finding.severity) }} />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--m-muted)' }}>
                    Finding
                  </p>
                </div>
                <p className="text-[13px] leading-[1.65]" style={{ color: 'var(--ink-2)' }}>
                  {finding.description}
                </p>
              </div>

              <div
                className="p-4"
                style={{
                  background: 'color-mix(in srgb, var(--signal) 4%, transparent)',
                  borderRight: '1px solid var(--rule)',
                  borderBottom: '1px solid var(--rule)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb size={12} style={{ color: 'var(--signal)' }} />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--signal)' }}>
                    Fix
                  </p>
                </div>
                <p className="text-[13px] leading-[1.65] font-medium whitespace-pre-wrap" style={{ color: 'var(--ink)' }}>
                  {finding.recommendation || 'Manual review required — open the audit detail for full context.'}
                </p>
              </div>

              <div
                className="p-4"
                style={{ borderBottom: '1px solid var(--rule)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={12} style={{ color: 'var(--ok)' }} />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--m-muted)' }}>
                    Impact
                  </p>
                </div>
                {hasImpact ? (
                  <p className="text-[13px] leading-[1.65]" style={{ color: 'var(--ink-2)' }}>
                    {finding.estimated_impact}
                  </p>
                ) : (
                  <p className="text-[12px] leading-[1.65] italic" style={{ color: 'var(--m-muted)' }}>
                    Business impact not captured for this finding.
                  </p>
                )}
              </div>
            </div>

            {/* Fix Console — editable patch, copy/download, AI helper, gated push */}
            <FixConsole
              finding={finding}
              onApproveLocal={() => onStatus(finding.id, 'fixed')}
              pending={pending}
            />

            {/* Status row — matches screenshot footer */}
            <div className="px-4 py-3 flex items-center gap-3 flex-wrap" style={{ background: 'var(--paper-2)' }}>
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--m-muted)' }}>
                Status
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {STATUS_KEYS.map((s) => {
                  const active = finding.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => onStatus(finding.id, s)}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-all disabled:opacity-50"
                      style={
                        active
                          ? {
                              background: STATUS_META[s].bg,
                              color: STATUS_META[s].color,
                              border: `1px solid ${STATUS_META[s].color}`,
                            }
                          : {
                              background: 'transparent',
                              color: 'var(--m-muted)',
                              border: '1px solid transparent',
                            }
                      }
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: active ? STATUS_META[s].dot : 'var(--rule)' }}
                        aria-hidden
                      />
                      {STATUS_META[s].label}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => onDismiss(finding.id)}
                disabled={pending}
                className="ml-auto text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
                style={{ color: 'var(--m-muted)' }}
              >
                Dismiss
              </button>
            </div>

            {/* Affected pages, when grouped finding spans multiple pages */}
            {group.affectedPages.length > 1 && (
              <div className="px-4 py-2.5 text-[11px]" style={{ background: 'var(--card)', borderTop: '1px solid var(--rule)', color: 'var(--m-muted)' }}>
                <span className="font-semibold uppercase tracking-[0.06em] mr-2 text-[10px]">Pages affected</span>
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
      </article>
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

  // Hydrate filters from URL params so Overview's severity tiles and the
  // category-card links land prefiltered. Only runs on mount + when params
  // actually change so user edits don't get clobbered.
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
  // Depends on `bundle` so the effect re-fires after the findings list
  // mounts (otherwise the target DOM node doesn't exist yet on a fresh
  // client-side nav from Find).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const apply = () => {
      const raw = window.location.hash.replace(/^#/, '');
      const m = raw.match(/^finding-(.+)$/);
      if (!m) return;
      const id = m[1];
      setExpanded((e) => (e[id] ? e : { ...e, [id]: true }));
      // Wait one paint so the expanded body renders before we scroll —
      // otherwise the scroll target moves as the card grows. Run twice
      // (rAF + setTimeout) to cover both list mount and re-renders from
      // the loading bundle.
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

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const f = g.primary;
      if (statusFilter !== 'all' && f.status !== statusFilter) return false;
      if (sevFilter !== 'all' && f.severity !== sevFilter) return false;
      if (moduleFilter !== 'all') {
        const names = g.affectedModuleIndices
          .filter((i) => i >= 0)
          .map((i) => PHASE1_MODULES[i]);
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

  const handleDismiss = async (id: string) => {
    if (!confirm('Dismiss this finding? It will be removed from your fix queue.')) return;
    setPending((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`/api/findings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismiss: true, dismissal_reason: 'Dismissed from Fix queue' }),
      });
      if (res.ok && bundle) {
        setBundle({ ...bundle, findings: bundle.findings.filter((f) => f.id !== id) });
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
          {[1, 2, 3].map((i) => <div key={i} className="h-[88px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
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

  const hasActiveFilters = query.trim() || moduleFilter !== 'all' || sevFilter !== 'all' || statusFilter !== 'all';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Fix</h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
          Your action workspace. Click a card to expand it and see why it matters, the recommended fix, and the business impact. Update status as you go.
        </p>
      </div>

      {/* Status counters */}
      <div
        className="rounded-xl px-4 py-3 mb-3 grid grid-cols-2 sm:grid-cols-4 gap-3"
        style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      >
        {STATUS_KEYS.map((s) => {
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(active ? 'all' : s)}
              className="flex items-center gap-2 rounded-md px-1.5 py-0.5 text-left transition-colors"
              style={active ? { background: STATUS_META[s].bg } : {}}
              aria-pressed={active}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: STATUS_META[s].dot }} aria-hidden />
              <span className="text-[12px]" style={{ color: 'var(--m-muted)' }}>{STATUS_META[s].label}</span>
              <span className="text-[12px] font-semibold tabular-nums ml-auto" style={{ color: 'var(--ink)' }}>{stats[s]}</span>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2 mb-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--m-muted)' }} />
          <input
            type="search"
            placeholder="Search fixes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
            style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
            aria-label="Search fixes"
          />
        </div>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
          aria-label="Filter by module"
        >
          <option value="all">All modules</option>
          {PHASE1_MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={sevFilter}
          onChange={(e) => setSevFilter(e.target.value as typeof SEVERITIES[number])}
          className="px-3 py-2 rounded-lg text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
          aria-label="Filter by severity"
        >
          {SEVERITIES.map((s) => <option key={s} value={s}>{s === 'all' ? 'All severities' : severityLabel(s)}</option>)}
        </select>
        {hasActiveFilters && (
          <button
            onClick={() => { setQuery(''); setModuleFilter('all'); setSevFilter('all'); setStatusFilter('all'); }}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[12px] font-medium"
            style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--ink-2)' }}
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      <div className="mb-2 text-[12px]" style={{ color: 'var(--m-muted)' }}>
        {filteredGroups.length} of {groups.length} fixes
      </div>

      {groups.length === 0 ? (
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
      ) : filteredGroups.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
            No fixes match these filters
          </p>
          <button
            onClick={() => { setQuery(''); setModuleFilter('all'); setSevFilter('all'); setStatusFilter('all'); }}
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-[13px] font-semibold"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredGroups.map((g) => (
            <FixCard
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
