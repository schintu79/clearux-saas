'use client';

import React, { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Globe,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Zap,
  FileSearch,
  ExternalLink,
  ChevronRight,
  Fingerprint,
  PenTool,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import Badge from '@/components/ui/Badge';
import type { Audit, AuditType, Report } from '@/types/database';

/* ── Helpers ───────────────────────────────────────────────── */

interface AuditWithReport extends Audit {
  report: Report | null;
  brandName?: string | null;
}

const websiteStatusMeta: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending_payment:   { label: 'Awaiting payment', color: 'pending',   icon: Clock },
  payment_received:  { label: 'Queued',            color: 'active',    icon: Zap },
  crawling:          { label: 'Crawling...',       color: 'active',    icon: Globe },
  analysing:         { label: 'Analysing...',      color: 'active',    icon: Sparkles },
  generating_report: { label: 'Generating...',     color: 'active',    icon: FileSearch },
  completed:         { label: 'Completed',         color: 'completed', icon: CheckCircle2 },
  failed:            { label: 'Failed',            color: 'failed',    icon: AlertTriangle },
};

const brandStatusMeta: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending_payment:   { label: 'Awaiting payment',   color: 'pending',   icon: Clock },
  payment_received:  { label: 'Queued',              color: 'active',    icon: Zap },
  crawling:          { label: 'Extracting...',       color: 'active',    icon: FileSearch },
  analysing:         { label: 'Analyzing...',        color: 'active',    icon: Sparkles },
  generating_report: { label: 'Generating report...', color: 'active',  icon: FileSearch },
  completed:         { label: 'Completed',           color: 'completed', icon: CheckCircle2 },
  failed:            { label: 'Failed',              color: 'failed',    icon: AlertTriangle },
};

function getStatusMeta(status: string, auditType?: string) {
  const meta = auditType === 'brand_identity' ? brandStatusMeta : websiteStatusMeta;
  return meta[status] || websiteStatusMeta.pending_payment;
}

const TABS: { key: AuditType; label: string; description: string; icon: React.ElementType; disabled?: boolean }[] = [
  { key: 'website',        label: 'Website',        description: 'Full UX audit of your live site',         icon: Globe },
  { key: 'brand_identity', label: 'Brand Identity', description: 'Analyze uploaded brand materials',        icon: Fingerprint },
  { key: 'design',         label: 'Design',         description: 'Review design files and prototypes',      icon: PenTool, disabled: true },
];

function formatDate(d: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(d));
}

function formatUrl(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function langCode(code: string | null): string {
  if (!code || code === 'en') return '';
  return code.toUpperCase();
}

function scoreColor(s: number) {
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
}

function scoreBg(s: number) {
  if (s >= 70) return { background: 'color-mix(in srgb, var(--ok) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--ok) 25%, transparent)' };
  if (s >= 40) return { background: 'color-mix(in srgb, var(--warn) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--warn) 25%, transparent)' };
  return { background: 'color-mix(in srgb, var(--severe) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--severe) 25%, transparent)' };
}

/* ── Website Audit Card (grouped by domain) ─────────────── */

function WebsiteAuditGroup({ domain, audits }: {
  domain: string;
  audits: AuditWithReport[];
}) {
  const hasMultiple = audits.length > 1;
  const latest = audits[0];
  const latestMeta = getStatusMeta(latest.status, 'website');
  const LatestIcon = latestMeta.icon;
  const latestDone = latest.status === 'completed';
  const latestScore = latestDone ? (latest.report?.overall_score ?? null) : null;

  const scores = audits
    .filter(a => a.status === 'completed' && a.report?.overall_score != null)
    .map(a => ({ score: a.report!.overall_score!, date: a.completed_at || a.created_at }))
    .reverse();
  const improvement = scores.length >= 2 ? scores[scores.length - 1].score - scores[scores.length - 2].score : 0;
  const lang = langCode((latest as any).language);

  if (!hasMultiple) {
    return (
      <div className="rounded-xl overflow-hidden transition-colors group" style={{ border: '1px solid var(--rule)', background: 'var(--paper)' }}>
        <Link href={`/dashboard/audits/${latest.id}`} className="block px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Globe size={12} className="text-muted flex-shrink-0" />
                <p className="font-medium text-sm text-text truncate">{domain}</p>
                {lang && <span className="text-[11px] font-medium text-muted bg-off px-1.5 py-0.5 rounded">{lang}</span>}
                <ExternalLink size={10} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted">
                <span>{formatDate(latest.created_at)}</span>
                <span className="text-border">·</span>
                <span className="flex items-center gap-0.5"><LatestIcon size={10} />{latestMeta.label}</span>
              </div>
              {latestDone && latest.report?.executive_summary && (
                <p className="text-muted text-[11px] mt-1 line-clamp-1">{latest.report.executive_summary}</p>
              )}
            </div>
            {latestScore != null ? (
              <div className="w-10 h-10 rounded-md border flex items-center justify-center flex-shrink-0" style={scoreBg(latestScore)}>
                <span className="font-sans font-medium text-sm leading-none" style={{ color: scoreColor(latestScore) }}>{latestScore}</span>
              </div>
            ) : (
              <Badge variant={latestMeta.color as any} size="sm">{latestMeta.label}</Badge>
            )}
            <ChevronRight size={14} className="text-muted flex-shrink-0" />
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden transition-colors group" style={{ border: '1px solid var(--rule)', background: 'var(--paper)' }}>
      <Link
        href={`/dashboard/audits/site/${encodeURIComponent(domain)}`}
        className="block px-4 py-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Globe size={12} className="text-muted flex-shrink-0" />
              <p className="font-medium text-sm text-text truncate">{domain}</p>
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ color: 'var(--ink)', background: 'color-mix(in srgb, var(--ink) 8%, transparent)' }}>
                {audits.length} audits
              </span>
              {lang && <span className="text-[11px] font-medium text-muted bg-off px-1.5 py-0.5 rounded">{lang}</span>}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <span>Latest: {formatDate(latest.created_at)}</span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-0.5"><LatestIcon size={10} />{latestMeta.label}</span>
              {improvement !== 0 && (
                <>
                  <span className="text-border">·</span>
                  <span className="font-medium" style={{ color: improvement > 0 ? 'var(--ok)' : 'var(--severe)' }}>
                    {improvement > 0 ? '+' : ''}{improvement} pts
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {latestScore != null && (
              <div className={`w-10 h-10 rounded-md border flex items-center justify-center ${scoreBg(latestScore)}`}>
                <span className={`font-medium text-sm leading-none ${scoreColor(latestScore)}`}>{latestScore}</span>
              </div>
            )}
            {!latestDone && <Badge variant={latestMeta.color as any} size="sm">{latestMeta.label}</Badge>}
            <ChevronRight size={14} className="text-muted flex-shrink-0" />
          </div>
        </div>
      </Link>
    </div>
  );
}

/* ── Brand Identity Audit Group (grouped by brand name) ──── */

function BrandAuditGroup({ brandName, audits }: {
  brandName: string;
  audits: AuditWithReport[];
}) {
  const hasMultiple = audits.length > 1;
  const latest = audits[0];
  const latestMeta = getStatusMeta(latest.status, 'brand_identity');
  const LatestIcon = latestMeta.icon;
  const latestDone = latest.status === 'completed';
  const latestScore = latestDone ? (latest.report?.overall_score ?? null) : null;

  const scores = audits
    .filter(a => a.status === 'completed' && a.report?.overall_score != null)
    .map(a => ({ score: a.report!.overall_score!, date: a.completed_at || a.created_at }))
    .reverse();
  const improvement = scores.length >= 2 ? scores[scores.length - 1].score - scores[scores.length - 2].score : 0;
  const lang = langCode((latest as any).language);

  if (!hasMultiple) {
    return (
      <div className="rounded-xl overflow-hidden transition-colors group" style={{ border: '1px solid var(--rule)', background: 'var(--paper)' }}>
        <Link href={`/dashboard/audits/${latest.id}`} className="block px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Fingerprint size={12} className="text-muted flex-shrink-0" />
                <p className="font-medium text-sm text-text truncate">{brandName}</p>
                {lang && <span className="text-[11px] font-medium text-muted bg-off px-1.5 py-0.5 rounded">{lang}</span>}
                <ExternalLink size={10} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted">
                <span>{formatDate(latest.created_at)}</span>
                <span className="text-border">·</span>
                <span className="flex items-center gap-0.5"><LatestIcon size={10} />{latestMeta.label}</span>
              </div>
              {latestDone && latest.report?.executive_summary && (
                <p className="text-muted text-[11px] mt-1 line-clamp-1">{latest.report.executive_summary}</p>
              )}
            </div>
            {latestScore != null ? (
              <div className="w-10 h-10 rounded-md border flex items-center justify-center flex-shrink-0" style={scoreBg(latestScore)}>
                <span className="font-sans font-medium text-sm leading-none" style={{ color: scoreColor(latestScore) }}>{latestScore}</span>
              </div>
            ) : (
              <Badge variant={latestMeta.color as any} size="sm">{latestMeta.label}</Badge>
            )}
            <ChevronRight size={14} className="text-muted flex-shrink-0" />
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden transition-colors group" style={{ border: '1px solid var(--rule)', background: 'var(--paper)' }}>
      <Link
        href={`/dashboard/audits/brand/${encodeURIComponent(brandName)}`}
        className="block px-4 py-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Fingerprint size={12} className="text-muted flex-shrink-0" />
              <p className="font-medium text-sm text-text truncate">{brandName}</p>
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ color: 'var(--ink)', background: 'color-mix(in srgb, var(--ink) 8%, transparent)' }}>
                {audits.length} audits
              </span>
              {lang && <span className="text-[11px] font-medium text-muted bg-off px-1.5 py-0.5 rounded">{lang}</span>}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <span>Latest: {formatDate(latest.created_at)}</span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-0.5"><LatestIcon size={10} />{latestMeta.label}</span>
              {improvement !== 0 && (
                <>
                  <span className="text-border">·</span>
                  <span className="font-medium" style={{ color: improvement > 0 ? 'var(--ok)' : 'var(--severe)' }}>
                    {improvement > 0 ? '+' : ''}{improvement} pts
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {latestScore != null && (
              <div className={`w-10 h-10 rounded-md border flex items-center justify-center ${scoreBg(latestScore)}`}>
                <span className={`font-medium text-sm leading-none ${scoreColor(latestScore)}`}>{latestScore}</span>
              </div>
            )}
            {!latestDone && <Badge variant={latestMeta.color as any} size="sm">{latestMeta.label}</Badge>}
            <ChevronRight size={14} className="text-muted flex-shrink-0" />
          </div>
        </div>
      </Link>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────── */

function AuditsPageInner() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [audits, setAudits] = useState<AuditWithReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab state — use local state for instant switching, sync URL for deep-linking
  const tabParam = searchParams.get('type') as AuditType | null;
  const initialTab: AuditType = TABS.some(t => t.key === tabParam && !t.disabled) ? tabParam! : 'website';
  const [activeTab, setActiveTabState] = useState<AuditType>(initialTab);

  const setActiveTab = useCallback((tab: AuditType) => {
    setActiveTabState(tab);
    // Sync URL (non-blocking — visual switch is already done via state)
    const params = new URLSearchParams(window.location.search);
    if (tab === 'website') {
      params.delete('type');
    } else {
      params.set('type', tab);
    }
    const qs = params.toString();
    window.history.replaceState(null, '', `/dashboard/audits${qs ? `?${qs}` : ''}`);
  }, []);

  const fetchAudits = useCallback(async (userId: string) => {
    try {
      const supabase = createBrowserSupabase();
      const { data: rows, error: fetchError } = await supabase
        .from('audits')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const completedIds = (rows || []).filter((a: any) => a.status === 'completed').map((a: any) => a.id);
      let reportsMap: Record<string, Report> = {};
      if (completedIds.length > 0) {
        const { data: reports, error: repErr } = await supabase.from('reports').select('*').in('audit_id', completedIds);
        if (!repErr && reports) reportsMap = Object.fromEntries(reports.map((r: any) => [r.audit_id, r]));
      }

      // Fetch brand names for brand identity audits
      const brandIds = [...new Set((rows || []).filter((a: any) => a.brand_identity_id).map((a: any) => a.brand_identity_id as string))];
      let brandMap: Record<string, string> = {};
      if (brandIds.length > 0) {
        const { data: brands } = await supabase.from('brand_identities').select('id, name').in('id', brandIds);
        if (brands) brandMap = Object.fromEntries(brands.map((b: any) => [b.id, b.name]));
      }

      setAudits((rows || []).map((a: any) => ({
        ...a,
        report: reportsMap[a.id] || null,
        brandName: a.brand_identity_id ? (brandMap[a.brand_identity_id] || null) : null,
      })));
    } catch (err: any) {
      console.error('[Audits] fetch error:', err);
      setError(err?.message || 'Failed to load audits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    fetchAudits(user.id);
  }, [authLoading, user?.id, fetchAudits]);

  useEffect(() => {
    if (!user) return;
    const hasInProgress = audits.some((a) => ['payment_received', 'crawling', 'analysing', 'generating_report'].includes(a.status));
    if (!hasInProgress) return;
    const iv = setInterval(() => fetchAudits(user.id), 10000);
    return () => clearInterval(iv);
  }, [audits, user, fetchAudits]);

  // Infer effective audit type — handles older audits without audit_type column
  const getAuditType = (a: Audit): AuditType => {
    if (a.audit_type) return a.audit_type;
    // Fallback: if it has a brand_identity_id but no product_url, it's a brand audit
    if (a.brand_identity_id && !a.product_url) return 'brand_identity';
    return 'website';
  };

  // Filter audits by active tab
  const filteredAudits = useMemo(() => {
    return audits.filter(a => getAuditType(a) === activeTab);
  }, [audits, activeTab]);

  // Count per tab
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of TABS) counts[t.key] = 0;
    for (const a of audits) {
      const type = getAuditType(a);
      if (counts[type] !== undefined) counts[type]++;
    }
    return counts;
  }, [audits]);

  // Website: group by domain
  const websiteGrouped = useMemo(() => {
    if (activeTab !== 'website') return {};
    const grouped: Record<string, AuditWithReport[]> = {};
    for (const audit of filteredAudits) {
      const domain = formatUrl(audit.product_url || '');
      if (!grouped[domain]) grouped[domain] = [];
      grouped[domain].push(audit);
    }
    return grouped;
  }, [filteredAudits, activeTab]);

  // Brand: group by brand name
  const brandGrouped = useMemo(() => {
    if (activeTab !== 'brand_identity') return {};
    const grouped: Record<string, AuditWithReport[]> = {};
    for (const audit of filteredAudits) {
      const name = audit.brandName || 'Unnamed brand';
      if (!grouped[name]) grouped[name] = [];
      grouped[name].push(audit);
    }
    return grouped;
  }, [filteredAudits, activeTab]);

  if (authLoading || (loading && user)) {
    return (
      <div className="max-w-2xl mx-auto py-6 space-y-3">
        <div className="h-5 w-32 rounded animate-pulse" style={{ background: 'var(--paper-2)' }} />
        {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
      </div>
    );
  }

  const TabIcon = TABS.find(t => t.key === activeTab)?.icon || FileSearch;
  const tabLabel = TABS.find(t => t.key === activeTab)?.label || 'Audits';

  return (
    <div className="max-w-2xl mx-auto py-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-medium font-sans" style={{ color: 'var(--ink)' }}>Audits</h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
            {audits.length} audit{audits.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <Link href="/dashboard/new-audit" className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3.5 py-2 rounded-lg transition-all hover:opacity-90" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
          <Sparkles size={13} />
          New audit
        </Link>
      </div>

      {/* Audit Type Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'var(--paper-2)' }}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          const count = tabCounts[tab.key] || 0;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              disabled={tab.disabled}
              onClick={() => !tab.disabled && setActiveTab(tab.key)}
              className={`relative flex items-center justify-center gap-2 flex-1 px-4 py-2.5 text-[13px] font-medium rounded-lg transition-all ${
                tab.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
              }`}
              style={{
                color: isActive ? 'var(--ink)' : 'var(--m-muted)',
                background: isActive ? 'var(--card)' : 'transparent',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <Icon size={14} strokeWidth={1.5} />
              <span>{tab.label}</span>
              {!tab.disabled && count > 0 && (
                <span
                  className="text-[11px] font-medium px-1.5 py-0.5 rounded-full leading-none"
                  style={{
                    background: isActive ? 'var(--paper-2)' : 'var(--paper-3)',
                    color: 'var(--m-muted)',
                  }}
                >
                  {count}
                </span>
              )}
              {tab.disabled && (
                <Lock size={10} className="ml-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg" style={{ background: 'color-mix(in srgb, var(--severe) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--severe) 20%, transparent)' }}>
          <p className="text-xs" style={{ color: 'var(--severe)' }}>{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredAudits.length === 0 && (
        <div className="text-center py-12">
          <TabIcon size={22} className="mx-auto mb-3" style={{ color: 'var(--m-muted)' }} />
          <h2 className="font-medium text-[14px] mb-1" style={{ color: 'var(--ink)' }}>No {tabLabel.toLowerCase()} audits yet</h2>
          <p className="text-[13px] mb-4 max-w-xs mx-auto" style={{ color: 'var(--m-muted)' }}>
            {activeTab === 'website'
              ? 'Create your first audit to see how your website scores.'
              : 'Run a brand identity audit to evaluate your brand materials.'}
          </p>
          <Link
            href={activeTab === 'brand_identity' ? '/dashboard/new-audit?type=brand_identity' : '/dashboard/new-audit'}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-lg transition-all hover:opacity-90"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            <Sparkles size={13} /> Start {tabLabel} audit
          </Link>
        </div>
      )}

      {/* Website audit list — grouped by domain */}
      {activeTab === 'website' && filteredAudits.length > 0 && (
        <div className="flex flex-col" style={{ gap: '12px' }}>
          {Object.keys(websiteGrouped).map((domain) => (
            <WebsiteAuditGroup key={domain} domain={domain} audits={websiteGrouped[domain]} />
          ))}
        </div>
      )}

      {/* Brand identity audit list — grouped by brand name */}
      {activeTab === 'brand_identity' && filteredAudits.length > 0 && (
        <div className="flex flex-col" style={{ gap: '12px' }}>
          {Object.keys(brandGrouped).map((name) => (
            <BrandAuditGroup key={name} brandName={name} audits={brandGrouped[name]} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AuditsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto py-6 space-y-3">
          <div className="h-5 w-32 rounded animate-pulse" style={{ background: 'var(--paper-2)' }} />
          {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
      }
    >
      <AuditsPageInner />
    </Suspense>
  );
}
