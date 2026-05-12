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
        <p className="text-[11px] font-mono tracking-[0.08em] uppercase" style={{ color: 'var(--m-muted)' }}>
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

/* ── Main ───────────────────────────────────────────────────── */

function DashboardInner() {
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();

  const [websiteCount, setWebsiteCount] = useState<number | null>(null);
  const [brandCount, setBrandCount] = useState<number | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [unread, setUnread] = useState<number>(0);
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
    ])
      .then(([websiteRes, brandRes, creditsData, notifData]) => {
        setWebsiteCount(websiteRes.count ?? 0);
        setBrandCount(brandRes.count ?? 0);
        setCredits(creditsData.credits ?? 0);
        setPlan(creditsData.subscription_plan ?? null);
        setUnread(notifData.unreadCount ?? 0);
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
          Your ClearUX dashboard
        </p>
      </div>

      {/* Quick link cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* New audit — primary CTA, full signal accent */}
        <Link
          href="/dashboard/new-audit"
          className="group rounded-xl p-5 flex flex-col gap-4 transition-all hover:opacity-90"
          style={{ background: 'var(--ink)', border: '1px solid var(--ink)' }}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            <Sparkles size={18} strokeWidth={1.5} style={{ color: 'var(--paper)' }} />
          </div>
          <div className="flex-1">
            <p className="text-[16px] font-sans font-semibold" style={{ color: 'var(--paper)' }}>
              New audit
            </p>
            <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Run a website or brand identity audit
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-[12px] font-medium transition-all group-hover:gap-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Start now
            <ArrowRight size={11} />
          </span>
        </Link>

        {/* Website audits */}
        <QuickCard
          href="/dashboard/audits"
          icon={Globe}
          tint="color-mix(in srgb, var(--signal) 10%, transparent)"
          label="Website audits"
          value={websiteCount}
          sub="Completed audits"
          cta="View all"
        />

        {/* Brand audits */}
        <QuickCard
          href="/dashboard/brand-identity"
          icon={Fingerprint}
          tint="color-mix(in srgb, #8B5CF6 10%, transparent)"
          label="Brand audits"
          value={brandCount}
          sub="Completed audits"
          cta="View all"
        />

        {/* Active plan + credits */}
        <QuickCard
          href="/dashboard/buy-credits"
          icon={CreditCard}
          tint="color-mix(in srgb, var(--ok) 10%, transparent)"
          label={`${planLabel} plan`}
          value={credits}
          sub={credits === 0 ? 'No credits remaining' : `Credit${credits !== 1 ? 's' : ''} remaining`}
          cta={credits === 0 ? 'Buy credits' : 'Manage plan'}
        />

        {/* Notifications */}
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
