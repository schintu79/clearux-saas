'use client';

/**
 * /dashboard — global, multi-brand overview.
 *
 * Parent-level destination that summarizes everything across all of the
 * user's brands and sites: portfolio health, recent audits, totals, and
 * entry points to My Audits and per-brand workspaces. Never scoped to
 * the currently-selected brand — that surface lives at /dashboard/overview.
 *
 * Stripe's `?credits=purchased` callback still lands here (we forward
 * to /dashboard/overview so the credits banner there still fires).
 */

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Globe,
  Fingerprint,
  PlusCircle,
  FileSearch,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  ChevronDown,
  Activity,
  Layers,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import {
  writeSelection,
  selectionFromSidebarId,
} from '@/lib/dashboard/brand-selection';
import PageHeader from '@/components/dashboard/v2/PageHeader';
import SectionHeader from '@/components/dashboard/v2/SectionHeader';
import DashCard from '@/components/dashboard/v2/DashCard';
import StatCard from '@/components/dashboard/v2/StatCard';
import ActionLink from '@/components/dashboard/v2/ActionLink';
import { scoreColor, formatDate, hostOf } from '@/components/dashboard/v2/score-utils';

interface DashboardStats {
  totalAudits: number;
  completedAudits: number;
  avgScore: number | null;
  totalFindings: number;
  fixedFindings: number;
  severityBreakdown: { critical: number; high: number; medium: number; low: number };
  recentScores: Array<{ url: string; score: number; date: string }>;
}

interface AuditSummary {
  id: string;
  url: string;
  score: number | null;
  completedAt: string | null;
}

interface BrandRow {
  kind: 'site' | 'brand';
  sidebarId: string; // for selection: "site:<host>" or "brand:<uuid>"
  name: string;
  latestScore: number | null;
  priorScore: number | null;
  lastAuditAt: string | null;
  latestAuditId: string | null;
  auditCount: number;
  audits: AuditSummary[];
}

/* scoreColor, formatDate, hostOf imported from v2/score-utils */

function DashboardInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [rows, setRows] = useState<BrandRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Preserve Stripe credits-purchased callback by forwarding to Overview,
  // which is where that banner has always lived.
  useEffect(() => {
    if (searchParams.get('credits') === 'purchased') {
      router.replace(`/dashboard/competitors?${searchParams.toString()}`);
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const supabase = createBrowserSupabase();
        const [statsRes, { data: audits }, brandsRes] = await Promise.all([
          fetch('/api/dashboard/stats').then((r) => r.ok ? r.json() : null).catch(() => null),
          supabase
            .from('audits')
            .select('id, product_url, status, completed_at, brand_identity_id, audit_type')
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .order('completed_at', { ascending: false, nullsFirst: false } as any)
            .limit(200),
          fetch('/api/brand-identities').then((r) => r.ok ? r.json() : { identities: [] }).catch(() => ({ identities: [] })),
        ]);
        if (cancelled) return;

        if (statsRes) setStats(statsRes as DashboardStats);

        const auditRows = (audits || []) as any[];
        const completed = auditRows.filter((a) => a.status === 'completed');
        const websiteAudits = completed.filter((a) => !a.audit_type || a.audit_type === 'website');

        const byDomain = new Map<string, any[]>();
        for (const a of websiteAudits) {
          const host = hostOf(a.product_url);
          if (!host) continue;
          if (!byDomain.has(host)) byDomain.set(host, []);
          byDomain.get(host)!.push(a);
        }

        const allIds = completed.map((a) => a.id);
        let reportMap = new Map<string, any>();
        if (allIds.length) {
          const { data: reports } = await supabase
            .from('reports')
            .select('audit_id, overall_score')
            .in('audit_id', allIds);
          for (const r of (reports || []) as any[]) reportMap.set(r.audit_id, r);
        }

        const siteRows: BrandRow[] = [];
        for (const [host, list] of byDomain.entries()) {
          const latest = list[0];
          const prior = list[1];
          siteRows.push({
            kind: 'site',
            sidebarId: `site:${host}`,
            name: host,
            latestScore: reportMap.get(latest.id)?.overall_score ?? null,
            priorScore: prior ? (reportMap.get(prior.id)?.overall_score ?? null) : null,
            lastAuditAt: latest.completed_at,
            latestAuditId: latest.id,
            auditCount: list.length,
            audits: list.map((a) => ({
              id: a.id,
              url: a.product_url,
              score: reportMap.get(a.id)?.overall_score ?? null,
              completedAt: a.completed_at,
            })),
          });
        }

        const brandList = ((brandsRes?.identities || []) as any[]);
        const brandRows: BrandRow[] = brandList.map((b) => {
          const brandAudits = completed.filter((a) => a.brand_identity_id === b.id);
          const latest = brandAudits[0];
          const prior = brandAudits[1];
          return {
            kind: 'brand' as const,
            sidebarId: `brand:${b.id}`,
            name: b.name || 'Untitled brand',
            latestScore: latest ? (reportMap.get(latest.id)?.overall_score ?? null) : null,
            priorScore: prior ? (reportMap.get(prior.id)?.overall_score ?? null) : null,
            lastAuditAt: latest?.completed_at || null,
            latestAuditId: latest?.id || null,
            auditCount: brandAudits.length,
            audits: brandAudits.map((a) => ({
              id: a.id,
              url: a.product_url,
              score: reportMap.get(a.id)?.overall_score ?? null,
              completedAt: a.completed_at,
            })),
          };
        });

        const all = [...siteRows, ...brandRows].sort((a, b) => {
          // Highest risk first: lowest score wins; null scores fall to bottom.
          const sa = a.latestScore == null ? 999 : a.latestScore;
          const sb = b.latestScore == null ? 999 : b.latestScore;
          return sa - sb;
        });
        setRows(all);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading, user]);

  const openIssues = useMemo(() => {
    if (!stats) return 0;
    const s = stats.severityBreakdown;
    return s.critical + s.high + s.medium + s.low - stats.fixedFindings;
  }, [stats]);

  const totalBrandsAndSites = rows.length;
  const portfolioAvgScore = useMemo(() => {
    const scored = rows.filter((r) => r.latestScore != null);
    if (scored.length === 0) return null;
    return Math.round(scored.reduce((sum, r) => sum + (r.latestScore as number), 0) / scored.length);
  }, [rows]);

  const handleOpenWorkspace = (row: BrandRow) => {
    writeSelection(selectionFromSidebarId(row.sidebarId));
    router.push('/dashboard/competitors');
  };

  /* ── Delete state ──────────────────────────────────────── */
  const [deleteTarget, setDeleteTarget] = useState<BrandRow | null>(null);
  const [deleteAuditTarget, setDeleteAuditTarget] = useState<{ audit: AuditSummary; parentRow: BrandRow } | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const handleDeleteBrandOrSite = useCallback(async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === 'brand') {
        const brandId = deleteTarget.sidebarId.replace('brand:', '');
        const res = await fetch(`/api/brand-identities/${brandId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete brand');
      } else {
        const domain = deleteTarget.sidebarId.replace('site:', '');
        const res = await fetch('/api/sites/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain }),
        });
        if (!res.ok) throw new Error('Failed to delete site');
      }
      setRows((prev) => prev.filter((r) => r.sidebarId !== deleteTarget.sidebarId));
      setDeleteTarget(null);
      setConfirmText('');
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, deleting]);

  const handleDeleteAudit = useCallback(async () => {
    if (!deleteAuditTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/audits/${deleteAuditTarget.audit.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete audit');
      setRows((prev) =>
        prev.map((r) => {
          if (r.sidebarId !== deleteAuditTarget.parentRow.sidebarId) return r;
          const remaining = r.audits.filter((a) => a.id !== deleteAuditTarget.audit.id);
          if (remaining.length === 0) return null as any;
          const latest = remaining[0];
          return {
            ...r,
            audits: remaining,
            auditCount: remaining.length,
            latestScore: latest.score,
            lastAuditAt: latest.completedAt,
            latestAuditId: latest.id,
            priorScore: remaining[1]?.score ?? null,
          };
        }).filter(Boolean),
      );
      setDeleteAuditTarget(null);
    } catch (err) {
      console.error('Delete audit error:', err);
    } finally {
      setDeleting(false);
    }
  }, [deleteAuditTarget, deleting]);

  if (authLoading || loading) {
    return <DashboardSkeleton />;
  }

  // Empty state — no audits yet.
  if (totalBrandsAndSites === 0 && (stats?.totalAudits ?? 0) === 0) {
    return (
      <div className="max-w-5xl mx-auto">
        <PageHeader
          icon={<Activity size={18} />}
          title="Dashboard"
          subtitle="See which brands need attention and where to focus next."
        >
          <ActionLink href="/dashboard/new-audit" icon={PlusCircle}>Add new site or brand</ActionLink>
        </PageHeader>
        <DashCard dashed className="p-10 text-center">
          <FileSearch size={28} className="mx-auto mb-3" style={{ color: 'var(--m-muted)' }} />
          <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--ink)' }}>
            Audit your first site or brand
          </h2>
          <p className="text-[13px] mb-5" style={{ color: 'var(--m-muted)' }}>
            Run your first audit to find what is hurting your site and get a clear path to fix it.
          </p>
          <ActionLink href="/dashboard/new-audit" icon={PlusCircle}>Get started</ActionLink>
        </DashCard>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        icon={<Activity size={18} />}
        title="Dashboard"
        subtitle="See which brands need attention and where to focus next."
      >
        <ActionLink href="/dashboard/new-audit" icon={PlusCircle}>Add new site or brand</ActionLink>
      </PageHeader>

      {/* Headline stats — at-a-glance portfolio numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={Layers}
          label="Brands & sites"
          value={String(totalBrandsAndSites)}
          tone="ink"
        />
        <StatCard
          icon={FileSearch}
          label="Audits run"
          value={String(stats?.totalAudits ?? 0)}
          tone="ink"
          hint={stats?.completedAudits != null ? `${stats.completedAudits} completed` : undefined}
        />
        <StatCard
          icon={Activity}
          label="Portfolio avg"
          value={portfolioAvgScore != null ? `${portfolioAvgScore}` : '—'}
          tone={portfolioAvgScore == null ? 'muted' : portfolioAvgScore >= 70 ? 'ok' : portfolioAvgScore >= 40 ? 'warn' : 'severe'}
          hint="Website Health Score"
        />
        <StatCard
          icon={AlertTriangle}
          label="Open issues"
          value={String(openIssues)}
          tone={openIssues === 0 ? 'ok' : openIssues > 25 ? 'severe' : 'warn'}
          hint={stats?.severityBreakdown.critical ? `${stats.severityBreakdown.critical} critical` : undefined}
        />
      </div>

      {/* Portfolio — every brand/site with its latest score */}
      <SectionHeader title="Your brands & sites">
        <Link
          href="/dashboard/audits"
          className="inline-flex items-center gap-0.5 hover:underline"
        >
          My Audits <ChevronRight size={11} />
        </Link>
      </SectionHeader>

      {totalBrandsAndSites === 0 ? (
        <DashCard dashed className="p-5 text-[13px]" style={{ color: 'var(--m-muted)' }}>
          You have audits but no brands or sites grouped yet. Run a new audit to get started.
        </DashCard>
      ) : (
        <DashCard padding="none" className="overflow-hidden mb-6">
          <div className="divide-y" style={{ borderColor: 'var(--rule)' }}>
            {rows.map((row) => {
              const Icon = row.kind === 'brand' ? Fingerprint : Globe;
              const delta = row.latestScore != null && row.priorScore != null
                ? row.latestScore - row.priorScore
                : null;
              const DeltaIcon = delta == null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
              const deltaColor = delta == null || delta === 0
                ? 'var(--m-muted)'
                : delta > 0 ? 'var(--ok)' : 'var(--severe)';
              const isExpanded = expandedRow === row.sidebarId;
              return (
                <div key={row.sidebarId}>
                  <div className="flex items-center">
                    {/* Expand toggle */}
                    {row.audits.length > 0 && (
                      <button
                        onClick={() => setExpandedRow(isExpanded ? null : row.sidebarId)}
                        className="pl-3 pr-1 py-3 flex-shrink-0 transition-colors hover:bg-black/[0.02]"
                        aria-label={isExpanded ? 'Collapse audit history' : 'Expand audit history'}
                      >
                        <ChevronDown
                          size={12}
                          className={`transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                          style={{ color: 'var(--m-muted)' }}
                        />
                      </button>
                    )}
                    {/* Main row — clickable to open workspace */}
                    <button
                      onClick={() => handleOpenWorkspace(row)}
                      className={`flex-1 flex items-center gap-3 ${row.audits.length > 0 ? 'pl-1' : 'pl-4'} pr-2 py-3 text-left transition-colors hover:bg-black/[0.02]`}
                    >
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--paper-2)', color: 'var(--m-muted)' }}
                      >
                        <Icon size={14} strokeWidth={1.75} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                          {row.name}
                        </p>
                        <p className="text-[11px] truncate" style={{ color: 'var(--m-muted)' }}>
                          {row.auditCount > 0
                            ? `${row.auditCount} audit${row.auditCount === 1 ? '' : 's'} · Last: ${formatDate(row.lastAuditAt)}`
                            : row.kind === 'brand' ? 'No audits yet' : '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {row.latestScore != null ? (
                          <span className="text-[14px] font-semibold tabular-nums" style={{ color: scoreColor(row.latestScore) }}>
                            {row.latestScore}
                          </span>
                        ) : (
                          <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>—</span>
                        )}
                        {delta != null && (
                          <span className="text-[11px] inline-flex items-center gap-0.5 tabular-nums" style={{ color: deltaColor }}>
                            <DeltaIcon size={11} />
                            {delta > 0 ? '+' : ''}{delta}
                          </span>
                        )}
                        <ChevronRight size={12} style={{ color: 'var(--m-muted)' }} />
                      </div>
                    </button>
                    {/* Delete button */}
                    <button
                      onClick={() => { setDeleteTarget(row); setConfirmText(''); }}
                      className="px-3 py-3 flex-shrink-0 transition-colors hover:bg-black/[0.02] group/del"
                      aria-label={`Delete ${row.name}`}
                    >
                      <Trash2 size={13} className="transition-colors" style={{ color: 'var(--m-muted)' }} />
                    </button>
                  </div>

                  {/* Expanded audit list */}
                  {isExpanded && row.audits.length > 0 && (
                    <div
                      className="border-t"
                      style={{ borderColor: 'var(--rule)', background: 'color-mix(in srgb, var(--paper-2) 50%, transparent)' }}
                    >
                      {row.audits.map((audit) => (
                        <div
                          key={audit.id}
                          className="flex items-center gap-3 pl-12 pr-4 py-2 border-b last:border-b-0"
                          style={{ borderColor: 'color-mix(in srgb, var(--rule) 50%, transparent)' }}
                        >
                          <FileSearch size={11} style={{ color: 'var(--m-muted)' }} className="flex-shrink-0" />
                          <span className="text-[12px] font-medium truncate flex-1 min-w-0" style={{ color: 'var(--ink)' }}>
                            {hostOf(audit.url) || audit.url}
                          </span>
                          <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--m-muted)' }}>
                            {formatDate(audit.completedAt)}
                          </span>
                          {audit.score != null && (
                            <span className="text-[12px] font-semibold tabular-nums w-8 text-right flex-shrink-0" style={{ color: scoreColor(audit.score) }}>
                              {audit.score}
                            </span>
                          )}
                          <button
                            onClick={() => setDeleteAuditTarget({ audit, parentRow: row })}
                            className="p-1 rounded-md transition-colors hover:bg-black/[0.04] flex-shrink-0"
                            aria-label="Delete this audit"
                          >
                            <Trash2 size={11} style={{ color: 'var(--m-muted)' }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DashCard>
      )}

      {/* Recent activity */}
      {stats?.recentScores && stats.recentScores.length > 0 && (
        <>
          <SectionHeader title="Recent audits">
            <Link
              href="/dashboard/audits"
              className="inline-flex items-center gap-0.5 hover:underline"
            >
              View all <ChevronRight size={11} />
            </Link>
          </SectionHeader>
          <DashCard padding="none" className="overflow-hidden">
            <div className="divide-y" style={{ borderColor: 'var(--rule)' }}>
              {stats.recentScores.slice().reverse().map((r, i) => {
                const host = hostOf(r.url);
                return (
                  <Link
                    key={`${r.url}-${r.date}-${i}`}
                    href="/dashboard/audits"
                    className="flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-black/[0.02]"
                  >
                    <Globe size={12} style={{ color: 'var(--m-muted)' }} className="flex-shrink-0" />
                    <span className="text-[12px] font-medium truncate flex-1 min-w-0" style={{ color: 'var(--ink)' }}>
                      {host || r.url}
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                      {formatDate(r.date)}
                    </span>
                    <span className="text-[12px] font-semibold tabular-nums w-8 text-right" style={{ color: scoreColor(r.score) }}>
                      {r.score}
                    </span>
                  </Link>
                );
              })}
            </div>
          </DashCard>
        </>
      )}

      {/* ── Delete brand/site confirmation modal ──────────── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => { setDeleteTarget(null); setConfirmText(''); }}
        >
          <div
            className="rounded-xl p-6 w-full max-w-md shadow-xl"
            style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'color-mix(in srgb, var(--severe) 10%, transparent)', color: 'var(--severe)' }}
                >
                  <Trash2 size={15} />
                </span>
                <h3 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
                  Delete {deleteTarget.kind === 'brand' ? 'brand' : 'site'}
                </h3>
              </div>
              <button
                onClick={() => { setDeleteTarget(null); setConfirmText(''); }}
                className="p-1 rounded-md transition-colors hover:bg-black/[0.04]"
              >
                <X size={14} style={{ color: 'var(--m-muted)' }} />
              </button>
            </div>

            <div
              className="rounded-lg p-3 mb-4"
              style={{ background: 'color-mix(in srgb, var(--severe) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--severe) 15%, transparent)' }}
            >
              <p className="text-[12px] font-semibold mb-1" style={{ color: 'var(--severe)' }}>
                This action cannot be undone
              </p>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                {deleteTarget.kind === 'brand'
                  ? `Deleting "${deleteTarget.name}" will permanently remove the brand and all ${deleteTarget.auditCount} associated audit${deleteTarget.auditCount === 1 ? '' : 's'}, including reports, findings, scores, and AI intelligence data. This data will be scheduled for permanent removal after 30 days.`
                  : `Deleting "${deleteTarget.name}" will permanently remove all ${deleteTarget.auditCount} audit${deleteTarget.auditCount === 1 ? '' : 's'} for this domain, including reports, findings, scores, and AI intelligence data. This data will be scheduled for permanent removal after 30 days.`
                }
              </p>
            </div>

            <label className="block mb-4">
              <span className="text-[12px] font-medium block mb-1.5" style={{ color: 'var(--ink)' }}>
                Type <strong>DELETE</strong> to confirm
              </span>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-colors"
                style={{
                  background: 'var(--paper-2)',
                  border: '1px solid var(--rule)',
                  color: 'var(--ink)',
                }}
                autoFocus
              />
            </label>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => { setDeleteTarget(null); setConfirmText(''); }}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-black/[0.04]"
                style={{ color: 'var(--ink)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteBrandOrSite}
                disabled={confirmText !== 'DELETE' || deleting}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-40"
                style={{
                  background: confirmText === 'DELETE' ? 'var(--severe)' : 'color-mix(in srgb, var(--severe) 40%, transparent)',
                  color: '#fff',
                }}
              >
                {deleting ? 'Deleting...' : `Delete ${deleteTarget.kind === 'brand' ? 'brand' : 'site'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete single audit confirmation modal ────────── */}
      {deleteAuditTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setDeleteAuditTarget(null)}
        >
          <div
            className="rounded-xl p-6 w-full max-w-md shadow-xl"
            style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'color-mix(in srgb, var(--warn) 10%, transparent)', color: 'var(--warn)' }}
                >
                  <Trash2 size={15} />
                </span>
                <h3 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
                  Delete audit
                </h3>
              </div>
              <button
                onClick={() => setDeleteAuditTarget(null)}
                className="p-1 rounded-md transition-colors hover:bg-black/[0.04]"
              >
                <X size={14} style={{ color: 'var(--m-muted)' }} />
              </button>
            </div>

            <p className="text-[13px] leading-relaxed mb-4" style={{ color: 'var(--ink)' }}>
              This will remove the audit from <strong>{formatDate(deleteAuditTarget.audit.completedAt)}</strong>
              {deleteAuditTarget.audit.score != null && <> (score: {deleteAuditTarget.audit.score})</>} and all its associated
              report data, findings, and scores. The data will be scheduled for permanent removal after 30 days.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteAuditTarget(null)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-black/[0.04]"
                style={{ color: 'var(--ink)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAudit}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-40"
                style={{ background: 'var(--severe)', color: '#fff' }}
              >
                {deleting ? 'Deleting...' : 'Delete audit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Header and StatCard removed — now using shared v2/PageHeader, v2/StatCard, v2/ActionLink */

function DashboardSkeleton() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="h-8 w-48 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
      <div className="h-5 w-72 rounded-md animate-pulse mb-6" style={{ background: 'var(--paper-2)' }} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[88px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />
        ))}
      </div>
      <div className="h-[220px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardInner />
    </Suspense>
  );
}
