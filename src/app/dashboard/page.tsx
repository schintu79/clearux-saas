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
  TrendingUp,
  RefreshCw,
  ChevronRight,
  X,
  Info,
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

function langCode(code: string | null): string {
  if (!code || code === 'en') return '';
  return code.toUpperCase();
}

/* ── Onboarding steps ─────────────────────────────────────── */

function OnboardingBanner() {
  return (
    <div className="mb-5 rounded-xl border border-violet-200/40 dark:border-violet-800/20 p-5" style={{ background: 'var(--gradient-brand-subtle)' }}>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={18} className="text-violet-500" />
        <h2 className="font-manrope font-bold text-base text-text">Welcome to ClearUX</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { step: '1', title: 'Paste your URL', desc: 'Enter any website to audit', icon: Globe },
          { step: '2', title: 'AI analyses 64 checkpoints', desc: 'Across 16 UX categories', icon: Sparkles },
          { step: '3', title: 'Get your report', desc: 'PDF, Word, and dashboard', icon: FileSearch },
        ].map((s) => (
          <div key={s.step} className="flex items-start gap-3 p-3 rounded-lg bg-card/80 dark:bg-white/[0.04] border border-border/20 dark:border-white/[0.04]">
            <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: 'var(--gradient-brand)' }}>
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

/* ── Dismissable notification tip ─────────────────────────── */
function TrackImprovementTip({ show }: { show: boolean }) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('clearux_tip_dismissed') === '1';
  });

  if (!show || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('clearux_tip_dismissed', '1');
  };

  return (
    <div className="mt-4 p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-900/10 border border-blue-200/40 dark:border-blue-800/20 flex items-start gap-3">
      <Info size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-blue-900 dark:text-blue-300">Track your improvement</p>
        <p className="text-[11px] text-blue-700/70 dark:text-blue-400/60 mt-0.5">Fix the issues, then re-audit the same URL to compare your scores over time.</p>
      </div>
      <button
        onClick={handleDismiss}
        className="p-1 rounded-md text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/20 transition-colors flex-shrink-0"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/* ── Site Group — groups audits by domain ─────────────────── */
function SiteGroup({ domain, audits }: { domain: string; audits: AuditWithReport[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasMultiple = audits.length > 1;
  const latest = audits[0]; // already sorted newest first
  const latestMeta = statusMeta[latest.status] || statusMeta.pending_payment;
  const LatestIcon = latestMeta.icon;
  const latestDone = latest.status === 'completed';
  const latestScore = latestDone ? (latest.report?.overall_score ?? null) : null;

  // Score trend for multi-audit sites
  const scores = audits
    .filter(a => a.status === 'completed' && a.report?.overall_score != null)
    .map(a => ({ score: a.report!.overall_score!, date: a.completed_at || a.created_at }))
    .reverse(); // oldest first for trend display

  const improvement = scores.length >= 2 ? scores[scores.length - 1].score - scores[0].score : 0;

  const lang = langCode((latest as any).language);

  const headerContent = (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Globe size={12} className="text-muted flex-shrink-0" />
          <p className="font-medium text-sm text-text truncate">{domain}</p>
          {hasMultiple && (
            <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-500/15 px-1.5 py-0.5 rounded-full">
              {audits.length} audits
            </span>
          )}
          {lang && <span className="text-[9px] font-bold text-muted bg-off px-1.5 py-0.5 rounded">{lang}</span>}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted">
          <span>{hasMultiple ? 'Latest: ' : ''}{formatDate(latest.created_at)}</span>
          <span className="text-border">·</span>
          <span className="flex items-center gap-0.5">
            <LatestIcon size={10} />
            {latestMeta.label}
          </span>
          {improvement !== 0 && (
            <>
              <span className="text-border">·</span>
              <span className={`font-semibold ${improvement > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {improvement > 0 ? '+' : ''}{improvement} pts
              </span>
            </>
          )}
        </div>
        {!hasMultiple && latestDone && latest.report?.executive_summary && (
          <p className="text-muted text-[10px] mt-1 line-clamp-1">{latest.report.executive_summary}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href={`/dashboard/new-audit?url=${encodeURIComponent(latest.product_url)}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-[10px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <RefreshCw size={10} />
          Re-audit
        </Link>
        {latestScore != null && (
          <div className={`w-10 h-10 rounded-md border flex items-center justify-center ${scoreBg(latestScore)}`}>
            <span className={`font-semibold text-sm leading-none ${scoreColor(latestScore)}`}>{latestScore}</span>
          </div>
        )}
        {!latestDone && <Badge variant={latestMeta.color as any} size="sm">{latestMeta.label}</Badge>}
        <ChevronRight size={14} className={`text-muted transition-transform duration-200 ${hasMultiple && expanded ? 'rotate-90' : ''}`} />
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-border/40 dark:border-white/[0.06] bg-card overflow-hidden hover:border-violet-400/30 transition-colors">
      {/* Header — single audit: full link; multiple: expandable */}
      {hasMultiple ? (
        <div className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
          {headerContent}
        </div>
      ) : (
        <Link href={`/dashboard/audits/${latest.id}`}>
          {headerContent}
        </Link>
      )}

      {/* Expanded: score trend + audit list */}
      {expanded && hasMultiple && (
        <div className="border-t border-border/30 dark:border-white/[0.04]">
          {/* Mini score trend — clean, thin bars */}
          {scores.length >= 2 && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2.5">
                <TrendingUp size={11} className="text-violet-400" />
                <span className="text-[10px] font-medium text-text/60">Score Trend</span>
                {improvement !== 0 && (
                  <span className={`ml-auto text-[10px] font-semibold ${improvement > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {improvement > 0 ? '+' : ''}{improvement} pts
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {scores.map((s, i) => {
                  const dateStr = new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const isLatest = i === scores.length - 1;
                  const isBaseline = i === 0;
                  return (
                    <div key={i} className={`flex items-center gap-2.5 ${isLatest ? '' : 'opacity-55'}`}>
                      <span className="text-[10px] text-muted w-11 flex-shrink-0">{dateStr}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-border/10 dark:bg-white/[0.04] overflow-hidden">
                        <div className={`h-full rounded-full ${s.score >= 70 ? 'bg-emerald-400' : s.score >= 40 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${s.score}%` }} />
                      </div>
                      <span className={`text-[11px] font-semibold w-6 text-right ${s.score >= 70 ? 'text-emerald-600 dark:text-emerald-400' : s.score >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>{s.score}</span>
                      {isLatest && <span className="text-[8px] font-medium text-violet-500 bg-violet-100 dark:bg-violet-500/15 px-1 py-0.5 rounded">now</span>}
                      {isBaseline && !isLatest && <span className="text-[8px] text-muted/50">start</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Individual audit rows */}
          <div className="divide-y divide-border/20 dark:divide-white/[0.04]">
            {audits.map((audit) => {
              const meta = statusMeta[audit.status] || statusMeta.pending_payment;
              const Icon = meta.icon;
              const done = audit.status === 'completed';
              const report = audit.report;
              const aLang = langCode((audit as any).language) || 'EN';

              return (
                <Link key={audit.id} href={`/dashboard/audits/${audit.id}`}>
                  <div className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-violet-50/40 dark:hover:bg-violet-900/[0.06] transition-colors group/row cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-[11px] text-muted">
                        <span className="text-text font-medium">{formatDate(audit.created_at)}</span>
                        <span className="text-border">·</span>
                        <span className="flex items-center gap-0.5">
                          <Icon size={10} />
                          {meta.label}
                        </span>
                        <span className="text-border">·</span>
                        <span className="text-[10px] font-bold text-text/50 bg-off dark:bg-white/[0.06] px-1.5 py-0.5 rounded">{aLang}</span>
                        {done && report?.overall_score != null && (
                          <>
                            <span className="text-border">·</span>
                            <span className={`font-bold ${scoreColor(report.overall_score)}`}>{report.overall_score} pts</span>
                          </>
                        )}
                      </div>
                    </div>
                    {!done && (
                      <Badge variant={meta.color as any} size="sm">{meta.label}</Badge>
                    )}
                    <ChevronRight size={12} className="text-muted/40 group-hover/row:text-violet-500 transition-colors flex-shrink-0" />
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
      const msg = err?.message || err?.error_description || JSON.stringify(err);
      console.error('[Dashboard] fetch error:', msg, err);
      setError(`Failed to load audits: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-off rounded-xl animate-pulse" />)}
        </div>
        <div className="space-y-3 mt-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-off rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  const name = profile?.full_name?.split(' ')[0] || 'there';
  const has = audits.length > 0;
  const isNewUser = audits.length === 0;

  // Group audits by unique URL for re-audit indicator
  const urlCounts: Record<string, number> = {};
  for (const a of audits) {
    const key = formatUrl(a.product_url);
    urlCounts[key] = (urlCounts[key] || 0) + 1;
  }

  return (
    <div className="max-w-3xl mx-auto py-2">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-text">Hey {name}</h1>
        <p className="text-muted text-xs mt-0.5">
          {has ? `${audits.length} audit${audits.length !== 1 ? 's' : ''} run` : 'Run your first UX audit'}
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

      {/* Onboarding for new users */}
      {isNewUser && <OnboardingBanner />}

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
            Create your first audit to see how your website scores across 64 UX checkpoints.
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

      {/* Audit list — grouped by domain */}
      {has && (() => {
        // Group audits by domain
        const grouped: Record<string, AuditWithReport[]> = {};
        for (const audit of audits) {
          const domain = formatUrl(audit.product_url);
          if (!grouped[domain]) grouped[domain] = [];
          grouped[domain].push(audit);
        }
        const domainKeys = Object.keys(grouped);

        return (
          <div>
            <h2 className="text-xs font-semibold text-text mb-3">Your Audits</h2>
            <div className="flex flex-col" style={{ gap: '12px' }}>
              {domainKeys.map((domain) => (
                <SiteGroup
                  key={domain}
                  domain={domain}
                  audits={grouped[domain]}
                />
              ))}
            </div>

            {/* Track improvement notification — dismissable */}
            <TrackImprovementTip show={audits.some(a => a.status === 'completed')} />
          </div>
        );
      })()}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="max-w-3xl mx-auto py-6 space-y-4">
        <div className="h-6 w-40 bg-off rounded animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-off rounded-xl animate-pulse" />)}
        </div>
        <div className="space-y-3 mt-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-off rounded-lg animate-pulse" />)}
        </div>
      </div>
    }>
      <DashboardInner />
    </Suspense>
  );
}
