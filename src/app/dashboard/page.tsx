'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Sparkles,
  Globe,
  Fingerprint,
  CreditCard,
  Bell,
  CheckCircle2,
  X,
  ArrowRight,
  FileText,
  ClipboardCheck,
  Share2,
  Eye,
  Brain,
  Heart,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';

/* ── Helpers ────────────────────────────────────────────────── */

function QuickCard({
  href,
  icon: Icon,
  tint,
  label,
  value,
  sub,
  cta,
}: {
  href: string;
  icon: React.ElementType;
  tint: string;
  label: string;
  value: string | number | null;
  sub?: string;
  cta?: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl p-5 flex flex-col gap-4 transition-all hover:shadow-sm"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: tint }}
      >
        <Icon size={18} strokeWidth={1.5} style={{ color: 'var(--ink)' }} />
      </div>
      <div className="flex-1">
        <p className="text-[11px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>
          {label}
        </p>
        <p className="text-[28px] font-sans font-semibold tabular-nums mt-1 leading-none" style={{ color: 'var(--ink)' }}>
          {value ?? '--'}
        </p>
        {sub && (
          <p className="text-[12px] mt-1.5" style={{ color: 'var(--m-muted)' }}>{sub}</p>
        )}
      </div>
      {cta && (
        <span className="inline-flex items-center gap-1 text-[12px] font-medium transition-colors group-hover:gap-1.5" style={{ color: 'var(--signal)' }}>
          {cta}
          <ArrowRight size={11} />
        </span>
      )}
    </Link>
  );
}

function ActionCard({
  href,
  icon: Icon,
  title,
  body,
  cta,
  disabled,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  body: string;
  cta: string;
  disabled?: boolean;
}) {
  const inner = (
    <div
      className="group rounded-xl p-5 h-full flex flex-col gap-3 transition-all"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--rule)',
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}
      >
        <Icon size={16} strokeWidth={1.5} style={{ color: 'var(--ink)' }} />
      </div>
      <div className="flex-1">
        <p className="text-[14px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>{title}</p>
        <p className="text-[12px] leading-relaxed mt-1.5" style={{ color: 'var(--m-muted)' }}>{body}</p>
      </div>
      <span className="inline-flex items-center gap-1 text-[12px] font-medium transition-all group-hover:gap-1.5" style={{ color: disabled ? 'var(--m-muted)' : 'var(--signal)' }}>
        {cta}
        <ArrowRight size={11} />
      </span>
    </div>
  );
  if (disabled) return <div>{inner}</div>;
  return <Link href={href}>{inner}</Link>;
}

/* ── Main ───────────────────────────────────────────────────── */

function DashboardInner() {
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();

  const [websiteCount, setWebsiteCount] = useState<number | null>(null);
  const [brandCount, setBrandCount] = useState<number | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [unread, setUnread] = useState<number>(0);
  const [latestAuditId, setLatestAuditId] = useState<string | null>(null);
  const [openFindings, setOpenFindings] = useState<number | null>(null);
  const [hasShareLink, setHasShareLink] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [creditsBanner, setCreditsBanner] = useState(false);

  // Handle ?credits=purchased redirect
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

  // Fetch all dashboard data
  useEffect(() => {
    if (authLoading || !user) { setLoading(false); return; }

    const supabase = createBrowserSupabase();

    Promise.all([
      // Website audit count
      supabase
        .from('audits')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .or('audit_type.is.null,audit_type.eq.website'),
      // Brand audit count
      supabase
        .from('audits')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .eq('audit_type', 'brand_identity'),
      // Credits + plan
      fetch('/api/credits').then(r => r.json()),
      // Notifications
      fetch('/api/notifications').then(r => r.json()),
      // Most recent completed audit (for "next best action")
      supabase
        .from('audits')
        .select('id, share_enabled')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
      .then(async ([websiteRes, brandRes, creditsData, notifData, latestRes]) => {
        setWebsiteCount(websiteRes.count ?? 0);
        setBrandCount(brandRes.count ?? 0);
        setCredits(creditsData.credits ?? 0);
        setPlan(creditsData.subscription_plan ?? null);
        setUnread(notifData.unreadCount ?? 0);

        const latest = latestRes.data as any;
        if (latest?.id) {
          setLatestAuditId(latest.id);
          setHasShareLink(!!latest.share_enabled);

          // Open findings on latest audit — drives "Track fixes" card.
          const { count: openCount } = await supabase
            .from('audit_findings')
            .select('id', { count: 'exact', head: true })
            .eq('audit_id', latest.id)
            .in('status', ['open', 'in_progress']);
          setOpenFindings(openCount ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, user]);

  /* ── Loading skeleton ─── */
  if (authLoading || (loading && user)) {
    return (
      <div>
        <div className="h-8 w-48 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-5 w-72 rounded-md animate-pulse mb-8" style={{ background: 'var(--paper-2)' }} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-[160px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />
          ))}
        </div>
      </div>
    );
  }

  const name = profile?.full_name?.split(' ')[0] || 'there';
  const planLabel = plan
    ? plan.charAt(0).toUpperCase() + plan.slice(1)
    : 'Credit-based';

  const totalCompleted = (websiteCount ?? 0) + (brandCount ?? 0);
  const isFirstRun = totalCompleted === 0;

  return (
    <div>
      {/* Credits purchased banner */}
      {creditsBanner && (
        <div role="status" aria-live="polite" className="mb-5 px-4 py-3 rounded-lg flex items-center gap-3" style={{ background: 'color-mix(in srgb, var(--ok) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--ok) 14%, transparent)' }}>
          <CheckCircle2 size={15} style={{ color: 'var(--ok)' }} />
          <p className="text-[13px]" style={{ color: 'var(--ink)' }}>Credits added to your account.</p>
          <button onClick={() => setCreditsBanner(false)} className="ml-auto p-1 rounded-md hover:bg-black/5" style={{ color: 'var(--m-muted)' }}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
          Welcome back, {name}
        </h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--m-muted)' }}>
          {isFirstRun
            ? 'Run your first ClearUX audit — measure human experience, AI readability, brand consistency, and conversion evidence in one pass.'
            : 'Your evidence-based Human + AI + Brand + Conversion cockpit.'}
        </p>
      </div>

      {/* ── First-run primary CTA (only when no completed audits) ── */}
      {isFirstRun && (
        <div
          className="mb-6 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5"
          style={{ background: 'var(--ink)', border: '1px solid var(--ink)' }}
        >
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            <Sparkles size={22} strokeWidth={1.5} style={{ color: 'var(--paper)' }} />
          </div>
          <div className="flex-1">
            <p className="text-[16px] font-sans font-semibold" style={{ color: 'var(--paper)' }}>
              Run your first audit — it&apos;s on us
            </p>
            <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
              96 checkpoints across 6 pillars: Foundation, Human Experience, Inclusive Design, Future Readiness, SEO Structure, Brand Consistency. Results in minutes — client-ready PDF + shareable link.
            </p>
          </div>
          <Link
            href="/dashboard/new-audit"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-medium transition-all hover:opacity-90 flex-shrink-0"
            style={{ background: 'var(--paper)', color: 'var(--ink)' }}
          >
            Start audit
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* ── Next-best-action workflow (4 cards) ── */}
      <div className="mb-8">
        <p className="text-[11px] font-semibold tracking-[0.04em] uppercase mb-3" style={{ color: 'var(--m-muted)' }}>
          {isFirstRun ? 'How ClearUX works' : 'Your workflow'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ActionCard
            href="/dashboard/new-audit"
            icon={Sparkles}
            title="Run an audit"
            body="Audit a live URL or a brand identity pack. Pick a depth mode and the pillars you care about."
            cta={isFirstRun ? 'Start your first audit' : 'New audit'}
          />
          <ActionCard
            href={latestAuditId ? `/dashboard/audits/${latestAuditId}` : '/dashboard/audits'}
            icon={FileText}
            title="Review reports"
            body={
              latestAuditId
                ? 'See findings ranked by severity, impact, and effort. Executive summary on top, evidence underneath.'
                : 'Once an audit completes, every finding is graded by severity, impact, and fix effort.'
            }
            cta={latestAuditId ? 'Open latest report' : 'See example'}
            disabled={!latestAuditId}
          />
          <ActionCard
            href={latestAuditId ? `/dashboard/audits/${latestAuditId}#findings` : '/dashboard/audits'}
            icon={ClipboardCheck}
            title="Track fixes"
            body={
              openFindings !== null
                ? `${openFindings} open finding${openFindings === 1 ? '' : 's'} on your latest audit. Mark them as in-progress, fixed, or backlog as your team ships.`
                : 'Mark findings as in-progress, fixed, or backlog. Re-audit to verify the fix landed.'
            }
            cta={openFindings ? 'Triage findings' : 'See workflow'}
            disabled={!latestAuditId}
          />
          <ActionCard
            href={latestAuditId ? `/dashboard/audits/${latestAuditId}#share` : '/dashboard/audits'}
            icon={Share2}
            title="Share client report"
            body={
              hasShareLink
                ? 'A shareable, client-ready link is already live for your latest audit. Send it to stakeholders — no login required.'
                : 'Generate a public, branded link your client can read without an account. Revoke anytime.'
            }
            cta={hasShareLink ? 'Copy share link' : 'Create share link'}
            disabled={!latestAuditId}
          />
        </div>
      </div>

      {/* ── Value pillars (first-run helper) ── */}
      {isFirstRun && (
        <div className="mb-8 rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
          <p className="text-[11px] font-semibold tracking-[0.04em] uppercase mb-4" style={{ color: 'var(--m-muted)' }}>
            What ClearUX measures
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-start gap-3">
              <Heart size={16} strokeWidth={1.5} style={{ color: 'var(--ink)' }} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Human experience</p>
                <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                  Dark-pattern detection, cognitive load, accessibility, psychological safety.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Brain size={16} strokeWidth={1.5} style={{ color: 'var(--ink)' }} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>AI readability</p>
                <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                  How LLMs and agents read your site — discoverability, structure, citations.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Fingerprint size={16} strokeWidth={1.5} style={{ color: 'var(--ink)' }} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Brand consistency</p>
                <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                  Voice, visual identity, and messaging measured against your reference brand pack.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <TrendingUp size={16} strokeWidth={1.5} style={{ color: 'var(--ink)' }} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Conversion evidence</p>
                <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                  Friction points and conversion blockers, ranked by business impact and fix effort.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Account snapshot (always shown) ── */}
      <p className="text-[11px] font-semibold tracking-[0.04em] uppercase mb-3" style={{ color: 'var(--m-muted)' }}>
        Account
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickCard
          href="/dashboard/audits"
          icon={Globe}
          tint="color-mix(in srgb, var(--signal) 10%, transparent)"
          label="Website audits"
          value={websiteCount}
          sub={websiteCount === 0 ? 'No audits yet' : 'Completed audits'}
          cta="View all"
        />
        <QuickCard
          href="/dashboard/brand-identity"
          icon={Fingerprint}
          tint="color-mix(in srgb, #8B5CF6 10%, transparent)"
          label="Brand audits"
          value={brandCount}
          sub={brandCount === 0 ? 'No brand audits yet' : 'Completed audits'}
          cta="View all"
        />
        <QuickCard
          href="/dashboard/buy-credits"
          icon={CreditCard}
          tint="color-mix(in srgb, var(--ok) 10%, transparent)"
          label={`${planLabel} plan`}
          value={credits}
          sub={credits === 0 ? 'No credits remaining' : `Credit${credits !== 1 ? 's' : ''} remaining`}
          cta={credits === 0 ? 'Buy credits' : 'Manage plan'}
        />
        <QuickCard
          href="/dashboard/notifications"
          icon={Bell}
          tint={unread > 0
            ? 'color-mix(in srgb, var(--severe) 10%, transparent)'
            : 'color-mix(in srgb, var(--ink) 6%, transparent)'
          }
          label="Notifications"
          value={unread}
          sub={unread > 0 ? `Unread notification${unread !== 1 ? 's' : ''}` : 'All caught up'}
          cta="View all"
        />
      </div>

      {/* ── Returning-user hint (only when not first-run, audit completed) ── */}
      {!isFirstRun && latestAuditId && (
        <div className="mt-8 rounded-xl p-4 flex items-start gap-3" style={{ background: 'color-mix(in srgb, var(--signal) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--signal) 12%, transparent)' }}>
          <Eye size={15} strokeWidth={1.5} style={{ color: 'var(--signal)' }} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
              Re-audit your latest URL to verify fixes
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
              ClearUX scores the delta — see which findings moved from open to fixed, and which regressed.
            </p>
          </div>
          <Link href="/dashboard/new-audit" className="text-[12px] font-medium whitespace-nowrap" style={{ color: 'var(--signal)' }}>
            Re-audit →
          </Link>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div>
        <div className="h-8 w-48 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-5 w-72 rounded-md animate-pulse mb-8" style={{ background: 'var(--paper-2)' }} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-[160px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />
          ))}
        </div>
      </div>
    }>
      <DashboardInner />
    </Suspense>
  );
}
