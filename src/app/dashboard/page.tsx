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
  Coins,
  TrendingUp,
  RefreshCw,
  ChevronRight,
  X,
  Info,
  Loader2,
  Bell,
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
  if (s >= 70) return 'text-[#22C55E]';
  if (s >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-[#EF4444]';
}

function scoreBg(s: number) {
  if (s >= 70) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (s >= 40) return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

/* ── Onboarding steps ─────────────────────────────────────── */

function OnboardingBanner() {
  return (
    <div className="mb-5 rounded-xl border border-brand/20 dark:border-brand/10 p-5" style={{ background: 'var(--gradient-brand-subtle)' }}>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={18} className="text-brand" />
        <h2 className="font-heading font-semibold text-base text-text">Welcome to ClearUX</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { step: '1', title: 'Paste your URL', desc: 'Enter any website to audit', icon: Globe },
          { step: '2', title: 'AI analyses 64 checkpoints', desc: 'Across 16 UX categories', icon: Sparkles },
          { step: '3', title: 'Get your report', desc: 'PDF, Word, and dashboard', icon: FileSearch },
        ].map((s) => (
          <div key={s.step} className="flex items-start gap-3 p-3 rounded-lg bg-card/80 dark:bg-white/[0.04] border border-border/20 dark:border-white/[0.04]">
            <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-surface dark:text-[#111111] bg-brand">
              {s.step}
            </span>
            <div>
              <p className="text-xs font-bold text-text">{s.title}</p>
              <p className="text-[11px] text-muted">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Dismissable tip ──────────────────────────────────────── */
function DismissableTip({ id, children }: { id: string; children: React.ReactNode }) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(`clearux_tip_${id}`) === '1';
  });
  if (dismissed) return null;
  return (
    <div className="mb-4 p-3 rounded-xl bg-blue-50/60 dark:bg-blue-900/10 border border-blue-200/40 dark:border-blue-800/20 flex items-start gap-3">
      <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 text-xs text-blue-800 dark:text-blue-300">{children}</div>
      <button
        onClick={() => { setDismissed(true); sessionStorage.setItem(`clearux_tip_${id}`, '1'); }}
        className="p-1 rounded-md text-blue-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-800/20 transition-colors flex-shrink-0"
        aria-label="Dismiss"
      >
        <X size={12} />
      </button>
    </div>
  );
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

  // Handle return from Stripe credit purchase
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

  // Fetch credits + pinned notification
  useEffect(() => {
    if (!user) return;
    fetch('/api/credits').then(r => r.json()).then(d => setCredits(d.credits ?? 0)).catch(() => {});
    fetch('/api/notifications').then(r => r.json()).then(d => {
      const pinned = (d.notifications || []).find((n: any) => n.show_in_overview && !n.is_read);
      if (pinned) setPinnedNotification(pinned);
    }).catch(() => {});
  }, [user]);

  // Verify pending audits
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

  // Auto-refresh for in-progress audits
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
        <div className="h-6 w-40 bg-off rounded animate-pulse" />
        <div className="h-14 bg-off rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-16 bg-off rounded-xl animate-pulse" />
          <div className="h-16 bg-off rounded-xl animate-pulse" />
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
  const totalAudits = audits.length;

  // Score trend data
  const scoreTrendData = completedAudits
    .filter(a => a.report?.overall_score != null)
    .slice(0, 5)
    .reverse();
  const avgScore = scoreTrendData.length > 0
    ? Math.round(scoreTrendData.reduce((s, a) => s + (a.report?.overall_score ?? 0), 0) / scoreTrendData.length)
    : null;

  return (
    <div className="max-w-4xl mx-auto py-2">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading text-lg font-semibold text-text">Hey {name}</h1>
        <p className="text-muted text-xs mt-0.5">
          {isNewUser ? 'Run your first UX audit' : 'Your audit overview'}
        </p>
      </div>

      {/* Credits purchased banner */}
      {creditsBanner && (
        <div role="status" aria-live="polite" className="mb-4 p-3.5 rounded-xl bg-[#22C55E]/5 dark:bg-[#22C55E]/10 border border-[#22C55E]/20 dark:border-[#22C55E]/20 flex items-center gap-3">
          <Coins size={16} className="text-[#22C55E] flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-text">Credits added successfully!</p>
            <p className="text-[11px] text-muted">Your credits are ready to use.</p>
          </div>
        </div>
      )}

      {/* Onboarding for new users */}
      {isNewUser && <OnboardingBanner />}

      {/* ── Pinned notification from admin ── */}
      {pinnedNotification && (
        <div className={`mb-5 p-3.5 rounded-xl border flex items-start gap-3 ${
          pinnedNotification.color === 'green' ? 'border-green-200/40 bg-green-50/60 dark:bg-green-900/10 dark:border-green-800/20' :
          pinnedNotification.color === 'yellow' ? 'border-yellow-200/40 bg-yellow-50/60 dark:bg-yellow-900/10 dark:border-yellow-800/20' :
          pinnedNotification.color === 'red' ? 'border-red-200/40 bg-red-50/60 dark:bg-red-900/10 dark:border-red-800/20' :
          pinnedNotification.color === 'violet' ? 'border-brand/20 bg-brand/5 dark:bg-brand/5 dark:border-brand/10' :
          'border-blue-200/40 bg-blue-50/60 dark:bg-blue-900/10 dark:border-blue-800/20'
        }`}>
          <Bell size={14} className={`flex-shrink-0 mt-0.5 ${
            pinnedNotification.color === 'green' ? 'text-green-500' :
            pinnedNotification.color === 'yellow' ? 'text-yellow-500' :
            pinnedNotification.color === 'red' ? 'text-red-500' :
            pinnedNotification.color === 'violet' ? 'text-brand' :
            'text-blue-500'
          }`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-text">{pinnedNotification.title}</p>
            <p className="text-[11px] text-muted mt-0.5">{pinnedNotification.message}</p>
          </div>
          <button
            onClick={async () => {
              await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notification_id: pinnedNotification.id }) });
              setPinnedNotification(null);
              window.dispatchEvent(new Event('focus'));
            }}
            className="p-1 rounded-md text-muted hover:text-text hover:bg-white/50 dark:hover:bg-white/[0.05] transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-red-700 dark:text-red-300 text-xs">{error}</p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          SECTION 1: Quick Actions
          ════════════════════════════════════════════════════════ */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Quick actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/dashboard/new-audit" className="rounded-xl border border-border/30 dark:border-white/[0.06] bg-card p-4 hover:border-brand/30 transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center mb-3">
              <Sparkles size={20} className="text-brand" />
            </div>
            <p className="text-sm font-semibold text-text mb-0.5">Run new audit</p>
            <p className="text-xs text-muted leading-relaxed">Paste a URL and get results in minutes</p>
          </Link>
          <Link href="/dashboard/audits" className="rounded-xl border border-border/30 dark:border-white/[0.06] bg-card p-4 hover:border-brand/30 transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center mb-3">
              <FileSearch size={20} className="text-brand" />
            </div>
            <p className="text-sm font-semibold text-text mb-0.5">View reports</p>
            <p className="text-xs text-muted leading-relaxed">{completedCount} completed audit{completedCount !== 1 ? 's' : ''}</p>
          </Link>
          <Link href="/dashboard/buy-credits" className="rounded-xl border border-border/30 dark:border-white/[0.06] bg-card p-4 hover:border-[#22C55E]/30 transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-[#22C55E]/10 flex items-center justify-center mb-3">
              <Coins size={20} className="text-[#22C55E]" />
            </div>
            <p className="text-sm font-semibold text-text mb-0.5">Buy credits</p>
            <p className="text-xs text-muted leading-relaxed">{credits ?? '--'} credit{credits !== 1 ? 's' : ''} remaining</p>
          </Link>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          SECTION 2: Your Latest Audit
          ════════════════════════════════════════════════════════ */}
      {latestCompleted && latestCompleted.report && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Your latest audit</h2>
          {(() => {
            const latestScore = latestCompleted.report!.overall_score ?? 0;
            return (
          <Link href={`/dashboard/audits/${latestCompleted.id}`}>
            <div className="rounded-xl border border-border/30 dark:border-white/[0.06] bg-card p-5 hover:border-brand/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                  latestScore >= 70 ? 'border-[#22C55E]/20 bg-[#22C55E]/5' :
                  latestScore >= 40 ? 'border-amber-500/20 bg-amber-500/5' :
                  'border-red-500/20 bg-red-500/5'
                }`}>
                  <span className={`font-heading text-2xl font-bold ${scoreColor(latestScore)}`}>
                    {latestScore}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text truncate">{formatUrl(latestCompleted.product_url)}</p>
                  <p className="text-xs text-muted mt-0.5">{formatDate(latestCompleted.created_at)} · {latestScore >= 70 ? 'Good' : latestScore >= 40 ? 'Needs work' : 'Poor'}</p>
                  {latestCompleted.report.key_recommendation && (
                    <p className="text-xs text-muted mt-1.5 leading-relaxed line-clamp-2">
                      {latestCompleted.report.key_recommendation}
                    </p>
                  )}
                </div>
                <ChevronRight size={16} className="text-muted flex-shrink-0" />
              </div>
            </div>
          </Link>
            );
          })()}
        </section>
      )}

      {/* ════════════════════════════════════════════════════════
          SECTION 3: In Progress / Failed
          ════════════════════════════════════════════════════════ */}
      {(inProgressAudits.length > 0 || failedAudits.length > 0) && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
            {inProgressAudits.length > 0 ? 'Processing' : 'Attention needed'}
          </h2>
          <div className="space-y-2.5">
            {inProgressAudits.map((audit) => {
              const meta = statusMeta[audit.status] || statusMeta.payment_received;
              const Icon = meta.icon;
              return (
                <Link key={audit.id} href={`/dashboard/audits/${audit.id}`}>
                  <div className="bg-card border border-border/40 dark:border-white/[0.06] rounded-xl px-4 py-3.5 hover:border-brand/30 transition-colors flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0">
                      <Loader2 size={14} className="text-brand animate-spin" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-text truncate">{formatUrl(audit.product_url)}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted mt-0.5">
                        <span>{formatDate(audit.created_at)}</span>
                        <span className="text-border">·</span>
                        <span className="flex items-center gap-0.5 text-brand font-medium">
                          <Icon size={10} />
                          {meta.label}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-muted flex-shrink-0" />
                  </div>
                </Link>
              );
            })}
            {failedAudits.map((audit) => (
              <Link key={audit.id} href={`/dashboard/audits/${audit.id}`}>
                <div className="bg-card border border-red-200/40 dark:border-red-800/20 rounded-xl px-4 py-3.5 hover:border-red-400/30 transition-colors flex items-center gap-3">
                  <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-text truncate">{formatUrl(audit.product_url)}</p>
                    <p className="text-[10px] text-muted mt-0.5">{formatDate(audit.created_at)} · Credit refunded</p>
                  </div>
                  <ChevronRight size={14} className="text-muted flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════
          SECTION 4: Your Progress
          ════════════════════════════════════════════════════════ */}
      {completedCount > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Your progress</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/30 dark:border-white/[0.06] bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={14} className="text-brand" />
                <p className="text-xs font-semibold text-muted">Average score</p>
              </div>
              <p className={`font-heading text-3xl font-bold ${avgScore ? scoreColor(avgScore) : 'text-text'}`}>
                {avgScore ?? '--'}
              </p>
              <p className="text-[11px] text-muted mt-1">across {completedCount} audit{completedCount !== 1 ? 's' : ''}</p>
            </div>
            <div className="rounded-xl border border-border/30 dark:border-white/[0.06] bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={14} className="text-[#22C55E]" />
                <p className="text-xs font-semibold text-muted">Completed</p>
              </div>
              <p className="font-heading text-3xl font-bold text-text">{completedCount}</p>
              <p className="text-[11px] text-muted mt-1">total audit{completedCount !== 1 ? 's' : ''} run</p>
            </div>
            <div className="rounded-xl border border-border/30 dark:border-white/[0.06] bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw size={14} className="text-amber-500" />
                <p className="text-xs font-semibold text-muted">Re-audits</p>
              </div>
              <p className="font-heading text-3xl font-bold text-text">
                {audits.filter(a => a.status === 'completed' && (a as any).is_reaudit).length}
              </p>
              <p className="text-[11px] text-muted mt-1">improvement checks</p>
            </div>
          </div>

          {/* Score trend mini-chart */}
          {scoreTrendData.length >= 2 && (
            <div className="mt-3 rounded-xl border border-border/30 dark:border-white/[0.06] bg-card p-4">
              <p className="text-xs font-semibold text-muted mb-3">Score trend</p>
              <div className="flex items-end gap-1.5 h-16">
                {scoreTrendData.map((a, i) => {
                  const score = a.report?.overall_score ?? 0;
                  return (
                    <div key={a.id} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-bold text-text">{score}</span>
                      <div
                        className={`w-full rounded-t-md ${score >= 70 ? 'bg-[#22C55E]' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ height: `${Math.max(score * 0.5, 4)}px` }}
                      />
                      <span className="text-[9px] text-muted truncate w-full text-center">{formatDate(a.created_at)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Tips ── */}
      {!isNewUser && inProgressAudits.length === 0 && failedAudits.length === 0 && !latestCompleted && (
        <div className="text-center py-8 px-4">
          <CheckCircle2 size={22} className="text-[#22C55E] mx-auto mb-2" />
          <p className="text-sm font-medium text-text mb-0.5">All clear</p>
          <p className="text-xs text-muted max-w-xs mx-auto leading-relaxed">
            No audits in progress. Your completed audits are in the Audits tab.
          </p>
        </div>
      )}

      {!isNewUser && (
        <DismissableTip id="track">
          <span className="font-semibold">Track your improvement</span> — fix the issues, then re-audit the same URL to compare your scores over time.
        </DismissableTip>
      )}

      {/* ── New user empty state ── */}
      {isNewUser && (
        <div className="text-center py-8">
          <FileSearch size={24} className="text-muted mx-auto mb-3" />
          <h2 className="font-semibold text-sm text-text mb-1">No audits yet</h2>
          <p className="text-muted text-xs mb-4 max-w-xs mx-auto leading-relaxed">
            Create your first audit to see how your website scores across 64 UX checkpoints.
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
        <div className="h-6 w-40 bg-off rounded animate-pulse" />
        <div className="h-14 bg-off rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-16 bg-off rounded-xl animate-pulse" />
          <div className="h-16 bg-off rounded-xl animate-pulse" />
        </div>
      </div>
    }>
      <DashboardInner />
    </Suspense>
  );
}
