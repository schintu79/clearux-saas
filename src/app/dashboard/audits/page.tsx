'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
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
  if (s >= 70) return 'text-[#2D7A4F]';
  if (s >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-[#C0392B]';
}

function scoreBg(s: number) {
  if (s >= 70) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (s >= 40) return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

/* ── Site Group ───────────────────────────────────────────── */

function AuditSiteGroup({ domain, audits }: {
  domain: string;
  audits: AuditWithReport[];
}) {
  const hasMultiple = audits.length > 1;
  const latest = audits[0];
  const latestMeta = statusMeta[latest.status] || statusMeta.pending_payment;
  const LatestIcon = latestMeta.icon;
  const latestDone = latest.status === 'completed';
  const latestScore = latestDone ? (latest.report?.overall_score ?? null) : null;

  // Score trend
  const scores = audits
    .filter(a => a.status === 'completed' && a.report?.overall_score != null)
    .map(a => ({ score: a.report!.overall_score!, date: a.completed_at || a.created_at }))
    .reverse();
  const improvement = scores.length >= 2 ? scores[scores.length - 1].score - scores[scores.length - 2].score : 0;
  const lang = langCode((latest as any).language);

  // Single audit — entire card is clickable, goes directly to audit detail
  if (!hasMultiple) {
    return (
      <div className="rounded-xl border border-border/40 dark:border-white/[0.06] bg-card overflow-hidden hover:border-brand/30 transition-colors group">
        <Link href={`/dashboard/audits/${latest.id}`} className="block px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Globe size={12} className="text-muted flex-shrink-0" />
                <p className="font-medium text-sm text-text truncate">{domain}</p>
                {lang && <span className="text-[9px] font-bold text-muted bg-off px-1.5 py-0.5 rounded">{lang}</span>}
                <ExternalLink size={10} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted">
                <span>{formatDate(latest.created_at)}</span>
                <span className="text-border">·</span>
                <span className="flex items-center gap-0.5"><LatestIcon size={10} />{latestMeta.label}</span>
              </div>
              {latestDone && latest.report?.executive_summary && (
                <p className="text-muted text-[10px] mt-1 line-clamp-1">{latest.report.executive_summary}</p>
              )}
            </div>
            {latestScore != null ? (
              <div className={`w-10 h-10 rounded-md border flex items-center justify-center flex-shrink-0 ${scoreBg(latestScore)}`}>
                <span className={`font-semibold text-sm leading-none ${scoreColor(latestScore)}`}>{latestScore}</span>
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

  // Multiple audits — navigate to dedicated domain page
  return (
    <div className="rounded-xl border border-border/40 dark:border-white/[0.06] bg-card overflow-hidden hover:border-brand/30 transition-colors group">
      <Link
        href={`/dashboard/audits/site/${encodeURIComponent(domain)}`}
        className="block px-4 py-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Globe size={12} className="text-muted flex-shrink-0" />
              <p className="font-medium text-sm text-text truncate">{domain}</p>
              <span className="text-[10px] font-semibold text-brand bg-brand/10 px-1.5 py-0.5 rounded-full">
                {audits.length} audits
              </span>
              {lang && <span className="text-[9px] font-bold text-muted bg-off px-1.5 py-0.5 rounded">{lang}</span>}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted">
              <span>Latest: {formatDate(latest.created_at)}</span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-0.5"><LatestIcon size={10} />{latestMeta.label}</span>
              {improvement !== 0 && (
                <>
                  <span className="text-border">·</span>
                  <span className={`font-semibold ${improvement > 0 ? 'text-[#2D7A4F]' : 'text-[#C0392B]'}`}>
                    {improvement > 0 ? '+' : ''}{improvement} pts
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {latestScore != null && (
              <div className={`w-10 h-10 rounded-md border flex items-center justify-center ${scoreBg(latestScore)}`}>
                <span className={`font-semibold text-sm leading-none ${scoreColor(latestScore)}`}>{latestScore}</span>
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

export default function AuditsPage() {
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

      const completedIds = (rows || []).filter((a: any) => a.status === 'completed').map((a: any) => a.id);
      let reportsMap: Record<string, Report> = {};
      if (completedIds.length > 0) {
        const { data: reports, error: repErr } = await supabase.from('reports').select('*').in('audit_id', completedIds);
        if (!repErr && reports) reportsMap = Object.fromEntries(reports.map((r: any) => [r.audit_id, r]));
      }

      setAudits((rows || []).map((a: any) => ({ ...a, report: reportsMap[a.id] || null })));
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

  if (authLoading || (loading && user)) {
    return (
      <div className="max-w-2xl mx-auto py-6 space-y-3">
        <div className="h-5 w-32 bg-off rounded animate-pulse" />
        {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-off rounded-lg animate-pulse" />)}
      </div>
    );
  }

  // Group by domain
  const grouped: Record<string, AuditWithReport[]> = {};
  for (const audit of audits) {
    const domain = formatUrl(audit.product_url);
    if (!grouped[domain]) grouped[domain] = [];
    grouped[domain].push(audit);
  }

  return (
    <div className="max-w-2xl mx-auto py-2">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-text">All Audits</h1>
          <p className="text-muted text-xs mt-0.5">{audits.length} audit{audits.length !== 1 ? 's' : ''} across {Object.keys(grouped).length} site{Object.keys(grouped).length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/dashboard/new-audit" className="inline-flex items-center gap-1.5 bg-brand text-surface dark:text-[#1C1C1C] text-xs font-medium px-3.5 py-2 rounded-lg transition-all hover:brightness-110">
          <Sparkles size={13} />
          New Audit
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-red-700 dark:text-red-300 text-xs">{error}</p>
        </div>
      )}

      {!loading && audits.length === 0 && (
        <div className="text-center py-12">
          <FileSearch size={24} className="text-muted mx-auto mb-3" />
          <h2 className="font-semibold text-sm text-text mb-1">No audits yet</h2>
          <p className="text-muted text-xs mb-4 max-w-xs mx-auto">Create your first audit to see how your website scores.</p>
          <Link href="/dashboard/new-audit" className="inline-flex items-center gap-1.5 bg-brand text-surface dark:text-[#1C1C1C] text-xs font-medium px-4 py-2 rounded-lg transition-all hover:brightness-110">
            <Sparkles size={13} /> Start Audit
          </Link>
        </div>
      )}

      {audits.length > 0 && (
        <div className="flex flex-col" style={{ gap: '12px' }}>
          {Object.keys(grouped).map((domain) => (
            <AuditSiteGroup key={domain} domain={domain} audits={grouped[domain]} />
          ))}
        </div>
      )}
    </div>
  );
}
