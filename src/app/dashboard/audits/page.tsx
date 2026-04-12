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
  Trash2,
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

function scoreColor(s: number) {
  if (s >= 70) return 'text-green-600 dark:text-green-400';
  if (s >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBg(s: number) {
  if (s >= 70) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (s >= 40) return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

/* ── Component ─────────────────────────────────────────────── */

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

      // Fetch reports for completed audits to show scores
      const completedIds = (rows || [])
        .filter((a: any) => a.status === 'completed')
        .map((a: any) => a.id);

      let reportsMap: Record<string, Report> = {};
      if (completedIds.length > 0) {
        const { data: reports, error: repErr } = await supabase
          .from('reports')
          .select('*')
          .in('audit_id', completedIds);
        if (!repErr && reports) {
          reportsMap = Object.fromEntries(reports.map((r: any) => [r.audit_id, r]));
        }
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

  // Auto-refresh for in-progress audits
  useEffect(() => {
    if (!user) return;
    const hasInProgress = audits.some((a) =>
      ['payment_received', 'crawling', 'analysing', 'generating_report'].includes(a.status),
    );
    if (!hasInProgress) return;
    const iv = setInterval(() => fetchAudits(user.id), 10000);
    return () => clearInterval(iv);
  }, [audits, user, fetchAudits]);

  /* ── Skeleton ──────────────────────────────────────────── */
  if (authLoading || (loading && user)) {
    return (
      <div className="max-w-2xl mx-auto py-6 space-y-3">
        <div className="h-5 w-32 bg-off rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-off rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-text">All Audits</h1>
          <p className="text-muted text-xs mt-0.5">
            {audits.length} audit{audits.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/dashboard/new-audit"
          className="inline-flex items-center gap-1.5 bg-accent text-white text-xs font-medium px-3.5 py-2 rounded-md hover:bg-accent-dk transition-colors"
        >
          <Sparkles size={13} />
          New Audit
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-red-700 dark:text-red-300 text-xs">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && audits.length === 0 && (
        <div className="text-center py-12">
          <FileSearch size={24} className="text-muted mx-auto mb-3" />
          <h2 className="font-semibold text-sm text-text mb-1">No audits yet</h2>
          <p className="text-muted text-xs mb-4 max-w-xs mx-auto">
            Create your first audit to see how your website scores.
          </p>
          <Link
            href="/dashboard/new-audit"
            className="inline-flex items-center gap-1.5 bg-accent text-white text-xs font-medium px-4 py-2 rounded-md hover:bg-accent-dk transition-colors"
          >
            <Sparkles size={13} />
            Start Audit
          </Link>
        </div>
      )}

      {/* Audit list — 10px gap */}
      {audits.length > 0 && (
        <div className="flex flex-col" style={{ gap: '10px' }}>
          {audits.map((audit) => {
            const meta = statusMeta[audit.status] || statusMeta.pending_payment;
            const Icon = meta.icon;
            const report = audit.report;
            const done = audit.status === 'completed';

            return (
              <div key={audit.id} className="bg-card border border-border rounded-lg hover:border-accent/30 transition-colors group">
                <Link href={`/dashboard/audits/${audit.id}`} className="block px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Globe size={12} className="text-muted flex-shrink-0" />
                        <p className="font-medium text-xs text-text truncate">
                          {formatUrl(audit.product_url)}
                        </p>
                        <ExternalLink size={10} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted">
                        <span>{formatDate(audit.created_at)}</span>
                        <span className="text-border">&middot;</span>
                        <span className="flex items-center gap-0.5">
                          <Icon size={10} />
                          {meta.label}
                        </span>
                        {audit.plan && (
                          <>
                            <span className="text-border">&middot;</span>
                            <span>{audit.plan === 'quick_scan' ? 'Quick' : 'Full'}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right side: score for completed, badge for others */}
                    {done && report?.overall_score != null ? (
                      <div className={`w-10 h-10 rounded-md border flex flex-col items-center justify-center flex-shrink-0 ${scoreBg(report.overall_score)}`}>
                        <span className={`font-semibold text-sm leading-none ${scoreColor(report.overall_score)}`}>
                          {report.overall_score}
                        </span>
                      </div>
                    ) : (
                      <Badge variant={meta.color as any} size="sm">{meta.label}</Badge>
                    )}
                  </div>
                </Link>
                {/* Delete */}
                <div className="border-t border-border px-4 py-2 flex justify-end">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm('Delete this audit permanently? This action cannot be undone.')) return;
                      try {
                        const supabase = createBrowserSupabase();
                        await supabase.from('audits').delete().eq('id', audit.id);
                        setAudits((prev) => prev.filter((a) => a.id !== audit.id));
                      } catch {
                        alert('Failed to delete audit');
                      }
                    }}
                    className="flex items-center gap-1.5 text-[10px] text-muted hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={11} />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
