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

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Globe,
  Fingerprint,
  PlusCircle,
  FileSearch,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Activity,
  Layers,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import {
  writeSelection,
  selectionFromSidebarId,
} from '@/lib/dashboard/brand-selection';

interface DashboardStats {
  totalAudits: number;
  completedAudits: number;
  avgScore: number | null;
  totalFindings: number;
  fixedFindings: number;
  severityBreakdown: { critical: number; high: number; medium: number; low: number };
  recentScores: Array<{ url: string; score: number; date: string }>;
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
}

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d));
}

function scoreColor(s: number | null): string {
  if (s == null) return 'var(--m-muted)';
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
}

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
      router.replace(`/dashboard/overview?${searchParams.toString()}`);
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
    router.push('/dashboard/overview');
  };

  if (authLoading || loading) {
    return <DashboardSkeleton />;
  }

  // Empty state — no audits yet.
  if (totalBrandsAndSites === 0 && (stats?.totalAudits ?? 0) === 0) {
    return (
      <div className="max-w-5xl mx-auto">
        <Header />
        <div
          className="rounded-2xl p-10 text-center"
          style={{ background: 'var(--card)', border: '1px dashed var(--rule)' }}
        >
          <FileSearch size={28} className="mx-auto mb-3" style={{ color: 'var(--m-muted)' }} />
          <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--ink)' }}>
            No audits yet
          </h2>
          <p className="text-[13px] mb-5" style={{ color: 'var(--m-muted)' }}>
            Run your first audit to see your Brand Health Score and a roadmap of fixes.
          </p>
          <Link
            href="/dashboard/new-audit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            <PlusCircle size={14} /> New audit
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Header />

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
          hint="Brand Health Score"
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
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Your brands & sites</h2>
        <Link
          href="/dashboard/audits"
          className="text-[12px] inline-flex items-center gap-0.5 hover:underline"
          style={{ color: 'var(--m-muted)' }}
        >
          My Audits <ChevronRight size={11} />
        </Link>
      </div>

      {totalBrandsAndSites === 0 ? (
        <div
          className="rounded-xl p-5 text-[13px]"
          style={{ background: 'var(--card)', border: '1px dashed var(--rule)', color: 'var(--m-muted)' }}
        >
          You have audits but no brands or sites grouped yet. Run a new audit to get started.
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden mb-6" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
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
              return (
                <button
                  key={row.sidebarId}
                  onClick={() => handleOpenWorkspace(row)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.02]"
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
              );
            })}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {stats?.recentScores && stats.recentScores.length > 0 && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Recent audits</h2>
            <Link
              href="/dashboard/audits"
              className="text-[12px] inline-flex items-center gap-0.5 hover:underline"
              style={{ color: 'var(--m-muted)' }}
            >
              View all <ChevronRight size={11} />
            </Link>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
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
          </div>
        </>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-medium font-sans tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
          Dashboard
        </h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
          Everything across your brands and sites. Pick one to open its workspace.
        </p>
      </div>
      <Link
        href="/dashboard/new-audit"
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90"
        style={{ background: 'var(--ink)', color: 'var(--paper)' }}
      >
        <PlusCircle size={13} /> New audit
      </Link>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  tone: 'ink' | 'ok' | 'warn' | 'severe' | 'muted';
}) {
  const valueColor =
    tone === 'ok' ? 'var(--ok)' :
    tone === 'warn' ? 'var(--warn)' :
    tone === 'severe' ? 'var(--severe)' :
    tone === 'muted' ? 'var(--m-muted)' : 'var(--ink)';
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
      <div className="flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--m-muted)' }}>
        <Icon size={12} strokeWidth={1.75} />
        <span className="text-[11px] uppercase tracking-wide font-medium">{label}</span>
      </div>
      <p className="text-2xl font-semibold tabular-nums leading-none" style={{ color: valueColor }}>
        {value}
      </p>
      {hint && (
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--m-muted)' }}>{hint}</p>
      )}
    </div>
  );
}

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
