'use client';

/**
 * Fix — structured deploy console.
 *
 * Two-column layout:
 *  - Main area (left): active finding expanded with full details + FixConsole
 *  - Sidebar rail (right): compact list of all findings, clickable to select
 *
 * The active finding is fully visible and visually highlighted.
 * Sidebar findings render at ~50% opacity; the active one is fully opaque.
 */

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowRight,
  Search,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Wrench,
  X,
  AlertTriangle,
  Info,
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
import PageHeader from '@/components/dashboard/v2/PageHeader';
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
    <div
      className="relative inline-flex rounded-md"
      style={{
        background: isActive ? 'var(--ink)' : 'var(--card)',
        border: `1px solid ${isActive ? 'var(--ink)' : 'var(--rule)'}`,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='${isActive ? '%23fff' : '%23999'}' stroke-width='1.5'%3E%3Cpath d='M3 4.5L6 7.5l3-3'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 6px center',
      }}
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-[11px] font-medium pl-2.5 pr-6 py-1 rounded-md outline-none cursor-pointer appearance-none bg-transparent focus-visible:ring-2 focus-visible:ring-signal/30"
        style={{ color: isActive ? 'var(--paper)' : 'var(--ink)' }}
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

interface FtpConnectionSummary {
  id: string;
  label: string;
  protocol: string;
  host: string;
  remote_path: string;
  brand_identity_id: string | null;
}

function fixPriority(f: AuditFinding): number {
  return SEVERITY_RANK[f.severity] || 0;
}

/* ── Sidebar Finding Item ─────────────────────────────────── */

function SidebarItem({
  group,
  isActive,
  onClick,
}: {
  group: GroupedFinding;
  isActive: boolean;
  onClick: () => void;
}) {
  const finding = group.primary;
  const sevColor = severityColor(finding.severity);
  const meta = STATUS_META[finding.status] || STATUS_META.open;
  const host = hostnameOf(finding.page_url);

  if (finding.dismissed) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left px-3 py-2 opacity-40"
        style={{ borderBottom: '1px solid var(--rule)' }}
      >
        <span className="text-[11px] line-through truncate block" style={{ color: 'var(--m-muted)' }}>
          {finding.title}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 transition-all"
      style={{
        borderBottom: '1px solid var(--rule)',
        borderLeft: isActive ? `3px solid ${sevColor}` : '3px solid transparent',
        background: isActive ? 'var(--paper)' : 'transparent',
        opacity: isActive ? 1 : 0.55,
      }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p
            className="text-[12px] font-medium leading-snug truncate"
            style={{ color: 'var(--ink)' }}
          >
            {finding.title}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-[10px]">
            <span className="font-semibold uppercase tracking-[0.04em]" style={{ color: sevColor }}>
              {severityLabel(finding.severity)}
            </span>
            <span style={{ color: 'var(--m-muted)' }} aria-hidden>·</span>
            <span
              className="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-medium"
              style={{ background: meta.bg, color: meta.color }}
            >
              <span className="w-1 h-1 rounded-full" style={{ background: meta.dot }} />
              {meta.label}
            </span>
            {host && (
              <>
                <span style={{ color: 'var(--m-muted)' }} aria-hidden>·</span>
                <span className="truncate max-w-[100px]" style={{ color: 'var(--m-muted)' }}>{host}</span>
              </>
            )}
          </div>
        </div>
        {isActive && <ChevronRight size={12} className="flex-shrink-0 mt-1" style={{ color: 'var(--ink)' }} />}
      </div>
    </button>
  );
}

/* ── Active Finding Detail ─────────────────────────────────── */

function ActiveFindingDetail({
  group,
  pending,
  ftpConnections,
  onStatus,
  onDismiss,
}: {
  group: GroupedFinding;
  pending: boolean;
  ftpConnections: FtpConnectionSummary[];
  onStatus: (id: string, status: FindingStatus) => void;
  onDismiss: (id: string, reason: string) => void;
}) {
  const finding = group.primary;
  const sevColor = severityColor(finding.severity);
  const meta = STATUS_META[finding.status] || STATUS_META.open;
  const moduleNames = group.affectedModuleIndices.filter((i) => i >= 0).map((i) => PHASE1_MODULES[i]);
  const host = hostnameOf(finding.page_url);
  const hasImpact = Boolean(finding.estimated_impact && finding.estimated_impact.trim());

  const [showDismiss, setShowDismiss] = useState(false);
  const [dismissReason, setDismissReason] = useState('');

  const handleConfirmDismiss = () => {
    const r = dismissReason.trim();
    if (!r) return;
    onDismiss(finding.id, r);
    setShowDismiss(false);
    setDismissReason('');
  };

  if (finding.dismissed) {
    return (
      <div
        className="rounded-lg p-6 text-center"
        style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      >
        <p className="text-[14px] font-medium line-through" style={{ color: 'var(--m-muted)' }}>
          {finding.title}
        </p>
        <p className="text-[12px] mt-2" style={{ color: 'var(--m-muted)' }}>
          This finding was dismissed.
          {finding.dismissal_reason && <> Reason: {finding.dismissal_reason}</>}
        </p>
      </div>
    );
  }

  return (
    <div id={`finding-${finding.id}`} data-testid="fix-card">
      {/* Header bar — title, severity, module, status, dismiss */}
      <div
        className="rounded-t-lg px-5 py-4"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--rule)',
          borderLeft: `3px solid ${sevColor}`,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-[16px] font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
              {finding.title}
            </h2>
            <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px]">
              <span className="font-semibold uppercase tracking-[0.04em]" style={{ color: sevColor }}>
                {severityLabel(finding.severity)}
              </span>
              {moduleNames.map((m, i) => {
                const idx = group.affectedModuleIndices.filter((x) => x >= 0)[i];
                const tint = idx != null ? MODULE_TINTS[idx] : null;
                return (
                  <React.Fragment key={`${m}-${i}`}>
                    <span style={{ color: 'var(--m-muted)' }} aria-hidden>·</span>
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                      style={{ background: tint?.bg || 'var(--paper-2)', color: 'var(--ink)', border: `1px solid ${tint?.border || 'var(--rule)'}` }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: tint?.dot || 'var(--m-muted)' }} aria-hidden />
                      {m}
                    </span>
                  </React.Fragment>
                );
              })}
              {finding.page_url && (
                <>
                  <span style={{ color: 'var(--m-muted)' }} aria-hidden>·</span>
                  <a
                    href={finding.page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:underline truncate max-w-[280px]"
                    style={{ color: 'var(--m-muted)' }}
                  >
                    <ExternalLink size={10} />
                    {host || finding.page_url}
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Toolbar — status + dismiss */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Status dropdown — matches FilterDropdown style */}
            {(() => {
              const isActive = finding.status !== 'open';
              const chevronColor = isActive ? '%23fff' : '%23999';
              return (
                <div
                  className="relative inline-flex rounded-md"
                  style={{
                    background: isActive ? meta.dot : 'var(--card)',
                    border: `1px solid ${isActive ? meta.dot : 'var(--rule)'}`,
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='${chevronColor}' stroke-width='1.5'%3E%3Cpath d='M3 4.5L6 7.5l3-3'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 6px center',
                  }}
                >
                  <select
                    value={finding.status}
                    onChange={(e) => onStatus(finding.id, e.target.value as FindingStatus)}
                    disabled={pending}
                    className="text-[11px] font-medium pl-2.5 pr-6 py-1 rounded-md appearance-none cursor-pointer outline-none bg-transparent disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-signal/30"
                    style={{ color: isActive ? '#fff' : 'var(--ink)' }}
                    aria-label="Finding status"
                  >
                    {STATUS_KEYS.map((sk) => (
                      <option key={sk} value={sk}>{STATUS_META[sk].label}</option>
                    ))}
                  </select>
                </div>
              );
            })()}

            {/* Dismiss */}
            <button
              type="button"
              onClick={() => setShowDismiss((v) => !v)}
              disabled={pending}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-medium transition-colors disabled:opacity-50"
              style={{
                color: showDismiss ? 'var(--paper)' : 'var(--m-muted)',
                background: showDismiss ? 'var(--ink)' : 'transparent',
                border: `1px solid ${showDismiss ? 'var(--ink)' : 'var(--rule)'}`,
              }}
              aria-label="Dismiss this finding"
            >
              <X size={11} />
              Dismiss
            </button>
          </div>
        </div>

        {/* Dismiss panel */}
        {showDismiss && (
          <div
            className="mt-3 px-4 py-3 rounded-lg"
            style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
          >
            <p className="text-[12.5px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>
              Dismiss this finding
            </p>
            <p className="text-[11px] mb-3" style={{ color: 'var(--m-muted)' }}>
              Add a reason so your team knows why. You can restore dismissed findings anytime.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmDismiss(); }}
                placeholder="e.g. Not relevant, already addressed..."
                className="flex-1 px-3 py-1.5 rounded-md text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-signal/30"
                style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                autoFocus
                aria-label="Dismissal reason"
              />
              <button
                type="button"
                onClick={handleConfirmDismiss}
                disabled={!dismissReason.trim() || pending}
                className="px-3 py-1.5 rounded-md text-[11.5px] font-semibold transition-all disabled:opacity-50"
                style={{
                  background: dismissReason.trim() ? 'var(--ink)' : 'var(--paper-2)',
                  color: dismissReason.trim() ? 'var(--paper)' : 'var(--m-muted)',
                  border: `1px solid ${dismissReason.trim() ? 'var(--ink)' : 'var(--rule)'}`,
                }}
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => { setShowDismiss(false); setDismissReason(''); }}
                className="p-1.5 rounded-md transition-colors"
                style={{ color: 'var(--m-muted)', border: '1px solid var(--rule)' }}
                aria-label="Cancel"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Body — issue detail + FixConsole */}
      <div
        className="rounded-b-lg"
        style={{ background: '#ffffff', border: '1px solid var(--rule)', borderTop: 'none' }}
      >
        <div className="px-5 py-5 space-y-5">
          {/* What we found + Why it matters — side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg p-4" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] mb-2.5" style={{ color: sevColor }}>
                What we found
              </p>
              <div className="max-w-prose"><FindingText text={finding.description} /></div>
            </div>
            <div className="rounded-lg p-4" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] mb-2.5" style={{ color: 'var(--warn)' }}>
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

          {/* Resolve — FixConsole with integrated preview panel */}
          <div className="pt-2">
            <h4 className="flex items-center gap-2 text-[15px] font-semibold mb-3" style={{ color: 'var(--ink)' }}>
              <Wrench size={15} strokeWidth={1.75} style={{ color: 'var(--m-muted)' }} />
              Resolve this issue
            </h4>
            <FixConsole
              finding={finding}
              pending={pending}
              ftpConnections={ftpConnections}
              affectedPages={group.affectedPages}
              onStatusChange={(status) => onStatus(finding.id, status as FindingStatus)}
            />
          </div>
        </div>

        {/* Affected pages */}
        {group.affectedPages.length > 1 && (
          <div className="px-5 pb-4 text-[11px]" style={{ color: 'var(--m-muted)' }}>
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
    </div>
  );
}

/* ── Main Page Content ─────────────────────────────────────── */

function FixPageInner() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const searchParams = useSearchParams();
  const [bundle, setBundle] = useState<LatestAuditBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [sevFilter, setSevFilter] = useState<typeof SEVERITIES[number]>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | FindingStatus>('all');

  const [ftpConnections, setFtpConnections] = useState<FtpConnectionSummary[]>([]);
  const [ftpLoaded, setFtpLoaded] = useState(false);

  // Hydrate filters from URL
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

  // Load FTP connections
  useEffect(() => {
    if (authLoading || !user || !ready) return;
    const siteHost = selection?.kind === 'site' ? selection.host : null;
    const url = siteHost ? `/api/ftp?siteHost=${encodeURIComponent(siteHost)}` : '/api/ftp';
    fetch(url)
      .then(async (res) => {
        if (res.status === 503) { setFtpConnections([]); return; }
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        setFtpConnections((data as { connections?: FtpConnectionSummary[] })?.connections || []);
      })
      .catch(() => setFtpConnections([]))
      .finally(() => setFtpLoaded(true));
  }, [authLoading, user, ready, selection]);

  // Deep link via #finding-<id> — auto-select the referenced finding
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const apply = () => {
      const raw = window.location.hash.replace(/^#/, '');
      const m = raw.match(/^finding-(.+)$/);
      if (!m) return;
      setActiveFindingId(m[1]);
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [bundle]);

  const groups = useMemo<GroupedFinding[]>(() => {
    if (!bundle) return [];
    const fixable = bundle.findings.filter((f) => (f as AuditFinding & { finding_type?: string }).finding_type !== 'strategic');
    const grouped = groupFindingsForDisplay(fixable, (f) => moduleIndexForFinding(f));
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

  // Auto-select first finding when groups load and nothing is active
  useEffect(() => {
    if (filteredGroups.length > 0 && !activeFindingId) {
      setActiveFindingId(filteredGroups[0].primary.id);
    }
  }, [filteredGroups, activeFindingId]);

  const activeGroup = useMemo(
    () => filteredGroups.find((g) => g.primary.id === activeFindingId) || null,
    [filteredGroups, activeFindingId],
  );

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
        updateLocal(id, { dismissed: true, dismissal_reason: trimmed, dismissed_at: new Date().toISOString() });
      }
    } catch {} finally {
      setPending((p) => ({ ...p, [id]: false }));
    }
  };

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
        <PageHeader
          icon={<Wrench size={18} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />}
          title="Fix"
          subtitle={selection ? 'No audit for this brand yet.' : 'Run an audit to populate your fix queue.'}
        />
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
      <PageHeader
        icon={<Wrench size={18} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />}
        title="Fix"
        subtitle="Your action queue. Select a finding to resolve, deploy, or hand off to your team."
      />

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
      ) : (
        <div className="flex gap-5 items-start">
          {/* ── Main area — active finding ──────────────────── */}
          <div className="flex-1 min-w-0">
            {activeGroup ? (
              <ActiveFindingDetail
                key={activeGroup.primary.id}
                group={activeGroup}
                pending={!!pending[activeGroup.primary.id]}
                ftpConnections={ftpConnections}
                onStatus={handleStatus}
                onDismiss={handleDismiss}
              />
            ) : (
              <div
                className="rounded-lg p-10 text-center"
                style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
              >
                <Info size={20} style={{ color: 'var(--m-muted)' }} className="mx-auto mb-3" />
                <p className="text-[14px] font-medium" style={{ color: 'var(--ink)' }}>
                  {filteredGroups.length === 0 ? 'No findings match your filters' : 'Select a finding from the sidebar'}
                </p>
                {filteredGroups.length === 0 && hasActiveFilters && (
                  <button
                    onClick={() => { setQuery(''); setModuleFilter('all'); setSevFilter('all'); setStatusFilter('all'); }}
                    className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-md text-[13px] font-semibold"
                    style={{ background: 'var(--ink)', color: 'var(--paper)' }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Sidebar rail — all findings ─────────────────── */}
          <aside className="w-[280px] flex-shrink-0 sticky top-4">
            <div
              className="rounded-lg overflow-hidden"
              style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
            >
              {/* Search + filters */}
              <div className="px-3 py-3 space-y-2" style={{ borderBottom: '1px solid var(--rule)' }}>
                <div className="relative">
                  <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--m-muted)' }} />
                  <input
                    type="search"
                    placeholder="Search..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full pl-7 pr-2.5 py-1.5 rounded-md text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-signal/30"
                    style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                    aria-label="Search fixes"
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <FilterDropdown
                    value={statusFilter}
                    onChange={(v) => setStatusFilter(v as 'all' | FindingStatus)}
                    label="Status"
                    options={[
                      { value: 'all', label: `All (${groups.length})` },
                      ...STATUS_KEYS.map((s) => ({ value: s, label: `${STATUS_META[s].label} (${stats[s] || 0})` })),
                    ]}
                  />
                  <FilterDropdown
                    value={sevFilter}
                    onChange={(v) => setSevFilter(v as typeof SEVERITIES[number])}
                    label="Severity"
                    options={[
                      { value: 'all', label: 'All sev.' },
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
                      { value: 'all', label: 'All mod.' },
                      ...PHASE1_MODULES.filter((m) => moduleCounts[m]).map((m) => ({
                        value: m,
                        label: `${m} (${moduleCounts[m] || 0})`,
                      })),
                    ]}
                  />
                  {hasActiveFilters && (
                    <button
                      onClick={() => { setQuery(''); setModuleFilter('all'); setSevFilter('all'); setStatusFilter('all'); }}
                      className="p-1 rounded-md"
                      style={{ color: 'var(--m-muted)', border: '1px solid var(--rule)' }}
                      aria-label="Clear filters"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              </div>

              {/* Finding list */}
              <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
                {filteredGroups.length === 0 ? (
                  <div className="px-3 py-6 text-center text-[11px]" style={{ color: 'var(--m-muted)' }}>
                    No findings match
                  </div>
                ) : (
                  filteredGroups.map((g) => (
                    <SidebarItem
                      key={g.primary.id}
                      group={g}
                      isActive={g.primary.id === activeFindingId}
                      onClick={() => setActiveFindingId(g.primary.id)}
                    />
                  ))
                )}
              </div>

              {/* Count footer */}
              <div
                className="px-3 py-2 text-[10px]"
                style={{ borderTop: '1px solid var(--rule)', color: 'var(--m-muted)' }}
              >
                {filteredGroups.length} of {groups.length} findings
              </div>
            </div>
          </aside>
        </div>
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
