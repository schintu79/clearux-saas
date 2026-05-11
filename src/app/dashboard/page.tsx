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
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
}

/* ── Onboarding steps ─────────────────────────────────────── */

function OnboardingBanner() {
  return (
    <div className="mb-6 rounded-xl p-5" style={{ border: '1px solid var(--rule)', background: 'var(--signal-soft)' }}>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={18} style={{ color: 'var(--signal)' }} />
        <h2 className="font-sans text-[18px] font-normal" style={{ color: 'var(--ink)' }}>Welcome to ClearUX</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { step: '1', title: 'Paste your URL', desc: 'Enter any website to audit', icon: Globe },
          { step: '2', title: 'AI analyses 96 checkpoints', desc: 'Across 6 UX modules', icon: Sparkles },
          { step: '3', title: 'Get your report', desc: 'PDF, Word, and dashboard', icon: FileSearch },
        ].map((s) => (
          <div key={s.step} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
            <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono font-medium" style={{ background: 'var(--signal)', color: '#FFFFFF' }}>
              {s.step}
            </span>
            <div>
              <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{s.title}</p>
              <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>{s.desc}</p>
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
    <div className="mb-4 p-3 rounded-xl flex items-start gap-3" style={{ background: 'var(--signal-soft)', border: '1px solid var(--signal-soft-2)' }}>
      <Info size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--signal)' }} />
      <div className="flex-1 min-w-0 text-[12px]" style={{ color: 'var(--ink-2)' }}>{children}</div>
      <button
        onClick={() => { setDismissed(true); sessionStorage.setItem(`clearux_tip_${id}`, '1'); }}
        className="p-1 rounded-md transition-colors flex-shrink-0"
        style={{ color: 'var(--m-muted)' }}
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
        <div className="h-6 w-40 rounded animate-pulse" style={{ background: 'var(--paper-2)' }} />
        <div className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />
          <div className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />
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
      <div className="mb-8">
        <h1 className="font-sans text-[32px] font-normal leading-tight" style={{ color: 'var(--ink)' }}>
          Hey {name}
        </h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--m-muted)' }}>
          {isNewUser ? 'Run your first UX audit' : 'Your audit overview'}
        </p>
      </div>

      {/* Credits purchased banner */}
      {creditsBanner && (
        <div role="status" aria-live="polite" className="mb-5 p-3.5 rounded-xl flex items-center gap-3" style={{ background: 'rgba(63,107,63,0.06)', border: '1px solid rgba(63,107,63,0.15)' }}>
          <Coins size={16} style={{ color: 'var(--ok)' }} />
          <div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>Credits added successfully</p>
            <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>Your credits are ready to use.</p>
          </div>
        </div>
      )}

      {/* Onboarding for new users */}
      {isNewUser && <OnboardingBanner />}

      {/* ── Pinned notification from admin ── */}
      {pinnedNotification && (
        <div className="mb-5 p-3.5 rounded-xl flex items-start gap-3" style={{ background: 'var(--signal-soft)', border: '1px solid var(--signal-soft-2)' }}>
          <Bell size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--signal)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{pinnedNotification.title}</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--m-muted)' }}>{pinnedNotification.message}</p>
          </div>
          <button
            onClick={async () => {
              await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notification_id: pinnedNotification.id }) });
              setPinnedNotification(null);
              window.dispatchEvent(new Event('focus'));
            }}
            className="p-1 rounded-md transition-colors flex-shrink-0"
            style={{ color: 'var(--m-muted)' }}
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(139,58,44,0.06)', border: '1px solid rgba(139,58,44,0.15)' }}>
          <p className="text-[13px]" style={{ color: 'var(--severe)' }}>{error}</p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          SECTION 1: Quick Actions
          ════════════════════════════════════════════════════════ */}
      <section className="mb-10">
        <h2 className="font-mono text-[10px] tracking-[0.1em] uppercase mb-3" style={{ color: 'var(--m-muted-2)' }}>Quick actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/dashboard/new-audit" className="rounded-xl p-5 transition-all hover:shadow-sm group" style={{ border: '1px solid var(--rule)', background: 'var(--paper)' }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: 'var(--signal-soft)' }}>
              <Sparkles size={18} style={{ color: 'var(--signal)' }} />
            </div>
            <p className="text-[14px] font-medium mb-0.5" style={{ color: 'var(--ink)' }}>Run new audit</p>
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>Paste a URL and get results in minutes</p>
          </Link>
          <Link href="/dashboard/audits" className="rounded-xl p-5 transition-all hover:shadow-sm group" style={{ border: '1px solid var(--rule)', background: 'var(--paper)' }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: 'var(--signal-soft)' }}>
              <FileSearch size={18} style={{ color: 'var(--signal)' }} />
            </div>
            <p className="text-[14px] font-medium mb-0.5" style={{ color: 'var(--ink)' }}>View reports</p>
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>{completedCount} completed audit{completedCount !== 1 ? 's' : ''}</p>
          </Link>
          <Link href="/dashboard/buy-credits" className="rounded-xl p-5 transition-all hover:shadow-sm group" style={{ border: '1px solid var(--rule)', background: 'var(--paper)' }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: 'var(--signal-soft)' }}>
              <Coins size={18} style={{ color: 'var(--signal)' }} />
            </div>
            <p className="text-[14px] font-medium mb-0.5" style={{ color: 'var(--ink)' }}>Buy credits</p>
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>{credits ?? '--'} credit{credits !== 1 ? 's' : ''} remaining</p>
          </Link>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          SECTION 2: Your Latest Audit
          ════════════════════════════════════════════════════════ */}
      {latestCompleted && latestCompleted.report && (
        <section className="mb-10">
          <h2 className="font-mono text-[10px] tracking-[0.1em] uppercase mb-3" style={{ color: 'var(--m-muted-2)' }}>Your latest audit</h2>
          {(() => {
            const latestScore = latestCompleted.report!.overall_score ?? 0;
            return (
          <Link href={`/dashboard/audits/${latestCompleted.id}`}>
            <div className="rounded-xl p-5 transition-all hover:shadow-sm" style={{ border: '1px solid var(--rule)', background: 'var(--paper)' }}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ border: `1px solid var(--rule)`, background: 'var(--paper-2)' }}>
                  <span className="font-sans text-[24px] font-normal" style={{ color: scoreColor(latestScore) }}>
                    {latestScore}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium truncate" style={{ color: 'var(--ink)' }}>{formatUrl(latestCompleted.product_url || '')}</p>
                  <p className="text-[12px] mt-0.5" style={{ color: 'var(--m-muted)' }}>{formatDate(latestCompleted.created_at)} · {latestScore >= 70 ? 'Good' : latestScore >= 40 ? 'Needs work' : 'Poor'}</p>
                  {latestCompleted.report.key_recommendation && (
                    <p className="text-[12px] mt-1.5 leading-relaxed line-clamp-2" style={{ color: 'var(--m-muted)' }}>
                      {latestCompleted.report.key_recommendation}
                    </p>
                  )}
                </div>
                <ChevronRight size={16} className="flex-shrink-0" style={{ color: 'var(--m-muted)' }} />
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
        <section className="mb-10">
          <h2 className="font-mono text-[10px] tracking-[0.1em] uppercase mb-3" style={{ color: 'var(--m-muted-2)' }}>
            {inProgressAudits.length > 0 ? 'Processing' : 'Attention needed'}
          </h2>
          <div className="space-y-2.5">
            {inProgressAudits.map((audit) => {
              const meta = statusMeta[audit.status] || statusMeta.payment_received;
              const Icon = meta.icon;
              return (
                <Link key={audit.id} href={`/dashboard/audits/${audit.id}`}>
                  <div className="rounded-xl px-4 py-3.5 transition-all hover:shadow-sm flex items-center gap-3" style={{ border: '1px solid var(--rule)', background: 'var(--paper)' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--signal-soft)' }}>
                      <Loader2 size={14} className="animate-spin" style={{ color: 'var(--signal)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[13px] truncate" style={{ color: 'var(--ink)' }}>{formatUrl(audit.product_url || '')}</p>
                      <div className="flex items-center gap-2 text-[11px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
                        <span>{formatDate(audit.created_at)}</span>
                        <span style={{ color: 'var(--rule)' }}>·</span>
                        <span className="flex items-center gap-0.5 font-medium" style={{ color: 'var(--signal)' }}>
                          <Icon size={10} />
                          {meta.label}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={14} className="flex-shrink-0" style={{ color: 'var(--m-muted)' }} />
                  </div>
                </Link>
              );
            })}
            {failedAudits.map((audit) => (
              <Link key={audit.id} href={`/dashboard/audits/${audit.id}`}>
                <div className="rounded-xl px-4 py-3.5 transition-all hover:shadow-sm flex items-center gap-3" style={{ border: '1px solid rgba(139,58,44,0.2)', background: 'var(--paper)' }}>
                  <AlertTriangle size={16} style={{ color: 'var(--severe)' }} className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[13px] truncate" style={{ color: 'var(--ink)' }}>{formatUrl(audit.product_url || '')}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--m-muted)' }}>{formatDate(audit.created_at)} · Credit refunded</p>
                  </div>
                  <ChevronRight size={14} className="flex-shrink-0" style={{ color: 'var(--m-muted)' }} />
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
        <section className="mb-10">
          <h2 className="font-mono text-[10px] tracking-[0.1em] uppercase mb-3" style={{ color: 'var(--m-muted-2)' }}>Your progress</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl p-5" style={{ border: '1px solid var(--rule)', background: 'var(--paper)' }}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={14} style={{ color: 'var(--signal)' }} />
                <p className="text-[11px] font-mono tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>Average score</p>
              </div>
              <p className="font-sans text-[36px] font-normal" style={{ color: avgScore ? scoreColor(avgScore) : 'var(--ink)' }}>
                {avgScore ?? '--'}
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--m-muted)' }}>across {completedCount} audit{completedCount !== 1 ? 's' : ''}</p>
            </div>
            <div className="rounded-xl p-5" style={{ border: '1px solid var(--rule)', background: 'var(--paper)' }}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={14} style={{ color: 'var(--ok)' }} />
                <p className="text-[11px] font-mono tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>Completed</p>
              </div>
              <p className="font-sans text-[36px] font-normal" style={{ color: 'var(--ink)' }}>{completedCount}</p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--m-muted)' }}>total audit{completedCount !== 1 ? 's' : ''} run</p>
            </div>
            <div className="rounded-xl p-5" style={{ border: '1px solid var(--rule)', background: 'var(--paper)' }}>
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw size={14} style={{ color: 'var(--warn)' }} />
                <p className="text-[11px] font-mono tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>Re-audits</p>
              </div>
              <p className="font-sans text-[36px] font-normal" style={{ color: 'var(--ink)' }}>
                {audits.filter(a => a.status === 'completed' && (a as any).is_reaudit).length}
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--m-muted)' }}>improvement checks</p>
            </div>
          </div>

          {/* Score trend mini-chart */}
          {scoreTrendData.length >= 2 && (
            <div className="mt-3 rounded-xl p-5" style={{ border: '1px solid var(--rule)', background: 'var(--paper)' }}>
              <p className="text-[11px] font-mono tracking-[0.04em] uppercase mb-4" style={{ color: 'var(--m-muted)' }}>Score trend</p>
              <div className="flex items-end gap-1.5 h-16">
                {scoreTrendData.map((a) => {
                  const score = a.report?.overall_score ?? 0;
                  return (
                    <div key={a.id} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[11px] font-mono font-medium" style={{ color: 'var(--ink)' }}>{score}</span>
                      <div
                        className="w-full rounded-t-md"
                        style={{ height: `${Math.max(score * 0.5, 4)}px`, background: scoreColor(score) }}
                      />
                      <span className="text-[10px] truncate w-full text-center" style={{ color: 'var(--m-muted)' }}>{formatDate(a.created_at)}</span>
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
          <CheckCircle2 size={22} className="mx-auto mb-2" style={{ color: 'var(--ok)' }} />
          <p className="text-[14px] font-medium mb-0.5" style={{ color: 'var(--ink)' }}>All clear</p>
          <p className="text-[12px] max-w-xs mx-auto leading-relaxed" style={{ color: 'var(--m-muted)' }}>
            No audits in progress. Your completed audits are in the Audits tab.
          </p>
        </div>
      )}

      {!isNewUser && (
        <DismissableTip id="track">
          <span className="font-medium">Track your improvement</span> — fix the issues, then re-audit the same URL to compare your scores over time.
        </DismissableTip>
      )}

      {/* ── New user empty state ── */}
      {isNewUser && (
        <div className="text-center py-8">
          <FileSearch size={24} className="mx-auto mb-3" style={{ color: 'var(--m-muted)' }} />
          <h2 className="font-sans text-[18px] font-normal mb-1" style={{ color: 'var(--ink)' }}>No audits yet</h2>
          <p className="text-[13px] mb-4 max-w-xs mx-auto leading-relaxed" style={{ color: 'var(--m-muted)' }}>
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
        <div className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />
          <div className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />
        </div>
      </div>
    }>
      <DashboardInner />
    </Suspense>
  );
}
