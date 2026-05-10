'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
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
import type { Audit, Report } from '@/types/database';

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

export default function BrandAuditsPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: rawName } = use(params);
  const brandName = decodeURIComponent(rawName);
  const router = useRouter();

  const { user, loading: authLoading } = useAuth();
  const [audits, setAudits] = useState<AuditWithReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAudits = useCallback(async (userId: string) => {
    try {
      const supabase = createBrowserSupabase();

      // Fetch brand identities matching this name
      const { data: brands } = await supabase
        .from('brand_identities')
        .select('id, name')
        .eq('user_id', userId)
        .ilike('name', brandName);

      if (!brands || brands.length === 0) {
        setAudits([]);
        setLoading(false);
        return;
      }

      const brandIds = brands.map(b => b.id);

      // Fetch audits for these brand identities
      const { data: rows, error: fetchError } = await supabase
        .from('audits')
        .select('*')
        .eq('user_id', userId)
        .in('brand_identity_id', brandIds)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const completedIds = (rows || []).filter((a: any) => a.status === 'completed').map((a: any) => a.id);
      let reportsMap: Record<string, Report> = {};
      if (completedIds.length > 0) {
        const { data: reports, error: repErr } = await supabase.from('reports').select('*').in('audit_id', completedIds);
        if (!repErr && reports) reportsMap = Object.fromEntries(reports.map((r: any) => [r.audit_id, r]));
      }

      setAudits((rows || []).map((a: any) => ({
        ...a,
        report: reportsMap[a.id] || null,
        brandIdentityId: a.brand_identity_id,
      })));
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
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-off rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  // Derived data
  const latestCompleted = audits.find(a => a.status === 'completed' && a.report);
  const latestReport = latestCompleted?.report;
  const latestScore = latestReport?.overall_score ?? 0;

  // Score trend from completed audits
  const scores = audits
    .filter(a => a.status === 'completed' && a.report?.overall_score != null)
    .map(a => ({ score: a.report!.overall_score!, date: a.completed_at || a.created_at }))
    .reverse();
  const improvement = scores.length >= 2 ? scores[scores.length - 1].score - scores[scores.length - 2].score : 0;

  return (
    <div className="max-w-4xl mx-auto py-4 px-4">
      {/* Back to all audits */}
      <Link
        href="/dashboard/audits?type=brand_identity"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Back to Audits
      </Link>

      {/* Brand header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <Fingerprint size={20} className="text-muted flex-shrink-0" />
            <h1 className="text-2xl font-medium font-heading text-text truncate">{brandName}</h1>
          </div>
          <p className="text-muted text-xs">
            {audits.length} audit{audits.length !== 1 ? 's' : ''}
            {latestScore > 0 && <> · Latest score: <span className={`font-medium ${scoreColor(latestScore)}`}>{latestScore}/100</span></>}
            {improvement !== 0 && (
              <> · <span className={`font-medium ${improvement > 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                {improvement > 0 ? '+' : ''}{improvement} pts
              </span> since last audit</>
            )}
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
            href="/dashboard/new-audit?type=brand_identity"
            className="inline-flex items-center gap-1.5 bg-brand text-surface text-xs font-medium px-3.5 py-2 rounded-lg transition-all hover:brightness-110"
          >
            <RefreshCw size={13} />
            Re-audit
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-red-700 dark:text-red-300 text-xs">{error}</p>
        </div>
      )}

      {/* Score overview card (if completed audits exist) */}
      {latestCompleted && latestReport && (
        <div className="rounded-xl border border-border/40 dark:border-white/[0.06] bg-card p-5 mb-6">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-xl border-2 flex items-center justify-center ${scoreBg(latestScore)}`}>
              <span className={`text-2xl font-bold ${scoreColor(latestScore)}`}>{latestScore}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-medium text-text mb-1">Latest brand score</h2>
              {latestReport.executive_summary && (
                <p className="text-muted text-xs line-clamp-2">{latestReport.executive_summary}</p>
              )}
            </div>
          </div>
          {scores.length >= 2 && (
            <div className="mt-4 pt-4 border-t border-border/30">
              <div className="flex items-center gap-4 text-xs text-muted">
                <span>Score history:</span>
                <div className="flex items-center gap-2">
                  {scores.map((s, i) => (
                    <span key={i} className={`font-medium ${scoreColor(s.score)}`}>
                      {s.score}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audit History */}
      <h2 className="text-sm font-medium text-text mb-3">Audit History</h2>

      {audits.length === 0 ? (
        <div className="text-center py-12">
          <Fingerprint size={24} className="text-muted mx-auto mb-3" />
          <h2 className="font-medium text-sm text-text mb-1">No audits for {brandName}</h2>
          <p className="text-muted text-xs mb-4 max-w-xs mx-auto">Start a brand identity audit to evaluate your brand materials.</p>
          <Link
            href="/dashboard/new-audit?type=brand_identity"
            className="inline-flex items-center gap-1.5 bg-brand text-surface text-xs font-medium px-4 py-2 rounded-lg transition-all hover:brightness-110"
          >
            <Sparkles size={13} /> Start audit
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
                      <span className="text-[11px] font-medium text-muted bg-off dark:bg-white/[0.06] px-1.5 py-0.5 rounded">{aLang}</span>
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
