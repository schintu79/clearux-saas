'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileSearch,
  PlusCircle,
  Settings,
  LogOut,
  Coins,
  ShieldCheck,
  Bell,
  Fingerprint,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Globe,
  Smartphone,
  Brain,
  Sparkles,
  BarChart3,
  Plus,
  Check,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import ThemeToggle from '@/components/ui/ThemeToggle';

interface DashboardShellProps {
  children: React.ReactNode;
}

type SiteEntry = {
  kind: 'site' | 'brand';
  // For sites: latest audit id is used to deep-link feature nav.
  // For brands: brand_identity id, used for /dashboard/brand-identity/[id].
  id: string;
  label: string;
  // Display sublabel — domain hostname or "Brand identity".
  sub: string;
  auditId?: string | null;
};

const DashboardShell: React.FC<DashboardShellProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, signOut, loading } = useAuth();

  // Sidebar UI state — React state only (no localStorage) so this stays safe in
  // sandboxed iframes. Mobile drawer + desktop collapse are independent.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const brandMenuRef = useRef<HTMLDivElement>(null);

  const [creditData, setCreditData] = useState<{
    credits: number;
    subscription_plan: string | null;
    subscription_status: string | null;
    audits_remaining: number;
    audits_per_month: number;
    first_audit_free: boolean;
  } | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Sites/Brands derived from existing data. Site entries are the distinct
  // hostnames found across the user's audits; brand entries come from
  // brand_identities. Each site entry remembers its latest audit id so the
  // feature nav can deep-link into the audit detail tabs.
  const [sites, setSites] = useState<SiteEntry[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = () => {
      fetch('/api/credits').then((r) => r.json()).then((d) => setCreditData({
        credits: d.credits ?? 0,
        subscription_plan: d.subscription_plan ?? null,
        subscription_status: d.subscription_status ?? null,
        audits_remaining: d.audits_remaining ?? 0,
        audits_per_month: d.audits_per_month ?? 0,
        first_audit_free: d.first_audit_free ?? false,
      })).catch(() => {});
      fetch('/api/notifications').then((r) => r.json()).then((d) => setUnreadNotifications(d.unreadCount ?? 0)).catch(() => {});
    };
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user]);

  // Load sites/brands. We only need a small, stable list for the selector;
  // selecting a site does not refetch global data, it just rewires the
  // feature-nav deep links to the latest audit for that domain.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const supabase = createBrowserSupabase();
      const [{ data: audits }, brandsRes] = await Promise.all([
        supabase
          .from('audits')
          .select('id, product_url, completed_at, created_at, status')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false, nullsFirst: false } as any)
          .limit(50),
        fetch('/api/brand-identities').then(r => r.ok ? r.json() : { identities: [] }).catch(() => ({ identities: [] })),
      ]);
      if (cancelled) return;

      const byDomain = new Map<string, SiteEntry>();
      for (const a of (audits || []) as any[]) {
        if (!a.product_url) continue;
        let host = a.product_url as string;
        try { host = new URL(a.product_url).hostname.replace(/^www\./, ''); } catch {}
        if (!byDomain.has(host)) {
          byDomain.set(host, {
            kind: 'site',
            id: `site:${host}`,
            label: host,
            sub: 'Website',
            auditId: a.id || null,
          });
        }
      }
      const siteEntries = Array.from(byDomain.values());

      const brandEntries: SiteEntry[] = ((brandsRes?.identities || []) as any[]).map((b) => ({
        kind: 'brand',
        id: `brand:${b.id}`,
        label: b.name || 'Untitled brand',
        sub: 'Brand identity',
      }));

      const all = [...siteEntries, ...brandEntries];
      setSites(all);
      // Default selection: prefer current route context, else most-recent site.
      setSelectedSiteId((prev) => prev || all[0]?.id || null);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Sync the selected site/brand with the current route so the selector
  // reflects what the user is looking at. Specifically: when the user is on
  // /dashboard/audits/<id>, find the matching site entry and switch.
  useEffect(() => {
    if (!sites.length) return;
    if (pathname?.startsWith('/dashboard/audits/')) {
      const auditId = pathname.split('/')[3];
      const match = sites.find(s => s.kind === 'site' && s.auditId === auditId);
      if (match) setSelectedSiteId(match.id);
    } else if (pathname?.startsWith('/dashboard/brand-identity/')) {
      const brandId = pathname.split('/')[3];
      const match = sites.find(s => s.kind === 'brand' && s.id === `brand:${brandId}`);
      if (match) setSelectedSiteId(match.id);
    }
  }, [pathname, sites]);

  // Click-outside / Escape to close brand menu.
  useEffect(() => {
    if (!brandMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (brandMenuRef.current && !brandMenuRef.current.contains(e.target as Node)) {
        setBrandMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setBrandMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [brandMenuOpen]);

  const selectedSite = useMemo(
    () => sites.find(s => s.id === selectedSiteId) || null,
    [sites, selectedSiteId],
  );

  // Derived plan info
  const credits = creditData?.credits ?? 0;
  const isSubscribed = creditData?.subscription_status === 'active' && !!creditData?.subscription_plan;
  const isFreeUser = !isSubscribed && credits === 0 && (creditData?.first_audit_free ?? false);
  const planName = isSubscribed
    ? creditData!.subscription_plan!.charAt(0).toUpperCase() + creditData!.subscription_plan!.slice(1)
    : isFreeUser
      ? 'Free'
      : 'Credit-based';
  const auditsRemaining = creditData?.audits_remaining ?? 0;
  const auditsPerMonth = creditData?.audits_per_month ?? 0;
  const totalAvailable = isSubscribed ? auditsRemaining + credits : credits;
  const usagePercent = isSubscribed && auditsPerMonth > 0
    ? Math.round((auditsRemaining / auditsPerMonth) * 100)
    : 0;

  // Deep-link helper. AUDIT feature items target the selected site's latest
  // audit detail tab. When no audit exists yet, fall back to /dashboard/audits
  // so the user lands on a useful page rather than a dead link.
  const auditTabHref = (tab: string) => {
    if (selectedSite?.kind === 'site' && selectedSite.auditId) {
      const hash = tab === 'overview' ? '' : `#${tab}`;
      return `/dashboard/audits/${selectedSite.auditId}${hash}`;
    }
    return '/dashboard/audits';
  };

  type NavItem = {
    label: string;
    href: string;
    icon: React.ElementType;
    badge?: boolean;
    matchPaths?: string[]; // additional paths considered "active"
    matchHash?: string; // for tab-aware audit deep links
  };
  type NavGroup = { label: string | null; items: NavItem[] };

  const onAuditDetail = pathname?.startsWith('/dashboard/audits/') && pathname.split('/').length >= 4;
  // Track URL hash in state so the sidebar's active highlight updates the
  // moment the audit page's tab changes (via in-page click, sidebar click,
  // or browser back/forward). usePathname does not re-render on hash change,
  // so we have to subscribe manually.
  const [currentHash, setCurrentHash] = useState('');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => setCurrentHash(window.location.hash.replace(/^#/, ''));
    sync();
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, [pathname]);

  const navGroups: NavGroup[] = [
    {
      label: null,
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Audit',
      items: [
        { label: 'Overview', href: auditTabHref('overview'), icon: BarChart3, matchHash: 'overview' },
        { label: 'Findings', href: auditTabHref('findings'), icon: AlertTriangle, matchHash: 'findings' },
        { label: 'Pages', href: auditTabHref('pages'), icon: Globe, matchHash: 'pages' },
        { label: 'Responsive', href: auditTabHref('responsive'), icon: Smartphone, matchHash: 'responsive' },
      ],
    },
    {
      label: 'AI & Discovery',
      items: [
        { label: 'AI X-Ray', href: auditTabHref('ai_xray'), icon: Brain, matchHash: 'ai_xray' },
        { label: 'Intelligence', href: auditTabHref('intelligence'), icon: Sparkles, matchHash: 'intelligence' },
      ],
    },
    {
      label: 'Brand',
      items: [
        { label: 'Brand identity', href: '/dashboard/brand-identity', icon: Fingerprint },
        { label: 'All audits', href: '/dashboard/audits', icon: FileSearch },
      ],
    },
    {
      label: 'Configuration',
      items: [
        { label: 'Settings', href: '/dashboard/settings', icon: Settings, matchPaths: ['/dashboard/white-label'] },
        { label: 'Buy credits', href: '/dashboard/buy-credits', icon: Coins },
      ],
    },
  ];

  const isActive = (item: NavItem) => {
    // Hash-aware audit feature nav: only highlight when on the matching detail
    // page AND the current hash matches (or it's overview with no hash).
    if (item.matchHash) {
      if (!onAuditDetail) return false;
      if (item.matchHash === 'overview') return !currentHash || currentHash === 'overview';
      return currentHash === item.matchHash;
    }
    if (item.href === '/dashboard') return pathname === '/dashboard';
    if (pathname === item.href || pathname?.startsWith(item.href + '/')) return true;
    if (item.matchPaths?.some(p => pathname === p || pathname?.startsWith(p + '/'))) return true;
    return false;
  };

  const displayName = profile?.full_name
    || user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || null;
  const initials = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '?';

  const SidebarLogo = (
    <div
      className={clsx('h-14 flex items-center', collapsed ? 'px-2 justify-between' : 'px-4 justify-between')}
      style={{ borderBottom: '1px solid var(--rule)' }}
    >
      <Link href="/dashboard" className="flex items-center gap-2 min-w-0" aria-label="ClearUX home">
        <svg width={26} height={26} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-signal block shrink-0">
          <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.5" fill="none" />
          <circle cx="16" cy="16" r="5.5" fill="currentColor" />
        </svg>
        {!collapsed && (
          <span className="font-sans font-semibold text-[16px] leading-none tracking-[-0.02em] truncate" style={{ color: 'var(--ink)' }}>
            ClearUX
          </span>
        )}
      </Link>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden md:inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors hover:bg-black/[0.04]"
        style={{ color: 'var(--m-muted)' }}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <PanelLeft size={15} /> : <PanelLeftClose size={15} />}
      </button>
    </div>
  );

  return (
    <div className="dashboard-clean flex h-screen" style={{ background: 'var(--paper)', fontFamily: 'var(--font-sans)' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed md:static inset-y-0 left-0 flex flex-col z-50 transition-all duration-200 transform md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'w-[64px]' : 'w-[240px]',
        )}
        style={{ background: 'var(--card)', borderRight: '1px solid var(--rule)' }}
        aria-label="Primary navigation"
      >
        {SidebarLogo}

        {/* Brand/site selector — only when we have at least one entry */}
        {!collapsed && (
          <div className="px-3 pt-3 pb-2" ref={brandMenuRef}>
            <div className="relative">
              <button
                onClick={() => setBrandMenuOpen((v) => !v)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors hover:bg-black/[0.04]"
                style={{ border: '1px solid var(--rule)', background: 'var(--paper-2)' }}
                aria-haspopup="listbox"
                aria-expanded={brandMenuOpen}
                aria-label="Switch site or brand"
              >
                <span
                  className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--ink)', color: 'var(--paper)' }}
                >
                  {selectedSite?.kind === 'brand'
                    ? <Fingerprint size={14} strokeWidth={1.75} />
                    : <Globe size={14} strokeWidth={1.75} />}
                </span>
                <span className="flex-1 min-w-0 text-left">
                  <span className="block text-[12px] font-semibold truncate leading-tight" style={{ color: 'var(--ink)' }}>
                    {selectedSite?.label || 'No site yet'}
                  </span>
                  <span className="block text-[10px] truncate leading-tight mt-0.5" style={{ color: 'var(--m-muted)' }}>
                    {selectedSite?.sub || 'Run your first audit'}
                  </span>
                </span>
                <ChevronDown size={13} style={{ color: 'var(--m-muted)' }} />
              </button>

              {brandMenuOpen && (
                <div
                  className="absolute left-0 right-0 mt-1.5 rounded-lg shadow-lg overflow-hidden z-50"
                  style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
                  role="listbox"
                >
                  <div className="max-h-[260px] overflow-y-auto py-1">
                    {sites.length === 0 && (
                      <p className="px-3 py-2 text-[11px]" style={{ color: 'var(--m-muted)' }}>
                        No sites or brands yet.
                      </p>
                    )}
                    {sites.map((s) => {
                      const selected = s.id === selectedSiteId;
                      return (
                        <button
                          key={s.id}
                          role="option"
                          aria-selected={selected}
                          onClick={() => {
                            setSelectedSiteId(s.id);
                            setBrandMenuOpen(false);
                            if (s.kind === 'site' && s.auditId) {
                              router.push(`/dashboard/audits/${s.auditId}`);
                            } else if (s.kind === 'brand') {
                              const bid = s.id.replace(/^brand:/, '');
                              router.push(`/dashboard/brand-identity/${bid}`);
                            }
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-black/[0.04]"
                        >
                          <span
                            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--m-muted)' }}
                          >
                            {s.kind === 'brand'
                              ? <Fingerprint size={11} strokeWidth={1.75} />
                              : <Globe size={11} strokeWidth={1.75} />}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[12px] font-medium truncate leading-tight" style={{ color: 'var(--ink)' }}>
                              {s.label}
                            </span>
                            <span className="block text-[10px] truncate leading-tight mt-0.5" style={{ color: 'var(--m-muted)' }}>
                              {s.sub}
                            </span>
                          </span>
                          {selected && <Check size={13} style={{ color: 'var(--signal)' }} />}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ borderTop: '1px solid var(--rule)' }}>
                    <Link
                      href="/dashboard/new-audit"
                      onClick={() => { setBrandMenuOpen(false); setSidebarOpen(false); }}
                      className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium transition-colors hover:bg-black/[0.04]"
                      style={{ color: 'var(--ink)' }}
                    >
                      <Plus size={12} />
                      Add site or brand
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Collapsed: tiny selector icon → expand to choose */}
        {collapsed && (
          <div className="px-2 pt-2 pb-1">
            <button
              onClick={() => setCollapsed(false)}
              className="w-full flex items-center justify-center py-2 rounded-md hover:bg-black/[0.04] transition-colors"
              title={selectedSite ? `${selectedSite.label}` : 'Switch site / brand'}
              aria-label="Switch site or brand"
              style={{ color: 'var(--ink)' }}
            >
              {selectedSite?.kind === 'brand'
                ? <Fingerprint size={16} strokeWidth={1.75} />
                : <Globe size={16} strokeWidth={1.75} />}
            </button>
          </div>
        )}

        {/* New audit CTA */}
        <div className={clsx('pt-1 pb-2', collapsed ? 'px-2' : 'px-3')}>
          <Link
            href="/dashboard/new-audit"
            onClick={() => setSidebarOpen(false)}
            className={clsx(
              'flex items-center justify-center w-full rounded-lg transition-all hover:opacity-90',
              collapsed ? 'px-0 py-2' : 'gap-1.5 px-3 py-2 text-[12px] font-medium',
            )}
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
            title={collapsed ? 'New audit' : undefined}
          >
            <PlusCircle size={collapsed ? 16 : 13} strokeWidth={1.75} />
            {!collapsed && 'New audit'}
          </Link>
        </div>

        {/* Navigation */}
        <nav aria-label="Dashboard navigation" className={clsx('flex-1 overflow-y-auto pb-2', collapsed ? 'px-1.5' : 'px-2')}>
          {navGroups.map((group, gi) => (
            <div key={`g-${gi}`} className={clsx(gi > 0 && 'mt-3')}>
              {group.label && !collapsed && (
                <p
                  className="px-3 pt-1 pb-1.5 text-[10px] font-semibold tracking-[0.08em] uppercase"
                  style={{ color: 'var(--m-muted)' }}
                >
                  {group.label}
                </p>
              )}
              {group.label && collapsed && gi > 0 && (
                <div className="mx-2 my-2" style={{ borderTop: '1px solid var(--rule)' }} />
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);
                  // Audit feature items use real <a> tags so clicking while
                  // already on the audit page produces a real hash navigation
                  // and reliably fires `hashchange` — Next.js <Link> can
                  // suppress it via pushState, which the audit page would miss.
                  const isHashItem = !!item.matchHash;
                  // When user clicks a feature link but no audit exists, the
                  // href falls back to /dashboard/audits — make sure the user
                  // sees that they're being redirected, not silently stuck.
                  const onClick = () => setSidebarOpen(false);
                  const linkClass = clsx(
                    'flex items-center rounded-lg transition-colors text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-signal/40',
                    collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-2.5 py-[8px]',
                    active ? 'font-semibold' : 'hover:bg-black/[0.04]',
                  );
                  const linkStyle = {
                    color: active ? 'var(--ink)' : 'var(--ink-2)',
                    background: active ? 'var(--paper-2)' : undefined,
                  } as React.CSSProperties;
                  const inner = (
                    <>
                      <Icon
                        size={collapsed ? 17 : 15}
                        strokeWidth={1.75}
                        style={{ color: active ? 'var(--ink)' : 'var(--m-muted)' }}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </>
                  );
                  return (
                    <li key={`${group.label}-${item.label}`}>
                      {isHashItem ? (
                        <a
                          href={item.href}
                          onClick={onClick}
                          title={collapsed ? item.label : undefined}
                          aria-current={active ? 'page' : undefined}
                          className={linkClass}
                          style={linkStyle}
                        >
                          {inner}
                        </a>
                      ) : (
                        <Link
                          href={item.href}
                          onClick={onClick}
                          title={collapsed ? item.label : undefined}
                          aria-current={active ? 'page' : undefined}
                          className={linkClass}
                          style={linkStyle}
                        >
                          {inner}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Plan & credits card — keep, slim down */}
        {creditData && !collapsed && (
          <div className="mx-3 mb-2">
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--rule)' }}>
              <div className="px-3 py-2" style={{ background: isSubscribed ? 'var(--ink)' : 'var(--paper-2)' }}>
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] font-semibold tracking-[0.04em] uppercase"
                    style={{ color: isSubscribed ? 'var(--paper)' : 'var(--ink)' }}
                  >
                    {planName} plan
                  </span>
                  {isSubscribed && (
                    <span className="text-[9px] font-medium px-1.5 py-[1px] rounded-full" style={{ background: 'rgba(255,255,255,0.15)', color: 'var(--paper)' }}>
                      Active
                    </span>
                  )}
                </div>
              </div>
              <div className="px-3 py-2" style={{ background: 'var(--card)' }}>
                {isSubscribed && auditsPerMonth > 0 && (
                  <div className="mb-2">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>Monthly audits</span>
                      <span className="text-[11px] font-medium tabular-nums" style={{ color: 'var(--ink)' }}>
                        {auditsRemaining}<span style={{ color: 'var(--m-muted)' }}>/{auditsPerMonth}</span>
                      </span>
                    </div>
                    <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--rule)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${usagePercent}%`,
                          background: usagePercent > 20 ? 'var(--ink)' : 'var(--warn)',
                        }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between" style={isSubscribed && auditsPerMonth > 0 ? { paddingTop: '2px', borderTop: '1px solid var(--rule)' } : undefined}>
                  <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>
                    {isSubscribed ? 'Extra credits' : 'Available credits'}
                  </span>
                  <span className="text-[12px] font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                    {credits}
                  </span>
                </div>
                <Link
                  href="/dashboard/buy-credits"
                  className="block text-center text-[10px] font-medium rounded-md py-1.5 mt-2 transition-all hover:opacity-90"
                  style={
                    isFreeUser
                      ? { background: 'var(--ink)', color: 'var(--paper)' }
                      : { color: 'var(--m-muted)', border: '1px solid var(--rule)' }
                  }
                >
                  {isFreeUser ? 'Get started' : isSubscribed ? 'Manage plan' : 'Buy credits'}
                </Link>
              </div>
            </div>
          </div>
        )}
        {creditData && collapsed && (
          <div className="mx-1.5 mb-2">
            <Link
              href="/dashboard/buy-credits"
              title={`${planName} · ${totalAvailable} credits`}
              className="flex flex-col items-center justify-center w-full py-2 gap-0.5 rounded-lg text-[10px] font-medium tabular-nums"
              style={{ background: 'var(--paper-2)', color: 'var(--ink)' }}
            >
              <Coins size={13} strokeWidth={1.75} style={{ color: 'var(--m-muted)' }} />
              <span>{totalAvailable}</span>
            </Link>
          </div>
        )}

        {/* User area — sits ABOVE settings logically; settings already moved
            into the Configuration group above. */}
        <div className={clsx('py-2 space-y-0.5', collapsed ? 'px-1.5' : 'px-2')} style={{ borderTop: '1px solid var(--rule)' }}>
          {!loading && user && !collapsed && (
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-black/[0.04] transition-colors"
              aria-label="Account settings"
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0" style={{ background: 'var(--paper-2)', color: 'var(--m-muted)', border: '1px solid var(--rule)' }}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                {displayName && (
                  <p className="text-[12px] font-medium truncate leading-tight" style={{ color: 'var(--ink)' }}>
                    {displayName}
                  </p>
                )}
                <p className={clsx('truncate leading-tight', displayName ? 'text-[10px]' : 'text-[12px]')} style={{ color: 'var(--m-muted)' }}>
                  {user.email}
                </p>
              </div>
            </Link>
          )}
          {!loading && user && collapsed && (
            <Link
              href="/dashboard/settings"
              title={displayName || user.email || ''}
              className="flex items-center justify-center py-2 rounded-md hover:bg-black/[0.04] transition-colors"
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium" style={{ background: 'var(--paper-2)', color: 'var(--m-muted)', border: '1px solid var(--rule)' }}>
                {initials}
              </div>
            </Link>
          )}

          {((profile as any)?.role === 'admin' || (profile as any)?.role === 'super_admin') && (
            <Link
              href="/admin"
              title={collapsed ? 'Admin' : undefined}
              className={clsx(
                'w-full flex items-center rounded-md text-[12px] transition-all hover:bg-black/[0.04]',
                collapsed ? 'justify-center py-2' : 'gap-2.5 px-3 py-[6px]',
              )}
              style={{ color: 'var(--ink-2)' }}
            >
              <ShieldCheck size={collapsed ? 16 : 14} strokeWidth={1.75} />
              {!collapsed && 'Admin'}
            </Link>
          )}

          <button
            onClick={() => signOut()}
            title={collapsed ? 'Sign out' : undefined}
            className={clsx(
              'w-full flex items-center rounded-md text-[12px] transition-all hover:bg-black/[0.04]',
              collapsed ? 'justify-center py-2' : 'gap-2.5 px-3 py-[6px]',
            )}
            style={{ color: 'var(--ink-2)' }}
          >
            <LogOut size={collapsed ? 16 : 14} strokeWidth={1.75} />
            {!collapsed && 'Sign out'}
          </button>

          <div className={clsx('flex items-center pt-1 mt-1', collapsed ? 'flex-col gap-1' : 'justify-start px-1')} style={{ borderTop: '1px solid var(--rule)' }}>
            <ThemeToggle variant="icon" className="!p-1.5" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar — visible on every dashboard page. Hosts mobile menu trigger
            and the always-visible notifications bell. */}
        <div
          className="h-12 flex items-center justify-between px-3 md:px-5 gap-3"
          style={{ background: 'var(--card)', borderBottom: '1px solid var(--rule)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden w-9 h-9 rounded-md inline-flex items-center justify-center transition-colors hover:bg-black/[0.04]"
              aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <X size={17} style={{ color: 'var(--ink)' }} /> : <Menu size={17} style={{ color: 'var(--ink)' }} />}
            </button>
            <span className="md:hidden flex items-center gap-1.5">
              <svg width={18} height={18} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-signal block shrink-0">
                <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.5" fill="none" />
                <circle cx="16" cy="16" r="5.5" fill="currentColor" />
              </svg>
              <span className="font-sans font-semibold text-[14px] leading-none tracking-[-0.02em]" style={{ color: 'var(--ink)' }}>ClearUX</span>
            </span>
            {selectedSite && (
              <div className="hidden md:flex items-center gap-1.5 min-w-0">
                <span className="text-[12px]" style={{ color: 'var(--m-muted)' }}>Viewing</span>
                <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                  {selectedSite.label}
                </span>
                {onAuditDetail && (() => {
                  const featureLabel = !currentHash || currentHash === 'overview' ? 'Overview'
                    : currentHash === 'findings' ? 'Findings'
                    : currentHash === 'pages' ? 'Pages'
                    : currentHash === 'responsive' ? 'Responsive'
                    : currentHash === 'ai_xray' ? 'AI X-Ray'
                    : currentHash === 'intelligence' ? 'Intelligence'
                    : null;
                  return featureLabel ? (
                    <>
                      <ChevronRight size={12} style={{ color: 'var(--m-muted)' }} />
                      <span className="text-[12px] font-medium truncate" style={{ color: 'var(--m-muted)' }}>
                        {featureLabel}
                      </span>
                    </>
                  ) : null;
                })()}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Link
              href="/dashboard/notifications"
              className="relative w-9 h-9 rounded-md inline-flex items-center justify-center transition-colors hover:bg-black/[0.04]"
              aria-label={
                unreadNotifications > 0
                  ? `${unreadNotifications} unread notifications`
                  : 'Notifications'
              }
              title="Notifications"
            >
              <Bell size={16} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />
              {unreadNotifications > 0 && (
                <span
                  className="absolute top-1 right-1 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-bold leading-none flex items-center justify-center"
                  style={{ background: 'var(--severe)', color: '#FFFFFF' }}
                  aria-hidden="true"
                >
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Content area */}
        <main id="main-content" className="flex-1 overflow-auto">
          <div className="p-5 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default DashboardShell;
