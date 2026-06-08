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

import React, { Suspense, useEffect, useMemo, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAuditBundle } from '@/context/AuditBundleContext';
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
  Download,
} from 'lucide-react';
import {
  severityColor,
  severityLabel,
  moduleIndexForFinding,
  MODULE_TINTS,
  PHASE1_MODULES,
} from '@/lib/dashboard/latest-audit';
import { useWorkspace } from '@/context/WorkspaceContext';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';
import OverviewBreadcrumb from '@/components/dashboard/OverviewBreadcrumb';
import PageHeader from '@/components/dashboard/v2/PageHeader';
import FixConsole, { inferFixType } from '@/components/dashboard/v2/FixConsole';
import { prepareFindingsForExport, buildExportMeta, renderMarkdown, processExportPipeline } from '@/lib/export/findings-formatter';
import FindingText from '@/components/dashboard/v2/FindingText';
import { getDisplayTitle, getWhatFound, getWhyMatters, getFixPlain } from '@/lib/finding-communication-helpers';
import CustomSelect from '@/components/ui/CustomSelect';
import { groupFindingsForDisplay, reconciliationAwareSort, type GroupedFinding } from '@/lib/audit-findings-presentation';
import type { AuditFinding, FindingStatus, CrawlSummary } from '@/types/database';
import {
  AuditConfidenceStrip,
  FindingEvidenceBadge,
  FindingSourceLabel,
  FindingSurfaceScope,
  FindingEvidencePanel,
} from '@/components/dashboard/v2/AuditTrustLayer';

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  open:        { label: 'Open',        color: 'var(--m-muted)', bg: 'var(--paper-2)',                                       dot: 'var(--m-muted)' },
  in_progress: { label: 'In Progress', color: 'var(--warn)',    bg: 'color-mix(in srgb, var(--warn) 10%, transparent)',     dot: 'var(--warn)' },
  fixed:       { label: 'Fixed',       color: 'var(--ok)',      bg: 'color-mix(in srgb, var(--ok) 10%, transparent)',       dot: 'var(--ok)' },
  backlog:     { label: 'Backlog',     color: 'var(--signal)',  bg: 'color-mix(in srgb, var(--signal) 10%, transparent)',   dot: 'var(--signal)' },
  deferred:    { label: 'Deferred',    color: 'var(--m-muted)', bg: 'color-mix(in srgb, var(--m-muted) 8%, transparent)',   dot: 'var(--m-muted)' },
};

const STATUS_KEYS: FindingStatus[] = ['open', 'in_progress', 'fixed', 'backlog'];
const SEVERITIES: Array<'all' | 'critical' | 'high' | 'medium' | 'low'> = ['all', 'critical', 'high', 'medium', 'low'];
const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function hostnameOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

const VIEWPORT_CHIP_META: Record<string, { label: string; color: string; bg: string }> = {
  mobile:           { label: 'Mobile',          color: '#8b5cf6', bg: 'color-mix(in srgb, #8b5cf6 12%, transparent)' },
  desktop:          { label: 'Desktop',         color: '#0ea5e9', bg: 'color-mix(in srgb, #0ea5e9 12%, transparent)' },
  tablet:           { label: 'Tablet',          color: '#f97316', bg: 'color-mix(in srgb, #f97316 12%, transparent)' },
  'cross-viewport': { label: 'Cross-viewport',  color: '#ec4899', bg: 'color-mix(in srgb, #ec4899 12%, transparent)' },
  technical:        { label: 'Technical',       color: '#6b7280', bg: 'color-mix(in srgb, #6b7280 12%, transparent)' },
  'brand-dna':      { label: 'Brand DNA',       color: '#d97706', bg: 'color-mix(in srgb, #d97706 12%, transparent)' },
};

function ViewportChip({ viewport }: { viewport: string }) {
  const meta = VIEWPORT_CHIP_META[viewport];
  if (!meta) return null;
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-[0.03em]"
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.label}
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
  return (
    <CustomSelect
      value={value}
      onChange={onChange}
      options={options}
      label={label}
      isActive={value !== 'all'}
      size="sm"
    />
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

const FIX_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  html:    { bg: 'color-mix(in srgb, #3b82f6 12%, transparent)', color: '#3b82f6' },
  meta:    { bg: 'color-mix(in srgb, #8b5cf6 12%, transparent)', color: '#8b5cf6' },
  schema:  { bg: 'color-mix(in srgb, #06b6d4 12%, transparent)', color: '#06b6d4' },
  copy:    { bg: 'color-mix(in srgb, #10b981 12%, transparent)', color: '#10b981' },
  file:    { bg: 'color-mix(in srgb, #f59e0b 12%, transparent)', color: '#f59e0b' },
  config:  { bg: 'color-mix(in srgb, #6366f1 12%, transparent)', color: '#6366f1' },
  heading: { bg: 'color-mix(in srgb, #10b981 12%, transparent)', color: '#10b981' },
  design:  { bg: 'color-mix(in srgb, #ef4444 12%, transparent)', color: '#ef4444' },
};

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
  // Prefer fix_status from action model, fall back to legacy status
  const fixStatus = (finding as AuditFinding & { fix_status?: string }).fix_status;
  const displayStatus = fixStatus && fixStatus !== 'unreviewed' ? fixStatus : finding.status;
  const meta = STATUS_META[displayStatus] || STATUS_META.open;
  const host = hostnameOf(finding.page_url);
  const fixType = inferFixType(finding);
  const dbFix = (finding as AuditFinding & { fix_type?: string | null }).fix_type;
  const badgeLabel = dbFix || fixType;
  const badgeStyle = FIX_TYPE_COLORS[badgeLabel] || FIX_TYPE_COLORS.design;

  if (finding.dismissed) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left px-3 py-2 opacity-40"
        style={{ borderBottom: '1px solid var(--rule)' }}
      >
        <span className="text-[11px] line-through truncate block" style={{ color: 'var(--m-muted)' }}>
          {getDisplayTitle(finding)}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      data-finding-id={finding.id}
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
            {getDisplayTitle(finding)}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[10px]">
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
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-[0.04em]"
              style={{ background: badgeStyle.bg, color: badgeStyle.color }}
            >
              {badgeLabel}
            </span>
            <FindingEvidenceBadge finding={finding} />
            {(finding as any).viewport && (finding as any).viewport !== 'all' && (
              <ViewportChip viewport={(finding as any).viewport} />
            )}
            {(finding as any).status_in_audit === 'still_present' && (
              <span className="text-[9px] font-semibold text-m-muted bg-paper-2 px-1 py-0.5 rounded tracking-[0.03em] uppercase">Returning</span>
            )}
            {(finding as any).status_in_audit === 'improved' && (
              <span className="text-[9px] font-semibold text-ok bg-ok/10 px-1 py-0.5 rounded tracking-[0.03em] uppercase">Improved</span>
            )}
            {(finding as any).status_in_audit === 'regressed' && (
              <span className="text-[9px] font-semibold text-severe bg-severe/10 px-1 py-0.5 rounded tracking-[0.03em] uppercase">Regressed</span>
            )}
            {(finding as any).status_in_audit === 'fixed' && (
              <span className="text-[9px] font-semibold text-ok bg-ok/10 px-1 py-0.5 rounded tracking-[0.03em] uppercase">Fixed</span>
            )}
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
  allCrawledPages,
  onStatus,
  onDismiss,
}: {
  group: GroupedFinding;
  pending: boolean;
  ftpConnections: FtpConnectionSummary[];
  allCrawledPages: string[];
  onStatus: (id: string, status: FindingStatus) => void;
  onDismiss: (id: string, reason: string) => void;
}) {
  const finding = group.primary;
  const sevColor = severityColor(finding.severity);
  const meta = STATUS_META[finding.status] || STATUS_META.open;
  const moduleNames: string[] = group.affectedModuleIndices.filter((i) => i >= 0).map((i) => PHASE1_MODULES[i]);
  if (moduleNames.length === 0 && group.affectedModuleIndices.includes(-1)) moduleNames.push('General');
  const host = hostnameOf(finding.page_url);
  const whyMattersText = getWhyMatters(finding);
  const hasImpact = Boolean(whyMattersText && whyMattersText.trim());

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
          {getDisplayTitle(finding)}
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
              {getDisplayTitle(finding)}
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
              {finding.viewport && finding.viewport !== 'all' && (
                <>
                  <span style={{ color: 'var(--m-muted)' }} aria-hidden>·</span>
                  <ViewportChip viewport={finding.viewport} />
                </>
              )}
              <span style={{ color: 'var(--m-muted)' }} aria-hidden>·</span>
              <FindingEvidenceBadge finding={finding} />
              <FindingSourceLabel finding={finding} />
              <FindingSurfaceScope finding={finding} />
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
            {/* Status dropdown */}
            {(() => {
              const isActive = finding.status !== 'open';
              return (
                <CustomSelect
                  value={finding.status}
                  onChange={(v) => onStatus(finding.id, v as FindingStatus)}
                  options={STATUS_KEYS.map((sk) => ({ value: sk, label: STATUS_META[sk].label }))}
                  label="Finding status"
                  disabled={pending}
                  isActive={isActive}
                  activeBg={meta.dot}
                  activeBorder={meta.dot}
                  activeColor="#fff"
                  size="sm"
                />
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
        className="rounded-b-lg overflow-hidden"
        style={{ border: '1px solid var(--rule)', borderTop: 'none' }}
      >
        {/* What we found + Why it matters — light background zone */}
        <div className="px-5 pt-5 pb-5" style={{ background: 'color-mix(in srgb, var(--rule) 18%, transparent)' }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg p-4" style={{ background: '#ffffff', border: '1px solid var(--rule)' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] mb-2.5" style={{ color: sevColor }}>
                What we found
              </p>
              <div className="max-w-prose"><FindingText text={getWhatFound(finding)} /></div>
            </div>
            <div className="rounded-lg p-4" style={{ background: '#ffffff', border: '1px solid var(--rule)' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] mb-2.5" style={{ color: 'var(--warn)' }}>
                Why it matters
              </p>
              <div className="max-w-prose">
                {hasImpact ? (
                  <FindingText text={whyMattersText!} />
                ) : (
                  <p className="text-[12px] leading-[1.65] italic" style={{ color: 'var(--m-muted)' }}>
                    Business impact not captured for this finding.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Evidence panel — trust metadata for this finding */}
          <div className="mt-3">
            <FindingEvidencePanel finding={finding} />
          </div>
        </div>

        {/* Resolve — FixConsole with integrated preview panel */}
        <div className="px-5 py-5" style={{ background: '#ffffff' }}>
          <div>
            <h4 className="flex items-center gap-2 text-[18px] font-medium tracking-[-0.01em] mb-4" style={{ color: 'var(--ink)' }}>
              <Wrench size={17} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />
              Resolve this issue
            </h4>
            <FixConsole
              finding={finding}
              pending={pending}
              ftpConnections={ftpConnections}
              affectedPages={group.affectedPages}
              allCrawledPages={allCrawledPages}
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
  const { workspace, workspaceSlug, loading: wsLoading } = useWorkspace();
  const dashPrefix = workspaceSlug ? `/dashboard/${workspaceSlug}` : '/dashboard';
  const { bundle, loading: bundleLoading, updateFindingLocally, updateReportScore, invalidate } = useAuditBundle();
  const searchParams = useSearchParams();
  const loading = authLoading || wsLoading || bundleLoading || !bundle;
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [sevFilter, setSevFilter] = useState<typeof SEVERITIES[number]>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | FindingStatus | 'deferred'>('all');

  const [ftpConnections, setFtpConnections] = useState<FtpConnectionSummary[]>([]);
  const [ftpLoaded, setFtpLoaded] = useState(false);
  const sidebarListRef = useRef<HTMLDivElement>(null);

  // Hydrate filters from URL
  useEffect(() => {
    const sev = searchParams.get('severity');
    if (sev && (SEVERITIES as readonly string[]).includes(sev)) {
      setSevFilter(sev as typeof SEVERITIES[number]);
    }
    const mod = searchParams.get('module');
    if (mod && ((PHASE1_MODULES as readonly string[]).includes(mod) || mod === 'General')) {
      setModuleFilter(mod);
    }
    const status = searchParams.get('status');
    if (status && (STATUS_KEYS as readonly string[]).includes(status)) {
      setStatusFilter(status as FindingStatus);
    }
  }, [searchParams]);

  // Load FTP connections
  useEffect(() => {
    if (authLoading || !user || wsLoading) return;
    const siteHost = workspace?.primary_domain || null;
    const url = siteHost ? `/api/ftp?siteHost=${encodeURIComponent(siteHost)}` : '/api/ftp';
    fetch(url)
      .then(async (res) => {
        if (res.status === 503) { setFtpConnections([]); return; }
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        setFtpConnections((data as { connections?: FtpConnectionSummary[] })?.connections || []);
      })
      .catch(() => setFtpConnections([]))
      .finally(() => setFtpLoaded(true));
  }, [authLoading, user, wsLoading, workspace]);

  // Deep link via #finding-<id> — auto-select the referenced finding.
  // Sets deepLinkHonoured ref so the auto-select effect doesn't
  // immediately overwrite with filteredGroups[0].
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const apply = () => {
      const raw = window.location.hash.replace(/^#/, '');
      const m = raw.match(/^finding-(.+)$/);
      if (!m) return;
      deepLinkHonoured.current = true;
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
    return [...grouped].sort(reconciliationAwareSort);
  }, [bundle]);

  // All unique crawled pages across the entire audit — used for batch fixes
  // that target every page (e.g. lang attribute, viewport meta).
  // Deduplicates extensionless URL variants: /privacy and /privacy.html → keep /privacy.html
  // Deduplicates trailing slash variants: / appearing twice → keep one
  const allCrawledPages = useMemo(() => {
    if (!bundle) return [];
    const urls = new Set<string>();
    for (const f of bundle.findings) {
      if (f.page_url) urls.add(f.page_url);
    }
    // Normalize: prefer .html variant over extensionless
    const normalized = new Map<string, string>();
    for (const url of urls) {
      let pathname: string;
      try { pathname = new URL(url).pathname; } catch { pathname = url; }
      // Create a canonical key: strip trailing slash, strip .html extension
      const key = pathname.replace(/\/+$/, '').replace(/\.html?$/i, '') || '/';
      const existing = normalized.get(key);
      if (!existing) {
        normalized.set(key, url);
      } else {
        // Prefer the one with .html extension (it's the real file)
        const existingHasExt = /\.\w{2,5}$/.test(existing);
        const currentHasExt = /\.\w{2,5}$/.test(url);
        if (currentHasExt && !existingHasExt) {
          normalized.set(key, url);
        }
      }
    }
    return Array.from(normalized.values());
  }, [bundle]);

  const stats = useMemo(() => {
    const s: Record<string, number> = { open: 0, in_progress: 0, fixed: 0, backlog: 0, deferred: 0 };
    for (const g of groups) {
      const fs = (g.primary as AuditFinding & { fix_status?: string }).fix_status;
      if (fs === 'deferred') { s.deferred++; continue; }
      s[g.primary.status]++;
    }
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
      // Count named modules
      const names = g.affectedModuleIndices.filter((i) => i >= 0).map((i) => PHASE1_MODULES[i]);
      for (const n of names) out[n] = (out[n] || 0) + 1;
      // Count uncategorized findings (module index -1) under "General"
      if (g.affectedModuleIndices.includes(-1) || g.affectedModuleIndices.every((i) => i < 0)) {
        out['General'] = (out['General'] || 0) + 1;
      }
    }
    return out;
  }, [groups]);

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const f = g.primary;
      const fs = (f as AuditFinding & { fix_status?: string }).fix_status;
      // Handle 'deferred' as a virtual status filter
      if (statusFilter === 'deferred' as string) {
        if (fs !== 'deferred') return false;
      } else if (statusFilter !== 'all') {
        if (f.status !== statusFilter) return false;
        // Exclude deferred findings from non-deferred status views
        if (fs === 'deferred') return false;
      }
      if (sevFilter !== 'all' && f.severity !== sevFilter) return false;
      if (moduleFilter !== 'all') {
        if (moduleFilter === 'General') {
          // "General" matches findings with any -1 module index (uncategorized)
          if (!g.affectedModuleIndices.includes(-1) && !g.affectedModuleIndices.every((i) => i < 0)) return false;
        } else {
          const names = g.affectedModuleIndices.filter((i) => i >= 0).map((i) => PHASE1_MODULES[i]);
          if (!names.includes(moduleFilter as (typeof PHASE1_MODULES)[number])) return false;
        }
      }
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${f.title} ${f.description} ${f.recommendation || ''} ${f.page_url || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [groups, query, moduleFilter, sevFilter, statusFilter]);

  // Track whether the hash deep-link has been honoured this session.
  // We use a ref so it persists across renders without triggering effects.
  const deepLinkHonoured = React.useRef(false);

  // Track status changes so we don't reset the active finding when a deploy
  // causes the finding to move or the bundle to re-fetch.
  const statusChangeInFlight = React.useRef(false);

  // Auto-select first finding when groups load and nothing is active,
  // or when the active finding is no longer visible due to filter changes.
  // CRITICAL: skip if a deep-link hash just set activeFindingId — otherwise
  // we immediately overwrite the hash target with filteredGroups[0].
  useEffect(() => {
    if (filteredGroups.length === 0) return;
    const stillVisible = activeFindingId && filteredGroups.some((g) => g.primary.id === activeFindingId);
    if (stillVisible) {
      deepLinkHonoured.current = false; // clear — we found it
      return;
    }
    // If a deep-link was set but bundle just loaded, give it one cycle
    // to see if the target appears in the new filteredGroups
    if (deepLinkHonoured.current) {
      deepLinkHonoured.current = false;
      return;
    }
    // If we just changed a finding's status (e.g., deployed → fixed), the
    // finding might temporarily disappear from filteredGroups while the
    // bundle re-fetches. Check the FULL groups list — if the finding exists
    // there (just filtered out by status), stay put instead of jumping.
    if (statusChangeInFlight.current && activeFindingId) {
      const existsInAll = groups.some((g) => g.primary.id === activeFindingId);
      if (existsInAll) {
        statusChangeInFlight.current = false;
        return;
      }
    }
    statusChangeInFlight.current = false;
    setActiveFindingId(filteredGroups[0].primary.id);
  }, [filteredGroups, activeFindingId, groups]);

  const activeGroup = useMemo(
    () => filteredGroups.find((g) => g.primary.id === activeFindingId) || null,
    [filteredGroups, activeFindingId],
  );

  // Scroll the active sidebar item into view
  useEffect(() => {
    if (!activeFindingId || !sidebarListRef.current) return;
    const el = sidebarListRef.current.querySelector(`[data-finding-id="${activeFindingId}"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeFindingId]);

  const handleStatus = async (id: string, status: FindingStatus) => {
    const prev = bundle?.findings.find((f) => f.id === id)?.status;
    statusChangeInFlight.current = true;
    setPending((p) => ({ ...p, [id]: true }));
    // Optimistic update via shared context — all consumers see it instantly
    updateFindingLocally(id, { status });
    try {
      const res = await fetch(`/api/findings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        if (prev) updateFindingLocally(id, { status: prev });
      } else {
        // Consume scoreUpdate from the API response (BUG 2 fix)
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        if (data?.scoreUpdate?.newScore != null) {
          updateReportScore(data.scoreUpdate.newScore);
        }
        // Reconcile with server truth after a short delay
        // (gives DB triggers time to settle)
        setTimeout(invalidate, 500);
      }
    } catch {
      if (prev) updateFindingLocally(id, { status: prev });
    } finally {
      setPending((p) => ({ ...p, [id]: false }));
    }
  };

  const handleDismiss = async (id: string, reason: string) => {
    statusChangeInFlight.current = true;
    setPending((p) => ({ ...p, [id]: true }));
    const trimmed = reason.trim() || 'Dismissed from Fix queue';
    try {
      const res = await fetch(`/api/findings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismiss: true, dismissal_reason: trimmed }),
      });
      if (res.ok) {
        // Optimistic update via shared context
        updateFindingLocally(id, { dismissed: true, dismissal_reason: trimmed, dismissed_at: new Date().toISOString() });
        // Consume scoreUpdate (BUG 6 fix)
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        if (data?.scoreUpdate?.newScore != null) {
          updateReportScore(data.scoreUpdate.newScore);
        }
        setTimeout(invalidate, 500);
      }
    } catch {} finally {
      setPending((p) => ({ ...p, [id]: false }));
    }
  };

  if (loading) {
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
          subtitle={workspace ? 'No audit for this workspace yet.' : 'Run an audit to get your fix queue.'}
        />
        <EmptyAudit
          title="No fixes ready"
          body="Run your first audit. Fixpath will turn every finding into a concrete fix you can deploy, export, or hand off."
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

      {/* Trust layer — page-level confidence strip */}
      <AuditConfidenceStrip
        findings={bundle.findings}
        crawlSummary={(bundle.audit as any)?.crawl_summary as CrawlSummary | null ?? null}
        className="mb-4"
      />

      {groups.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => {
              const exportFindings = prepareFindingsForExport(filteredGroups, PHASE1_MODULES);
              const siteName = workspace?.primary_domain || workspace?.name || 'brand';
              const siteHostname = workspace?.primary_domain || '';
              const auditDate = bundle.audit?.completed_at || bundle.audit?.created_at || new Date().toISOString();
              const auditId = bundle.audit?.id || 'unknown';

              // Run the full export pipeline: dedup → enrich → classify → group
              const { clusters, originalCount, uniqueCount } = processExportPipeline(exportFindings, siteHostname);

              // Build metadata from the deduplicated findings
              const dedupedFindings = clusters.flatMap((c) => c.members);
              const meta = buildExportMeta(dedupedFindings, siteName, auditDate, auditId, { originalCount, uniqueCount });
              const md = renderMarkdown(dedupedFindings, meta, clusters);

              const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const hostname = workspace?.primary_domain || 'brand';
              const dateStr = new Date().toISOString().slice(0, 10);
              const a = document.createElement('a');
              a.href = url;
              a.download = `fixpath-fixes-${hostname}-${dateStr}.md`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors"
            style={{
              border: '1px solid var(--rule)',
              color: 'var(--ink)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Download size={13} strokeWidth={1.75} />
            Export fixes
          </button>
        </div>
      )}

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
            href={`${dashPrefix}/new-audit`}
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
                allCrawledPages={allCrawledPages}
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
                      ...(stats.deferred > 0 ? [{ value: 'deferred', label: `Deferred (${stats.deferred})` }] : []),
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
                      ...(moduleCounts['General'] ? [{ value: 'General', label: `General (${moduleCounts['General']})` }] : []),
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
              <div ref={sidebarListRef} className="max-h-[calc(100vh-220px)] overflow-y-auto">
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
