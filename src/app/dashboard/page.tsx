'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Sparkles,
  Globe,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Zap,
  FileSearch,
  Coins,
  TrendingUp,
  RefreshCw,
  ChevronRight,
  X,
  Info,
  Loader2,
  Bell,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import type { Audit, Report } from '@/types/database';

/* ── Helpers ───────────────────────────────────────────────── */

interface AuditWithReport extends Audit {
  report: Report | null;
}

const statusMeta: Record<string, { label: string; icon: React.ElementType }> = {
  pending_payment:    { label: 'Awaiting payment', icon: Clock },
  payment_received:   { label: 'Processing',       icon: Zap },
  crawling:           { label: 'Crawling',          icon: Globe },
  analysing:          { label: 'Analysing',         icon: Sparkles },
  generating_report:  { label: 'Generating',        icon: FileSearch },
  completed:          { label: 'Completed',         icon: CheckCircle2 },
  failed:             { label: 'Failed',            icon: AlertTriangle },
};

function formatDate(d: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(d));
}

function formatUrl(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function scoreColor(s: number): string {
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
}

/* ── Main component ───────────────────────────────────────── */

function DashboardInner() {
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();
  const [audits, setAudits] = useState<AuditWithReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creditsBanner, setCreditsBanner] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [pinnedNotification, setPinnedNotification] = useState<{ id: string; title: string; message: string; color: string; icon: string } | null>(null);

  useEffect(() => {
    if (searchParams.get('credits') !== 'purchased') return;
    setCreditsBanner(true);
    window.history.replaceState({}, '', '/dashboard');
    const t = setTimeout(() => setCreditsBanner(false), 6000);
    fetch('/api/stripe/verify-credits', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => { if (d.verified) window.dispatchEvent(new Event('focus')); })
      .catch(() => {});
    return () => clearTimeout(t);
  }, [searchParams]);

  const fetchAudits = useCallback(async (userId: string) => {
    try {
      const supabase = createBrowserSupabase();
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
        for (const r of reportsRes.data) reportsMap[r.audit_id] = r as any;
      }
      setAudits((auditsRes.data || []).map((a: any) => ({ ...a, report: reportsMap[a.id] || null })));
    } catch (err: any) {
      setError(`Failed to load audits: ${err?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch('/api/credits').then(r => r.json()).then(d => setCredits(d.credits ?? 0)).catch(() => {});
    fetch('/api/notifications').then(r => r.json()).then(d => {
      const pinned = (d.notifications || []).find((n: any) => n.show_in_overview && !n.is_read);
      if (pinned) setPinnedNotification(pinned);
    }).catch(() => {});
  }, [user]);

  const verifyPendingAudits = useCallback(async (auditList: AuditWithReport[]) => {
    const pending = auditList.filter((a) => a.status === 'pending_payment');
    if (pending.length === 0) return;
    for (const audit of pending) {
      try {
        await fetch('/api/stripe/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audit_id: audit.id }) });
      } catch {}
    }
    if (pending.length > 0 && user) setTimeout(() => fetchAudits(user.id), 1500);
  }, [user, fetchAudits]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    fetchAudits(user.id);
  }, [authLoading, user?.id, fetchAudits]);

  useEffect(() => {
    if (audits.length > 0) verifyPendingAudits(audits);
  }, [audits.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    const hasInProgress = audits.some((a) =>
      ['payment_received', 'crawling', 'analysing', 'generating_report'].includes(a.status)
    );
    if (!hasInProgress) return;
    const iv = setInterval(() => fetchAudits(user.id), 8000);
    return () => clearInterval(iv);
  }, [audits, user, fetchAudits]);

  /* ── Skeleton ─── */
  if (authLoading || (loading && user)) {
    return (
      <div className="max-w-3xl mx-auto py-6 space-y-4">
        <div className="h-6 w-40 rounded animate-pulse" style={{ background: 'var(--paper-2)' }} />
        <div className="h-14 rounded-lg animate-pulse" style={{ background: 'var(--paper-2)' }} />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
      </div>
    );
  }

  const name = profile?.full_name?.split(' ')[0] || 'there';
  const isNewUser = audits.length === 0;
  const inProgressAudits = audits.filter(a =>
    ['payment_received', 'crawling', 'analysing', 'generating_report'].includes(a.status)
  );
  const failedAudits = audits.filter(a => a.status === 'failed');
  const completedAudits = audits.filter(a => a.status === 'completed');
  const completedCount = completedAudits.length;
  const latestCompleted = completedAudits[0] || null;

  const scoreTrendData = completedAudits
    .filter(a => a.report?.overall_score != null)
    .slice(0, 5)
    .reverse();
  const avgScore = scoreTrendData.length > 0
    ? Math.round(scoreTrendData.reduce((s, a) => s + (a.report?.overall_score ?? 0), 0) / scoreTrendData.length)
    : null;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em]" style={{ color: 'var(--ink)' }}>
          Hey {name}
        </h1>
        <p className="text-[14px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
          {isNewUser ? 'Run your first UX audit to get started.' : 'Here\'s what\'s happening with your audits.'}
        </p>
      </div>

      {/* Credits purchased banner */}
      {creditsBanner && (
        <div role="status" aria-live="polite" className="mb-5 px-4 py-3 rounded-lg flex items-center gap-3" style={{ background: 'rgba(63,107,63,0.06)', border: '1px solid rgba(63,107,63,0.12)' }}>
          <CheckCircle2 size={15} style={{ color: 'var(--ok)' }} />
          <p className="text-[13px]" style={{ color: 'var(--ink)' }}>Credits added to your account.</p>
        </div>
      )}

      {/* Onboarding for new users */}
      {isNewUser && (
        <div className="mb-8 rounded-lg p-6" style={{ border: '1px solid var(--rule)', background: 'var(--card)' }}>
          <h2 className="text-[15px] font-medium mb-4" style={{ color: 'var(--ink)' }}>Get started in 3 steps</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { step: '1', title: 'Paste your URL', desc: 'Enter any website to audit', icon: Globe },
              { step: '2', title: 'AI runs 96 checks', desc: 'Across 6 UX modules', icon: Sparkles },
              { step: '3', title: 'Get your report', desc: 'PDF, Word, and dashboard', icon: FileSearch },
            ].map((s) => (
              <div key={s.step} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium" style={{ background: 'var(--paper-2)', color: 'var(--m-muted)' }}>
                  {s.step}
                </span>
                <div>
                  <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{s.title}</p>
                  <p className="text-[12px]" style={{ color: 'var(--m-muted)' }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <Link
            href="/dashboard/new-audit"
            className="inline-flex items-center gap-1.5 mt-5 text-[13px] font-medium px-4 py-2 rounded-lg transition-all hover:opacity-90"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            <Sparkles size={13} />
            Start your first audit
          </Link>
        </div>
      )}

      {/* Pinned notification */}
      {pinnedNotification && (
        <div className="mb-5 px-4 py-3 rounded-lg flex items-start gap-3" style={{ background: 'var(--signal-soft)', border: '1px solid var(--signal-soft-2)' }}>
          <Bell size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--signal)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{pinnedNotification.title}</p>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--m-muted)' }}>{pinnedNotification.message}</p>
          </div>
          <button
            onClick={async () => {
              await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notification_id: pinnedNotification.id }) });
              setPinnedNotification(null);
              window.dispatchEvent(new Event('focus'));
            }}
            className="p-1 rounded-md transition-colors flex-shrink-0 hover:bg-black/5"
            style={{ color: 'var(--m-muted)' }}
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg" style={{ background: 'rgba(139,58,44,0.06)', border: '1px solid rgba(139,58,44,0.12)' }}>
          <p className="text-[13px]" style={{ color: 'var(--severe)' }}>{error}</p>
        </div>
      )}

      {/* Stats row */}
      {completedCount > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="rounded-lg px-4 py-4" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
            <p className="text-[12px] mb-1" style={{ color: 'var(--m-muted)' }}>Average score</p>
            <p className="text-[28px] font-semibold tabular-nums tracking-[-0.02em]" style={{ color: avgScore ? scoreColor(avgScore) : 'var(--ink)' }}>
              {avgScore ?? '--'}
            </p>
          </div>
          <div className="rounded-lg px-4 py-4" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
            <p className="text-[12px] mb-1" style={{ color: 'var(--m-muted)' }}>Audits completed</p>
            <p className="text-[28px] font-semibold tabular-nums tracking-[-0.02em]" style={{ color: 'var(--ink)' }}>
              {completedCount}
            </p>
          </div>
          <div className="rounded-lg px-4 py-4" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
            <p className="text-[12px] mb-1" style={{ color: 'var(--m-muted)' }}>Credits remaining</p>
            <p className="text-[28px] font-semibold tabular-nums tracking-[-0.02em]" style={{ color: 'var(--ink)' }}>
              {credits ?? '--'}
            </p>
          </div>
        </div>
      )}

      {/* In Progress / Failed */}
      {(inProgressAudits.length > 0 || failedAudits.length > 0) && (
        <div className="mb-8">
          <h2 className="text-[13px] font-medium mb-3" style={{ color: 'var(--m-muted)' }}>
            {inProgressAudits.length > 0 ? 'In progress' : 'Needs attention'}
          </h2>
          <div className="space-y-2">
            {inProgressAudits.map((audit) => {
              const meta = statusMeta[audit.status] || statusMeta.payment_received;
              return (
                <Link key={audit.id} href={`/dashboard/audits/${audit.id}`}>
                  <div className="rounded-lg px-4 py-3 transition-all hover:bg-black/[0.02] flex items-center gap-3" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
                    <Loader2 size={14} className="animate-spin flex-shrink-0" style={{ color: 'var(--signal)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>{formatUrl(audit.product_url || '')}</p>
                      <p className="text-[12px] mt-0.5" style={{ color: 'var(--m-muted)' }}>{meta.label}</p>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--m-muted-2)' }} />
                  </div>
                </Link>
              );
            })}
            {failedAudits.map((audit) => (
              <Link key={audit.id} href={`/dashboard/audits/${audit.id}`}>
                <div className="rounded-lg px-4 py-3 transition-all hover:bg-black/[0.02] flex items-center gap-3" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
                  <AlertTriangle size={14} style={{ color: 'var(--severe)' }} className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>{formatUrl(audit.product_url || '')}</p>
                    <p className="text-[12px] mt-0.5" style={{ color: 'var(--m-muted)' }}>Failed &middot; credit refunded</p>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--m-muted-2)' }} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Latest completed audit */}
      {latestCompleted && latestCompleted.report && (
        <div className="mb-8">
          <h2 className="text-[13px] font-medium mb-3" style={{ color: 'var(--m-muted)' }}>Latest audit</h2>
          <Link href={`/dashboard/audits/${latestCompleted.id}`}>
            <div className="rounded-lg p-4 transition-all hover:bg-black/[0.02] flex items-center gap-4" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--paper-2)' }}>
                <span className="text-[20px] font-semibold tabular-nums" style={{ color: scoreColor(latestCompleted.report!.overall_score ?? 0) }}>
                  {latestCompleted.report!.overall_score ?? 0}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium truncate" style={{ color: 'var(--ink)' }}>{formatUrl(latestCompleted.product_url || '')}</p>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
                  {formatDate(latestCompleted.created_at)}
                  {latestCompleted.report?.key_recommendation && ` · ${latestCompleted.report.key_recommendation.slice(0, 60)}...`}
                </p>
              </div>
              <ChevronRight size={14} style={{ color: 'var(--m-muted-2)' }} />
            </div>
          </Link>
        </div>
      )}

      {/* Score trend */}
      {scoreTrendData.length >= 2 && (
        <div className="mb-8">
          <h2 className="text-[13px] font-medium mb-3" style={{ color: 'var(--m-muted)' }}>Score trend</h2>
          <div className="rounded-lg p-4" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
            <div className="flex items-end gap-2 h-16">
              {scoreTrendData.map((a) => {
                const score = a.report?.overall_score ?? 0;
                return (
                  <div key={a.id} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[11px] font-medium tabular-nums" style={{ color: 'var(--ink)' }}>{score}</span>
                    <div
                      className="w-full rounded-sm"
                      style={{ height: `${Math.max(score * 0.5, 4)}px`, background: scoreColor(score) }}
                    />
                    <span className="text-[10px] truncate w-full text-center" style={{ color: 'var(--m-muted)' }}>{formatDate(a.created_at)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      {!isNewUser && (
        <div className="mb-8">
          <h2 className="text-[13px] font-medium mb-3" style={{ color: 'var(--m-muted)' }}>Quick actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'New audit', desc: 'Run a new UX audit', href: '/dashboard/new-audit', icon: Sparkles },
              { label: 'All audits', desc: `${completedCount} completed`, href: '/dashboard/audits', icon: FileSearch },
              { label: 'Buy credits', desc: `${credits ?? '--'} remaining`, href: '/dashboard/buy-credits', icon: Coins },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.href} href={action.href} className="rounded-lg px-4 py-3.5 transition-all hover:bg-black/[0.02] group" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
                  <div className="flex items-center gap-3">
                    <Icon size={16} style={{ color: 'var(--m-muted)' }} />
                    <div>
                      <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{action.label}</p>
                      <p className="text-[12px]" style={{ color: 'var(--m-muted)' }}>{action.desc}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state for existing users with no recent activity */}
      {!isNewUser && inProgressAudits.length === 0 && failedAudits.length === 0 && !latestCompleted && (
        <div className="text-center py-12">
          <CheckCircle2 size={20} className="mx-auto mb-2" style={{ color: 'var(--ok)' }} />
          <p className="text-[14px] font-medium" style={{ color: 'var(--ink)' }}>All clear</p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
            No audits in progress. Your completed audits are in the Audits tab.
          </p>
        </div>
      )}

      {/* Empty state for brand new users */}
      {isNewUser && (
        <div className="text-center py-8">
          <FileSearch size={20} className="mx-auto mb-2" style={{ color: 'var(--m-muted)' }} />
          <p className="text-[14px] font-medium" style={{ color: 'var(--ink)' }}>No audits yet</p>
          <p className="text-[12px] mt-0.5 max-w-xs mx-auto" style={{ color: 'var(--m-muted)' }}>
            Create your first audit to see how your website scores across 96 UX checkpoints.
          </p>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="max-w-3xl mx-auto py-6 space-y-4">
        <div className="h-6 w-40 rounded animate-pulse" style={{ background: 'var(--paper-2)' }} />
        <div className="h-14 rounded-lg animate-pulse" style={{ background: 'var(--paper-2)' }} />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
      </div>
    }>
      <DashboardInner />
    </Suspense>
  );
}
