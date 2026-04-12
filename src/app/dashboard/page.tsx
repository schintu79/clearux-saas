'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Sparkles,
  ArrowRight,
  Globe,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Zap,
  FileSearch,
  ExternalLink,
  Coins,
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
  pending_payment:    { label: 'Awaiting payment',   color: 'pending',   icon: Clock },
  payment_received:   { label: 'Processing',         color: 'active',    icon: Zap },
  crawling:           { label: 'Crawling...',         color: 'active',    icon: Globe },
  analysing:          { label: 'Analysing...',        color: 'active',    icon: Sparkles },
  generating_report:  { label: 'Generating...',       color: 'active',    icon: FileSearch },
  completed:          { label: 'Completed',           color: 'completed', icon: CheckCircle2 },
  failed:             { label: 'Failed',              color: 'failed',    icon: AlertTriangle },
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

function DashboardInner() {
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();
  const [audits, setAudits] = useState<AuditWithReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creditsBanner, setCreditsBanner] = useState(false);

  // Handle return from Stripe credit purchase
  useEffect(() => {
    if (searchParams.get('credits') !== 'purchased') return;

    setCreditsBanner(true);
    // Clean URL without reload
    window.history.replaceState({}, '', '/dashboard');
    // Auto-dismiss after 6s
    const t = setTimeout(() => setCreditsBanner(false), 6000);

    // Verify purchase directly with Stripe (webhook may be delayed)
    fetch('/api/stripe/verify-credits', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => {
        if (d.verified) {
          // Trigger a focus event so Navbar + DashboardShell re-fetch credits
          window.dispatchEvent(new Event('focus'));
        }
      })
      .catch(() => {});

    return () => clearTimeout(t);
  }, [searchParams]);

  const fetchAudits = useCallback(async (userId: string) => {
    try {
      const supabase = createBrowserSupabase();

      // Fetch audits and reports in PARALLEL — single round-trip each
      const auditsPromise = supabase
        .from('audits')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      const reportsPromise = supabase
        .from('reports')
        .select('audit_id, overall_score, executive_summary, key_recommendation')
        .eq('user_id', userId);

      const [auditsRes, reportsRes] = await Promise.all([auditsPromise, reportsPromise]);

      if (auditsRes.error) throw auditsRes.error;

      const reportsMap: Record<string, Report> = {};
      if (reportsRes.data) {
        for (const r of reportsRes.data) {
          reportsMap[r.audit_id] = r as any;
        }
      } else if (reportsRes.error) {
        console.warn('[Dashboard] reports fetch error:', reportsRes.error.message);
      }

      setAudits((auditsRes.data || []).map((a: any) => ({ ...a, report: reportsMap[a.id] || null })));
    } catch (err: any) {
      const msg = err?.message || err?.error_description || JSON.stringify(err)
      console.error('[Dashboard] fetch error:', msg, err);
      setError(`Failed to load audits: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Verify any stuck pending_payment audits (Stripe webhook may be delayed)
  const verifyPendingAudits = useCallback(async (auditList: AuditWithReport[]) => {
    const pending = auditList.filter((a) => a.status === 'pending_payment');
    if (pending.length === 0) return;

    for (const audit of pending) {
      try {
        await fetch('/api/stripe/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audit_id: audit.id }),
        });
      } catch {}
    }
    // Re-fetch after verifications
    if (pending.length > 0 && user) {
      setTimeout(() => fetchAudits(user.id), 1500);
    }
  }, [user, fetchAudits]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    fetchAudits(user.id);
  }, [authLoading, user?.id, fetchAudits]);

  // After audits load, verify any pending ones
  useEffect(() => {
    if (audits.length > 0) {
      verifyPendingAudits(audits);
    }
  }, [audits.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 15s for in-progress audits
  useEffect(() => {
    if (!user) return;
    const hasInProgress = audits.some((a) =>
      ['payment_received', 'crawling', 'analysing', 'generating_report'].includes(a.status)
    );
    if (!hasInProgress) return;

    const iv = setInterval(() => fetchAudits(user.id), 8000);
    return () => clearInterval(iv);
  }, [audits, user, fetchAudits]);

  /* ── Skeleton (includes auth loading + data loading) ─── */
  if (authLoading || (loading && user)) {
    return (
      <div className="max-w-2xl mx-auto py-6 space-y-4">
        <div className="h-6 w-40 bg-off rounded animate-pulse" />
        <div className="h-3 w-28 bg-off rounded animate-pulse" />
        <div className="space-y-3 mt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-off rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const name = profile?.full_name?.split(' ')[0] || 'there';
  const has = audits.length > 0;

  return (
    <div className="max-w-2xl mx-auto py-2">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-text">Hey {name}</h1>
        <p className="text-muted text-xs mt-0.5">
          {has ? `${audits.length} audit${audits.length !== 1 ? 's' : ''}` : 'Run your first UX audit'}
        </p>
      </div>

      {/* Credits purchased banner */}
      {creditsBanner && (
        <div role="status" aria-live="polite" className="mb-5 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <Coins size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text">Credits added successfully!</p>
            <p className="text-xs text-muted">Your credits are ready to use. Start a new audit anytime.</p>
          </div>
        </div>
      )}

      {/* New Audit CTA */}
      <Link href="/dashboard/new-audit" className="block mb-5">
        <div className="relative overflow-hidden rounded-xl p-5 text-white transition-all hover:brightness-110 group" style={{ background: 'var(--gradient-brand)' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={20} className="text-white" />
                <span className="font-bold text-lg">New Audit</span>
              </div>
              <p className="text-white/60 text-sm">
                Paste a URL and get a professional UX report
              </p>
            </div>
            <ArrowRight size={22} className="text-white/40 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </Link>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-red-700 dark:text-red-300 text-xs">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !has && (
        <div className="text-center py-12">
          <FileSearch size={24} className="text-muted mx-auto mb-3" />
          <h2 className="font-semibold text-sm text-text mb-1">No audits yet</h2>
          <p className="text-muted text-xs mb-4 max-w-xs mx-auto">
            Create your first audit to see how your website scores across 95 UX checkpoints.
          </p>
          <Link
            href="/dashboard/new-audit"
            className="inline-flex items-center gap-1.5 text-white text-xs font-medium px-4 py-2 rounded-md transition-all hover:brightness-110"
            style={{ background: 'var(--gradient-brand)' }}
          >
            <Sparkles size={13} />
            Start Audit
          </Link>
        </div>
      )}

      {/* Audit list */}
      {has && (
        <div>
          <h2 className="text-xs font-semibold text-text mb-3">Your Audits</h2>
          <div className="flex flex-col" style={{ gap: '10px' }}>
            {audits.map((audit) => {
              const meta = statusMeta[audit.status] || statusMeta.pending_payment;
              const Icon = meta.icon;
              const report = audit.report;
              const done = audit.status === 'completed';

              return (
                <Link key={audit.id} href={`/dashboard/audits/${audit.id}`}>
                  <div className="bg-card border border-border rounded-lg px-4 py-3 hover:border-violet-400/30 transition-colors cursor-pointer group">
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
                          <span className="text-border">·</span>
                          <span className="flex items-center gap-0.5">
                            <Icon size={10} />
                            {meta.label}
                          </span>
                        </div>
                        {done && report?.executive_summary && (
                          <p className="text-muted text-[10px] mt-1 line-clamp-1">{report.executive_summary}</p>
                        )}
                      </div>

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
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto py-6 space-y-4">
        <div className="h-6 w-40 bg-off rounded animate-pulse" />
        <div className="h-3 w-28 bg-off rounded animate-pulse" />
        <div className="space-y-3 mt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-off rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    }>
      <DashboardInner />
    </Suspense>
  );
}
