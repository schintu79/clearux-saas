'use client';

import React, { Suspense, useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Globe,
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
  Search,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import { AuditDashboardOverview } from '@/components/dashboard/AuditDashboard';
import type { Audit, Report, AuditFinding } from '@/types/database';
import { writeSelection } from '@/lib/dashboard/brand-selection';

/* ── Helpers ───────────────────────────────────────────────── */

interface AuditWithReport extends Audit {
  report: Report | null;
}

const statusMeta: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending_payment:   { label: 'Awaiting payment', color: 'pending',   icon: Clock },
  payment_received:  { label: 'Processing',       color: 'active',    icon: Zap },
  crawling:          { label: 'Crawling...',       color: 'active',    icon: Globe },
  analysing:         { label: 'Analysing...',      color: 'active',    icon: Sparkles },
  generating_report: { label: 'Generating...',     color: 'active',    icon: FileSearch },
  completed:         { label: 'Completed',         color: 'completed', icon: CheckCircle2 },
  failed:            { label: 'Failed',            color: 'failed',    icon: AlertTriangle },
};

function formatDate(d: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d));
}

function formatUrl(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
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

/* ── Pillar config (must match audit detail page) ────────── */
const PILLAR_NAMES = ['Foundation', 'Human Experience', 'Inclusive Design', 'Future Readiness', 'SEO Structure', 'Brand Consistency'];
const PILLAR_RANGES: [number, number][] = [[0, 4], [4, 8], [8, 12], [12, 16], [16, 20], [20, 24]];

/* ── Main Component ───────────────────────────────────────── */

function DomainAuditsInner({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: rawDomain } = use(params);
  const domain = decodeURIComponent(rawDomain);
  const router = useRouter();

  const { user, loading: authLoading } = useAuth();
  const [audits, setAudits] = useState<AuditWithReport[]>([]);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [categoryScores, setCategoryScores] = useState<Array<{ name: string; score: number; summary: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoreTrend, setScoreTrend] = useState<Array<{ auditId: string; date: string; overallScore: number }>>([]);
  const [competitors, setCompetitors] = useState<Array<{ domain: string; score: number; pillarScores?: Array<{ name: string; score: number }> }>>([]);
  const [detectingCompetitors, setDetectingCompetitors] = useState(false);

  const fetchAudits = useCallback(async (userId: string) => {
    try {
      const supabase = createBrowserSupabase();
      const { data: rows, error: fetchError } = await supabase
        .from('audits')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Filter to this domain AND only website audits (exclude brand audits that may share a URL)
      const domainRows = (rows || []).filter((a: any) => {
        const isWebsite = a.audit_type === 'website' || (!a.audit_type && !a.brand_identity_id);
        return isWebsite && formatUrl(a.product_url) === domain;
      });

      const completedIds = domainRows.filter((a: any) => a.status === 'completed').map((a: any) => a.id);
      let reportsMap: Record<string, Report> = {};
      if (completedIds.length > 0) {
        const { data: reports, error: repErr } = await supabase.from('reports').select('*').in('audit_id', completedIds);
        if (!repErr && reports) reportsMap = Object.fromEntries(reports.map((r: any) => [r.audit_id, r]));
      }

      const enrichedAudits = domainRows.map((a: any) => ({ ...a, report: reportsMap[a.id] || null }));
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

        // Score trend
        const productUrl = latestCompleted.product_url;
        fetch(`/api/audits/score-trend?url=${encodeURIComponent(productUrl)}`)
          .then(r => r.json())
          .then(d => { if (d.trend) setScoreTrend(d.trend); })
          .catch(() => {});

        // Load stored competitor benchmarks (if any)
        fetch(`/api/audits/detect-competitors?url=${encodeURIComponent(productUrl)}`)
          .then(r => r.json())
          .then(d => {
            if (d.competitors && d.competitors.length > 0) {
              setCompetitors(d.competitors);
            }
          })
          .catch(() => {});
      }
    } catch (err: any) {
      console.error('[DomainAudits] fetch error:', err);
      setError(err?.message || 'Failed to load audits');
    } finally {
      setLoading(false);
    }
  }, [domain]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    fetchAudits(user.id);
  }, [authLoading, user?.id, fetchAudits]);

  // Sync sidebar selector + topbar to this domain. Without this, the
  // selector keeps showing whatever was previously selected while the
  // page body is showing a different site, which was the divergence
  // reported in the bug.
  useEffect(() => {
    if (domain) writeSelection({ kind: 'site', host: domain });
  }, [domain]);

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
  const latest = audits[0] || null;
  const productUrl = latest?.product_url || '';

  // Severity counts from latest audit findings (exclude fixed & dismissed)
  const openFindings = findings.filter((f) => f.status !== 'fixed' && !f.dismissed && (f as any).verification_status !== 'verified_fixed');
  const severityCounts = {
    critical: openFindings.filter((f) => f.severity === 'critical').length,
    high: openFindings.filter((f) => f.severity === 'high').length,
    medium: openFindings.filter((f) => f.severity === 'medium').length,
    low: openFindings.filter((f) => f.severity === 'low').length,
  };

  // Pillar scores for radar chart — only include modules that were actually audited
  const pillarScores = PILLAR_NAMES.map((name, i) => {
    const [start, end] = PILLAR_RANGES[i];
    const cats = categoryScores.filter((_, idx) => idx >= start && idx < end);
    return {
      name,
      score: cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : -1,
    };
  }).filter(p => p.score >= 0);

  const handleStatCardClick = (filter: string) => {
    if (latestCompleted && filter !== 'passed') {
      router.push(`/dashboard/audits/${latestCompleted.id}?tab=findings&severity=${filter}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 px-4">
      {/* Domain header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <Globe size={20} className="text-muted flex-shrink-0" />
            <h1 className="text-2xl font-medium font-sans text-text truncate">{domain}</h1>
            <a
              href={productUrl || `https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand hover:text-brand/80 transition-colors"
            >
              <ExternalLink size={11} />
            </a>
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
            href={`/dashboard/new-audit?url=${encodeURIComponent(productUrl)}`}
            className="inline-flex items-center gap-1.5 bg-brand text-surface text-xs font-medium px-3.5 py-2 rounded-lg transition-all hover:brightness-110"
          >
            <RefreshCw size={13} />
            Re-audit
          </Link>
          <Link
            href={`/dashboard/new-audit?url=${encodeURIComponent(productUrl)}&depth=deep`}
            className="inline-flex items-center gap-1.5 bg-card border border-border text-text text-xs font-medium px-3 py-2 rounded-lg hover:bg-surface-alt transition-colors"
          >
            <Search size={13} />
            Dig deeper
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
          productUrl={productUrl}
          latestAuditId={latestCompleted.id}
          competitors={competitors.length > 0 ? competitors : undefined}
          detecting={detectingCompetitors}
          onBenchmark={(mode, domains) => {
            setDetectingCompetitors(true);
            fetch('/api/audits/detect-competitors', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: productUrl, mode, competitors: domains }),
            })
              .then(r => r.json())
              .then(d => {
                if (d.competitors && d.competitors.length > 0) {
                  setCompetitors(d.competitors);
                }
              })
              .catch(() => {})
              .finally(() => setDetectingCompetitors(false));
          }}
          onStatCardClick={handleStatCardClick}
        />
      )}

      {/* ── Audit History ────────────────────────────────────── */}
      <h2 className="text-sm font-medium text-text mb-3">Audit History</h2>

      {audits.length === 0 ? (
        <div className="text-center py-12">
          <FileSearch size={24} className="text-muted mx-auto mb-3" />
          <h2 className="font-medium text-sm text-text mb-1">No audits for {domain}</h2>
          <p className="text-muted text-xs mb-4 max-w-xs mx-auto">Start an audit to analyze this site.</p>
          <Link
            href={`/dashboard/new-audit?url=${encodeURIComponent(productUrl || `https://${domain}`)}`}
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
                      {(audit as any).depth_mode === 'deep' && (
                        <span className="text-[10px] font-semibold text-brand bg-brand/10 px-1.5 py-0.5 rounded uppercase tracking-wide">Deep</span>
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

const DomainAuditsPage = (props: { params: Promise<{ domain: string }> }) => (
  <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current" /></div>}>
    <DomainAuditsInner {...props} />
  </Suspense>
);

export default DomainAuditsPage;
