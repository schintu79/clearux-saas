'use client';

import React, { Suspense, useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Fingerprint,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Zap,
  FileSearch,
  Trash2,
  RefreshCw,
  Download,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import { AuditDashboardOverview } from '@/components/dashboard/AuditDashboard';
import { PILLAR_FOR_CATEGORY } from '@/lib/audit-checkpoints';
import type { Audit, Report, AuditFinding } from '@/types/database';

/* ── Helpers ───────────────────────────────────────────────── */

interface AuditWithReport extends Audit {
  report: Report | null;
  brandIdentityId?: string | null;
}

const statusMeta: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending_payment:   { label: 'Awaiting payment',   color: 'pending',   icon: Clock },
  payment_received:  { label: 'Queued',              color: 'active',    icon: Zap },
  crawling:          { label: 'Extracting...',       color: 'active',    icon: FileSearch },
  analysing:         { label: 'Analyzing...',        color: 'active',    icon: Sparkles },
  generating_report: { label: 'Generating report...', color: 'active',  icon: FileSearch },
  completed:         { label: 'Completed',           color: 'completed', icon: CheckCircle2 },
  failed:            { label: 'Failed',              color: 'failed',    icon: AlertTriangle },
};

function formatDate(d: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d));
}

function langCode(code: string | null): string {
  if (!code || code === 'en') return '';
  return code.toUpperCase();
}

function scoreColor(s: number) {
  if (s >= 70) return 'text-ok';
  if (s >= 40) return 'text-warn';
  return 'text-severe';
}

/* ── Pillar config for brand audits (6 pillars) ──────────── */
const PILLAR_NAMES = ['Foundation', 'Human Experience', 'Inclusive Design', 'Future Readiness', 'SEO Structure & Rules', 'Brand Consistency'];

/* ── Main Component ───────────────────────────────────────── */

function BrandAuditsInner({ params }: { params: Promise<{ name: string }> }) {
  const { name: rawName } = use(params);
  const brandName = decodeURIComponent(rawName);
  const router = useRouter();

  const { user, loading: authLoading } = useAuth();
  const [audits, setAudits] = useState<AuditWithReport[]>([]);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [categoryScores, setCategoryScores] = useState<Array<{ name: string; score: number; summary: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoreTrend, setScoreTrend] = useState<Array<{ auditId: string; date: string; overallScore: number }>>([]);

  const fetchAudits = useCallback(async (userId: string) => {
    try {
      const supabase = createBrowserSupabase();

      // Fetch brand identities matching this name (need website_url too so
      // we can surface legacy audits linked only by URL — see below).
      const { data: brands } = await supabase
        .from('brand_identities')
        .select('id, name, website_url')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .ilike('name', brandName);

      if (!brands || brands.length === 0) {
        setAudits([]);
        setLoading(false);
        return;
      }

      const brandIds = brands.map(b => b.id);

      // Resolve the brand's website host so we can include legacy audits
      // whose product_url matches the brand even when brand_identity_id
      // was never set. This is what makes "audit history" show the full
      // story for a brand instead of just the two recently linked rows.
      const hostnameOf = (url: string | null | undefined): string | null => {
        if (!url) return null;
        try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
      };
      const brandHosts = Array.from(
        new Set(brands.map((b: any) => hostnameOf(b.website_url)).filter(Boolean) as string[]),
      );

      // Sync the sidebar selector + topbar to this brand so the body, the
      // selector, and the "Viewing X" topbar agree. Without this they
      // would diverge when the user opened a brand from a list while a
      // different selection was persisted.
      // Workspace context is URL-driven, no selection sync needed

      // Fetch this user's audits and keep ones that either link to one of
      // the brand identities OR whose product_url host matches the brand's
      // website host. Selected-brand scoping is preserved (we never show
      // audits for a different brand) while pre-link audits remain visible.
      const { data: rows, error: fetchError } = await supabase
        .from('audits')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .or('audit_type.is.null,audit_type.eq.website,audit_type.eq.brand_identity')
        .order('created_at', { ascending: false })
        .limit(200);

      if (fetchError) throw fetchError;

      const filtered = (rows || []).filter((a: any) => {
        if (a.brand_identity_id && brandIds.includes(a.brand_identity_id)) return true;
        if (brandHosts.length === 0) return false;
        const host = hostnameOf(a.product_url);
        return host != null && brandHosts.includes(host);
      });

      const completedIds = filtered.filter((a: any) => a.status === 'completed').map((a: any) => a.id);
      let reportsMap: Record<string, Report> = {};
      if (completedIds.length > 0) {
        const { data: reports, error: repErr } = await supabase.from('reports').select('*').in('audit_id', completedIds);
        if (!repErr && reports) reportsMap = Object.fromEntries(reports.map((r: any) => [r.audit_id, r]));
      }

      const enrichedAudits = filtered.map((a: any) => ({
        ...a,
        report: reportsMap[a.id] || null,
        brandIdentityId: a.brand_identity_id,
      }));
      setAudits(enrichedAudits);

      // Load findings + category scores from latest completed audit
      const latestCompleted = enrichedAudits.find((a: AuditWithReport) => a.status === 'completed' && a.report);
      if (latestCompleted) {
        // Findings
        const { data: findingsData } = await supabase
          .from('audit_findings')
          .select('*')
          .eq('audit_id', latestCompleted.id)
          .order('sort_order', { ascending: true });
        setFindings(findingsData || []);

        // Category scores from raw_json
        const rawJson = latestCompleted.report?.raw_json as any;
        if (rawJson?.categoryScores && Array.isArray(rawJson.categoryScores)) {
          setCategoryScores(rawJson.categoryScores);
        }

        // Build score trend from all completed audits (brand audits don't have a URL-based API)
        const trend = enrichedAudits
          .filter((a: AuditWithReport) => a.status === 'completed' && a.report?.overall_score != null)
          .map((a: AuditWithReport) => ({
            auditId: a.id,
            date: a.completed_at || a.created_at,
            overallScore: a.report!.overall_score!,
          }))
          .reverse(); // oldest first
        setScoreTrend(trend);
      }
    } catch (err: any) {
      console.error('[BrandAudits] fetch error:', err);
      setError(err?.message || 'Failed to load audits');
    } finally {
      setLoading(false);
    }
  }, [brandName]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    fetchAudits(user.id);
  }, [authLoading, user?.id, fetchAudits]);

  // Poll for in-progress audits
  useEffect(() => {
    if (!user) return;
    const hasInProgress = audits.some((a) => ['payment_received', 'crawling', 'analysing', 'generating_report'].includes(a.status));
    if (!hasInProgress) return;
    const iv = setInterval(() => fetchAudits(user.id), 10000);
    return () => clearInterval(iv);
  }, [audits, user, fetchAudits]);

  const handleDelete = async (id: string) => {
    try {
      const supabase = createBrowserSupabase();
      await supabase.from('audits').delete().eq('id', id);
      setAudits((prev) => prev.filter((a) => a.id !== id));
    } catch {
      alert('Failed to delete audit');
    }
  };

  // Loading skeleton
  if (authLoading || (loading && user)) {
    return (
      <div className="max-w-4xl mx-auto py-6 px-4 space-y-4">
        <div className="h-4 w-28 bg-off rounded animate-pulse" />
        <div className="h-7 w-48 bg-off rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-48 bg-off rounded-xl animate-pulse" />
          <div className="h-48 bg-off rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-off rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  // Derived data
  const latestCompleted = audits.find(a => a.status === 'completed' && a.report);
  const latestReport = latestCompleted?.report;
  const latestScore = latestReport?.overall_score ?? 0;

  // Severity counts from latest audit findings (exclude fixed & dismissed)
  const openFindings = findings.filter((f) => f.status !== 'fixed' && !f.dismissed && (f as any).verification_status !== 'verified_fixed');
  const severityCounts = {
    critical: openFindings.filter((f) => f.severity === 'critical').length,
    high: openFindings.filter((f) => f.severity === 'high').length,
    medium: openFindings.filter((f) => f.severity === 'medium').length,
    low: openFindings.filter((f) => f.severity === 'low').length,
  };

  // Pillar scores — group categoryScores by their pillar using PILLAR_FOR_CATEGORY
  const pillarScores = PILLAR_NAMES.map((pillarName) => {
    const cats = categoryScores.filter((c) => PILLAR_FOR_CATEGORY[c.name] === pillarName);
    return {
      name: pillarName,
      score: cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : 0,
    };
  }).filter((p) => p.score > 0); // Only show pillars that were actually audited

  const handleStatCardClick = (filter: string) => {
    if (latestCompleted && filter !== 'passed') {
      router.push(`/dashboard/audits/${latestCompleted.id}?tab=findings&severity=${filter}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 px-4">
      {/* Brand header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <Fingerprint size={20} className="text-muted flex-shrink-0" />
            <h1 className="text-2xl font-medium font-sans text-text truncate">{brandName}</h1>
          </div>
          <p className="text-muted text-xs">
            {audits.length} audit{audits.length !== 1 ? 's' : ''}
            {latestScore > 0 && <> · Latest score: <span className={`font-medium ${scoreColor(latestScore)}`}>{latestScore}/100</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {latestCompleted && (
            <a
              href={`/api/reports/${latestCompleted.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-card border border-border text-text text-xs font-medium px-3 py-2 rounded-lg hover:bg-surface-alt transition-colors"
            >
              <Download size={12} /> Report
            </a>
          )}
          <Link
            href="/dashboard/brand-dna"
            className="inline-flex items-center gap-1.5 bg-brand text-surface text-xs font-medium px-3.5 py-2 rounded-lg transition-all hover:brightness-110"
          >
            <RefreshCw size={13} />
            Re-audit
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg" style={{ background: 'color-mix(in srgb, var(--severe) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--severe) 20%, transparent)' }}>
          <p className="text-xs" style={{ color: 'var(--severe)' }}>{error}</p>
        </div>
      )}

      {/* ── Dashboard (only if there's a completed audit) ──── */}
      {latestCompleted && latestReport && (
        <AuditDashboardOverview
          overallScore={latestScore}
          scoreTrend={scoreTrend}
          severityCounts={severityCounts}
          findings={findings}
          pillarScores={pillarScores}
          productUrl=""
          latestAuditId={latestCompleted.id}
          onStatCardClick={handleStatCardClick}
          hideBenchmarks
        />
      )}

      {/* ── Audit History ────────────────────────────────────── */}
      <h2 className="text-sm font-medium text-text mb-3">Audit History</h2>

      {audits.length === 0 ? (
        <div className="text-center py-12">
          <Fingerprint size={24} className="text-muted mx-auto mb-3" />
          <h2 className="font-medium text-sm text-text mb-1">No audits for {brandName}</h2>
          <p className="text-muted text-xs mb-4 max-w-xs mx-auto">Start a brand identity audit to evaluate your brand materials.</p>
          <Link
            href="/dashboard/brand-dna"
            className="inline-flex items-center gap-1.5 bg-brand text-surface text-xs font-medium px-4 py-2 rounded-lg transition-all hover:brightness-110"
          >
            <Sparkles size={13} /> Start audit
          </Link>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--rule)', background: 'var(--card)' }}>
          <div className="divide-y" style={{ borderColor: 'var(--rule)' }}>
            {audits.map((audit) => {
              const meta = statusMeta[audit.status] || statusMeta.pending_payment;
              const Icon = meta.icon;
              const done = audit.status === 'completed';
              const report = audit.report;
              const aLang = langCode((audit as any).language) || 'EN';

              return (
                <div key={audit.id} className="flex items-center gap-2 hover:bg-black/[0.02] transition-colors group/row">
                  <Link href={`/dashboard/audits/${audit.id}`} className="flex-1 min-w-0 px-4 py-3 flex items-center gap-3">
                    <div className="flex items-center gap-2 text-[11px] text-muted flex-1 min-w-0">
                      <span className="text-text font-medium">{formatDate(audit.created_at)}</span>
                      <span className="text-border">·</span>
                      <span className="flex items-center gap-0.5"><Icon size={10} />{meta.label}</span>
                      <span className="text-border">·</span>
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded" style={{ color: 'var(--m-muted)', background: 'var(--paper-2)' }}>{aLang}</span>
                      {done && report?.overall_score != null && (
                        <>
                          <span className="text-border">·</span>
                          <span className={`font-medium ${scoreColor(report.overall_score)}`}>{report.overall_score} pts</span>
                        </>
                      )}
                    </div>
                    <ChevronRight size={12} className="text-muted/40 group-hover/row:text-brand transition-colors flex-shrink-0" />
                  </Link>
                  <button
                    onClick={() => { if (confirm('Delete this audit?')) handleDelete(audit.id); }}
                    className="px-3 py-2 text-muted hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const BrandAuditsPage = (props: { params: Promise<{ name: string }> }) => (
  <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current" /></div>}>
    <BrandAuditsInner {...props} />
  </Suspense>
);

export default BrandAuditsPage;
