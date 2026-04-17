'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Globe,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Zap,
  FileSearch,
  Trash2,
  RefreshCw,
  TrendingUp,
  ChevronRight,
  Search,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import Badge from '@/components/ui/Badge';
import type { Audit, Report } from '@/types/database';

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
  if (s >= 70) return 'text-[#22C55E]';
  if (s >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-[#EF4444]';
}

function scoreBg(s: number) {
  if (s >= 70) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (s >= 40) return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

/* ── Main Component ───────────────────────────────────────── */

export default function DomainAuditsPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: rawDomain } = use(params);
  const domain = decodeURIComponent(rawDomain);

  const { user, loading: authLoading } = useAuth();
  const [audits, setAudits] = useState<AuditWithReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAudits = useCallback(async (userId: string) => {
    try {
      const supabase = createBrowserSupabase();
      const { data: rows, error: fetchError } = await supabase
        .from('audits')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Filter to this domain
      const domainRows = (rows || []).filter((a: any) => formatUrl(a.product_url) === domain);

      const completedIds = domainRows.filter((a: any) => a.status === 'completed').map((a: any) => a.id);
      let reportsMap: Record<string, Report> = {};
      if (completedIds.length > 0) {
        const { data: reports, error: repErr } = await supabase.from('reports').select('*').in('audit_id', completedIds);
        if (!repErr && reports) reportsMap = Object.fromEntries(reports.map((r: any) => [r.audit_id, r]));
      }

      setAudits(domainRows.map((a: any) => ({ ...a, report: reportsMap[a.id] || null })));
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
      <div className="max-w-2xl mx-auto py-6 px-4 space-y-4">
        <div className="h-4 w-28 bg-off rounded animate-pulse" />
        <div className="h-7 w-48 bg-off rounded animate-pulse" />
        <div className="h-20 bg-off rounded-lg animate-pulse" />
        {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-off rounded-lg animate-pulse" />)}
      </div>
    );
  }

  // Score data
  const scores = audits
    .filter(a => a.status === 'completed' && a.report?.overall_score != null)
    .map(a => ({ score: a.report!.overall_score!, date: a.completed_at || a.created_at }))
    .reverse();
  const latestScore = scores.length > 0 ? scores[scores.length - 1].score : null;
  const improvement = scores.length >= 2 ? scores[scores.length - 1].score - scores[scores.length - 2].score : 0;
  const latest = audits[0] || null;
  const productUrl = latest?.product_url || '';

  return (
    <div className="max-w-2xl mx-auto py-4 px-4">
      {/* Back to all audits */}
      <Link
        href="/dashboard/audits"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Back to Audits
      </Link>

      {/* Domain header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Globe size={18} className="text-muted flex-shrink-0" />
            <h1 className="text-xl font-semibold font-body text-text truncate">{domain}</h1>
          </div>
          <p className="text-muted text-xs">
            {audits.length} audit{audits.length !== 1 ? 's' : ''}
            {latestScore != null && <> · Latest score: <span className={`font-semibold ${scoreColor(latestScore)}`}>{latestScore}/100</span></>}
          </p>
        </div>
        <Link
          href={`/dashboard/new-audit?url=${encodeURIComponent(productUrl)}`}
          className="inline-flex items-center gap-1.5 bg-brand text-surface dark:text-[#111111] text-xs font-medium px-3.5 py-2 rounded-lg transition-all hover:brightness-110 flex-shrink-0"
        >
          <RefreshCw size={13} />
          Re-audit
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-red-700 dark:text-red-300 text-xs">{error}</p>
        </div>
      )}

      {/* Score trend */}
      {scores.length >= 2 && (
        <div className="rounded-xl border border-border/40 dark:border-white/[0.06] bg-card p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={13} className="text-brand" />
            <span className="text-xs font-medium text-text/60">Score Trend</span>
            {improvement !== 0 && (
              <span className={`ml-auto text-xs font-semibold ${improvement > 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                {improvement > 0 ? '+' : ''}{improvement} pts
              </span>
            )}
          </div>
          <div className="space-y-2">
            {scores.map((s, i) => {
              const dateStr = new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const isLatest = i === scores.length - 1;
              const isBaseline = i === 0;
              return (
                <div key={i} className={`flex items-center gap-2.5 ${isLatest ? '' : 'opacity-55'}`}>
                  <span className="text-[10px] text-muted w-11 flex-shrink-0">{dateStr}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-border/10 dark:bg-white/[0.04] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.score >= 70 ? 'bg-[#22C55E]' : s.score >= 40 ? 'bg-amber-400' : 'bg-[#EF4444]'}`}
                      style={{ width: `${s.score}%` }}
                    />
                  </div>
                  <span className={`text-[11px] font-semibold w-6 text-right ${s.score >= 70 ? 'text-[#22C55E]' : s.score >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-[#EF4444]'}`}>
                    {s.score}
                  </span>
                  {isLatest && <span className="text-[8px] font-medium text-brand bg-brand/10 px-1 py-0.5 rounded">now</span>}
                  {isBaseline && !isLatest && <span className="text-[8px] text-muted/50">start</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Audit list */}
      {audits.length === 0 ? (
        <div className="text-center py-12">
          <FileSearch size={24} className="text-muted mx-auto mb-3" />
          <h2 className="font-semibold text-sm text-text mb-1">No audits for {domain}</h2>
          <p className="text-muted text-xs mb-4 max-w-xs mx-auto">Start an audit to analyze this site.</p>
          <Link
            href={`/dashboard/new-audit?url=${encodeURIComponent(productUrl || `https://${domain}`)}`}
            className="inline-flex items-center gap-1.5 bg-brand text-surface dark:text-[#111111] text-xs font-medium px-4 py-2 rounded-lg transition-all hover:brightness-110"
          >
            <Sparkles size={13} /> Start Audit
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-border/40 dark:border-white/[0.06] bg-card overflow-hidden">
          <div className="divide-y divide-border/20 dark:divide-white/[0.04]">
            {audits.map((audit) => {
              const meta = statusMeta[audit.status] || statusMeta.pending_payment;
              const Icon = meta.icon;
              const done = audit.status === 'completed';
              const report = audit.report;
              const aLang = langCode((audit as any).language) || 'EN';

              return (
                <div key={audit.id} className="flex items-center gap-2 hover:bg-brand/5 dark:hover:bg-brand/[0.03] transition-colors group/row">
                  <Link href={`/dashboard/audits/${audit.id}`} className="flex-1 min-w-0 px-4 py-3 flex items-center gap-3">
                    <div className="flex items-center gap-2 text-[11px] text-muted flex-1 min-w-0">
                      <span className="text-text font-medium">{formatDate(audit.created_at)}</span>
                      <span className="text-border">·</span>
                      <span className="flex items-center gap-0.5"><Icon size={10} />{meta.label}</span>
                      <span className="text-border">·</span>
                      <span className="text-[10px] font-bold text-text/50 bg-off dark:bg-white/[0.06] px-1.5 py-0.5 rounded">{aLang}</span>
                      {(audit as any).depth_mode === 'deep' && (
                        <span className="text-[9px] font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded-full uppercase">Deep</span>
                      )}
                      {done && report?.overall_score != null && (
                        <>
                          <span className="text-border">·</span>
                          <span className={`font-bold ${scoreColor(report.overall_score)}`}>{report.overall_score} pts</span>
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
