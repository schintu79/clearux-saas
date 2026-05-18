'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  PlusCircle,
  Settings,
  LogOut,
  Coins,
  ShieldCheck,
  Bell,
  Fingerprint,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Globe,
  BarChart3,
  Plus,
  Check,
  PanelLeftClose,
  PanelLeft,
  Search,
  Wrench,
  LineChart,
  FileSearch,
  Server,
  Rocket,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import ThemeToggle from '@/components/ui/ThemeToggle';
import {
  readSelection,
  writeSelection,
  selectionFromSidebarId,
  subscribeSelection,
  type BrandSelection,
} from '@/lib/dashboard/brand-selection';

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
  // Whether brand audits exist for this entry (used for Brand audit nav link)
  hasBrandAudits?: boolean;
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
  // Selection persists via brand-selection store so that Overview/Find/Fix/
  // Track all scope queries to the SAME brand the sidebar shows. Initial
  // value is hydrated from localStorage on mount in the effect below.
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  // Hydrate selection from localStorage on first render AND subscribe to
  // external changes so the shell's selectedSiteId mirrors the persistent
  // store. Without the subscription, callers like `/dashboard/page.tsx`
  // (portfolio rows) and the audit detail pages can call `writeSelection`
  // and the body would scope to the new brand, while the sidebar/header
  // (which read from this state) stay on the old one. That divergence is
  // exactly the bug we're fixing here.
  const sidebarIdFromSelection = (sel: BrandSelection): string | null => {
    if (!sel) return null;
    if (sel.kind === 'site') return `site:${sel.host}`;
    if (sel.kind === 'brand') return `brand:${sel.brandId}`;
    return null;
  };
  useEffect(() => {
    const sel = readSelection();
    const id = sidebarIdFromSelection(sel);
    if (id) setSelectedSiteId(id);
    const unsub = subscribeSelection((next) => {
      const nextId = sidebarIdFromSelection(next);
      setSelectedSiteId((prev) => (nextId === prev ? prev : nextId));
    });
    return unsub;
  }, []);

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
          .select('id, product_url, completed_at, created_at, status, brand_identity_id')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false, nullsFirst: false } as any)
          .limit(50),
        fetch('/api/brand-identities').then(r => r.ok ? r.json() : { identities: [] }).catch(() => ({ identities: [] })),
      ]);
      if (cancelled) return;

      // Track which brand_identity_ids have audits
      const brandIdsWithAudits = new Set<string>();
      for (const a of (audits || []) as any[]) {
        if (a.brand_identity_id) brandIdsWithAudits.add(a.brand_identity_id);
      }

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

      const brandEntries: SiteEntry[] = ((brandsRes?.identities || []) as any[]).map((b: any) => ({
        kind: 'brand',
        id: `brand:${b.id}`,
        label: b.name || 'Untitled brand',
        sub: 'Brand identity',
        hasBrandAudits: brandIdsWithAudits.has(b.id),
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

  // Mirror every selection change into the persistent brand-selection store
  // so Overview / Find / Fix / Track scope their queries to the same brand.
  // Skip the write when the derived selection already matches the persisted
  // store — that avoids two race conditions:
  //   1. On first mount we'd otherwise write `null` before the hydrate
  //      effect populates `selectedSiteId` from localStorage, briefly
  //      clobbering the persisted selection and causing the body of
  //      `/dashboard/overview` (which reads the store) to fetch the
  //      user's globally-most-recent audit instead of the selected one
  //      — that is the divergence reported in the bug.
  //   2. The subscribe-driven mirror (above) re-enters this effect with
  //      the same value; without the guard, it would re-dispatch the
  //      change event in a loop.
  useEffect(() => {
    const next = selectionFromSidebarId(selectedSiteId);
    const current = readSelection();
    const sameSite = next?.kind === 'site' && current?.kind === 'site' && next.host === current.host;
    const sameBrand = next?.kind === 'brand' && current?.kind === 'brand' && next.brandId === current.brandId;
    const bothNull = next == null && current == null;
    if (sameSite || sameBrand || bothNull) return;
    // Don't clobber a real persisted selection with `null` during the
    // initial render window before hydrate has populated state.
    if (next == null && current != null) return;
    writeSelection(next);
  }, [selectedSiteId]);

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

  type NavItem = {
    label: string;
    href: string;
    icon: React.ElementType;
    badge?: boolean;
    matchPaths?: string[]; // additional paths considered "active"
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

  // Dynamic href for Brand identity nav item based on selected brand/site
  const brandIdentityHref = (() => {
    if (selectedSite?.kind === 'brand') {
      // Link to this brand's detail page (id is "brand:<uuid>")
      const brandId = selectedSite.id.replace('brand:', '');
      return `/dashboard/brand-identity/${brandId}`;
    }
    // Site selected — no brand identity exists, go to create new
    return '/dashboard/brand-identity/new';
  })();

  // Dynamic href for Brand audit nav item based on selected brand
  const brandAuditHref = (() => {
    if (selectedSite?.kind === 'brand' && selectedSite.hasBrandAudits) {
      return `/dashboard/audits/brand/${encodeURIComponent(selectedSite.label)}`;
    }
    return '/dashboard/new-audit?type=brand_identity';
  })();

  // Brand workspace IA: once inside a selected audit/brand workspace, the
  // sidebar exposes ONLY the practical operator path — Overview, Find, Fix,
  // Track, Brand DNA. Find/Fix/Track are where findings, page-level data, AI
  // readability, X-Ray, and Intelligence live; the audit detail page exposes
  // those same surfaces as in-page tabs. Reports is a parent/account-level
  // destination and is intentionally NOT a peer of audit workflow items.
  // Audit deep-dive features are reached through the audit detail page (in-
  // page tabs) and Find/Fix/Track — not as sidebar peers, which previously
  // created competing nav and made the audit area feel like a feature gallery.
  const navGroups: NavGroup[] = [
    {
      label: 'Audit workspace',
      items: [
        { label: 'Overview', href: '/dashboard/overview', icon: BarChart3 },
        { label: 'Find', href: '/dashboard/find', icon: Search, matchPaths: ['/dashboard/audits'] },
        { label: 'Fix', href: '/dashboard/fix', icon: Wrench },
        { label: 'Deploy', href: '/dashboard/deploy', icon: Rocket },
        { label: 'Track', href: '/dashboard/track', icon: LineChart },
        { label: 'Brand DNA', href: '/dashboard/brand-dna', icon: Fingerprint, matchPaths: ['/dashboard/brand-identity'] },
        { label: 'Connect site', href: '/dashboard/connect', icon: Server },
      ],
    },
  ];

  const isActive = (item: NavItem) => {
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
      <Link href="/dashboard" className="flex items-center gap-2 min-w-0" aria-label="Fixpath home">
        <svg width={26} height={26} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-signal block shrink-0">
          <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.5" fill="none" />
          <circle cx="16" cy="16" r="5.5" fill="currentColor" />
        </svg>
        {!collapsed && (
          <span className="font-sans font-semibold text-[16px] leading-none tracking-[-0.02em] truncate" style={{ color: 'var(--ink)' }}>
            Fixpath
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
        style={{ background: '#f3f2ee', borderRight: '1px solid #e6e2d6' }}
        aria-label="Primary navigation"
        data-sidebar-bg="#f3f2ee"
      >
        {SidebarLogo}

        {/* New audit CTA — top of sidebar */}
        <div className={clsx('pt-3 pb-1', collapsed ? 'px-2' : 'px-3')}>
          <Link
            href="/dashboard/new-audit"
            onClick={() => setSidebarOpen(false)}
            className={clsx(
              'flex items-center justify-center w-full rounded-lg transition-all hover:opacity-90',
              collapsed ? 'px-0 py-2.5' : 'gap-2 px-3 py-2.5 text-[13px] font-semibold',
            )}
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
            title={collapsed ? 'New audit' : undefined}
          >
            <PlusCircle size={collapsed ? 17 : 15} strokeWidth={1.75} />
            {!collapsed && 'New Audit'}
          </Link>
        </div>

        {/* Dashboard link — standalone above brand selector */}
        <div className={clsx('pb-1', collapsed ? 'px-1.5' : 'px-2')}>
          <Link
            href="/dashboard"
            onClick={() => setSidebarOpen(false)}
            title={collapsed ? 'Dashboard' : undefined}
            aria-current={pathname === '/dashboard' ? 'page' : undefined}
            className={clsx(
              'flex items-center rounded-lg transition-colors text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-signal/40',
              collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-2.5 py-[8px]',
              pathname === '/dashboard' ? 'font-semibold' : 'hover:bg-black/[0.04]',
            )}
            style={{
              color: pathname === '/dashboard' ? 'var(--ink)' : 'var(--ink-2)',
              background: pathname === '/dashboard' ? '#ffffff' : undefined,
            }}
          >
            <LayoutDashboard
              size={collapsed ? 17 : 15}
              strokeWidth={1.75}
              style={{ color: pathname === '/dashboard' ? 'var(--ink)' : 'var(--m-muted)' }}
            />
            {!collapsed && <span className="truncate">Dashboard</span>}
          </Link>
        </div>

        {/* My Audits — parent-level destination listing all audits across
            brands/sites. Lives at parent level (next to Dashboard), NOT inside
            the audit workspace, so audit workflow nav stays clean. */}
        <div className={clsx('pb-1', collapsed ? 'px-1.5' : 'px-2')}>
          {(() => {
            const myAuditsActive = pathname === '/dashboard/audits';
            return (
              <Link
                href="/dashboard/audits"
                onClick={() => setSidebarOpen(false)}
                title={collapsed ? 'My Audits' : undefined}
                aria-current={myAuditsActive ? 'page' : undefined}
                className={clsx(
                  'flex items-center rounded-lg transition-colors text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-signal/40',
                  collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-2.5 py-[8px]',
                  myAuditsActive ? 'font-semibold' : 'hover:bg-black/[0.04]',
                )}
                style={{
                  color: myAuditsActive ? 'var(--ink)' : 'var(--ink-2)',
                  background: myAuditsActive ? '#ffffff' : undefined,
                }}
              >
                <FileSearch
                  size={collapsed ? 17 : 15}
                  strokeWidth={1.75}
                  style={{ color: myAuditsActive ? 'var(--ink)' : 'var(--m-muted)' }}
                />
                {!collapsed && <span className="truncate">My Audits</span>}
              </Link>
            );
          })()}
        </div>

        {/* Brand/site selector — BIGGER and more prominent */}
        {!collapsed && (
          <div className="px-3 pt-2 pb-3" ref={brandMenuRef}>
            <div className="relative">
              <button
                onClick={() => setBrandMenuOpen((v) => !v)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors hover:bg-black/[0.04]"
                style={{ border: '1px solid #e6e2d6', background: '#ffffff' }}
                aria-haspopup="listbox"
                aria-expanded={brandMenuOpen}
                aria-label="Switch site or brand"
              >
                <span
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--ink)', color: 'var(--paper)' }}
                >
                  {selectedSite?.kind === 'brand'
                    ? <Fingerprint size={16} strokeWidth={1.75} />
                    : <Globe size={16} strokeWidth={1.75} />}
                </span>
                <span className="flex-1 min-w-0 text-left">
                  <span className="block text-[13px] font-semibold truncate leading-tight" style={{ color: 'var(--ink)' }}>
                    {selectedSite?.label || 'No site yet'}
                  </span>
                  <span className="block text-[11px] truncate leading-tight mt-0.5" style={{ color: 'var(--m-muted)' }}>
                    {selectedSite?.sub || 'Run your first audit'}
                  </span>
                </span>
                <ChevronDown size={15} style={{ color: 'var(--m-muted)' }} />
              </button>

              {brandMenuOpen && (
                <div
                  className="absolute left-0 right-0 mt-1.5 rounded-xl shadow-lg overflow-hidden z-50"
                  style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
                  role="listbox"
                >
                  <div className="max-h-[300px] overflow-y-auto py-1">
                    {sites.length === 0 && (
                      <p className="px-3 py-3 text-[12px]" style={{ color: 'var(--m-muted)' }}>
                        No sites or brands yet. Run your first audit to get started.
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
                            // Selecting a brand/site updates the selection and
                            // sends the user to the workspace Overview for that
                            // brand. Overview is the entry point for Find/Fix/
                            // Track; deep audit-detail pages are reachable from
                            // there. This avoids dropping users into a sub-
                            // surface (Brand DNA / a specific audit detail)
                            // that may not match what they were doing.
                            setSelectedSiteId(s.id);
                            setBrandMenuOpen(false);
                            // Persist selection synchronously so the Overview
                            // route mounts with the correct scope on first
                            // render (the effect that mirrors selectedSiteId
                            // would otherwise race the navigation).
                            writeSelection(selectionFromSidebarId(s.id));
                            router.push('/dashboard/overview');
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-black/[0.04]"
                        >
                          <span
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--m-muted)' }}
                          >
                            {s.kind === 'brand'
                              ? <Fingerprint size={13} strokeWidth={1.75} />
                              : <Globe size={13} strokeWidth={1.75} />}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[13px] font-medium truncate leading-tight" style={{ color: 'var(--ink)' }}>
                              {s.label}
                            </span>
                            <span className="block text-[11px] truncate leading-tight mt-0.5" style={{ color: 'var(--m-muted)' }}>
                              {s.sub}
                            </span>
                          </span>
                          {selected && <Check size={14} style={{ color: 'var(--signal)' }} />}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ borderTop: '1px solid var(--rule)' }}>
                    <Link
                      href="/dashboard/new-audit"
                      onClick={() => { setBrandMenuOpen(false); setSidebarOpen(false); }}
                      className="flex items-center gap-2 px-3 py-2.5 text-[12px] font-medium transition-colors hover:bg-black/[0.04]"
                      style={{ color: 'var(--ink)' }}
                    >
                      <Plus size={13} />
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
              className="w-full flex items-center justify-center py-2.5 rounded-lg hover:bg-black/[0.04] transition-colors"
              title={selectedSite ? `${selectedSite.label}` : 'Switch site / brand'}
              aria-label="Switch site or brand"
              style={{ color: 'var(--ink)', border: '1px solid var(--rule)' }}
            >
              {selectedSite?.kind === 'brand'
                ? <Fingerprint size={17} strokeWidth={1.75} />
                : <Globe size={17} strokeWidth={1.75} />}
            </button>
          </div>
        )}

        {/* Navigation — Brand workspace nav (brand-only IA) */}
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
                  const onClick = () => setSidebarOpen(false);
                  const linkClass = clsx(
                    'flex items-center rounded-lg transition-colors text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-signal/40',
                    collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-2.5 py-[8px]',
                    active ? 'font-semibold' : 'hover:bg-black/[0.04]',
                  );
                  const linkStyle = {
                    color: active ? 'var(--ink)' : 'var(--ink-2)',
                    background: active ? '#ffffff' : undefined,
                    boxShadow: active ? '0 1px 2px rgba(20,19,15,0.04)' : undefined,
                  } as React.CSSProperties;
                  return (
                    <li key={`${group.label}-${item.label}`}>
                      <Link
                        href={item.href}
                        onClick={onClick}
                        title={collapsed ? item.label : undefined}
                        aria-current={active ? 'page' : undefined}
                        className={linkClass}
                        style={linkStyle}
                      >
                        <Icon
                          size={collapsed ? 17 : 15}
                          strokeWidth={1.75}
                          style={{ color: active ? 'var(--ink)' : 'var(--m-muted)' }}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom area: Account + Settings + Buy credits */}
        <div className={clsx('py-2 space-y-0.5', collapsed ? 'px-1.5' : 'px-2')} style={{ borderTop: '1px solid var(--rule)' }}>
          {/* Account holder info */}
          {!loading && user && !collapsed && (
            <div className="flex items-center gap-2.5 px-3 py-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0" style={{ background: 'var(--paper-2)', color: 'var(--m-muted)', border: '1px solid var(--rule)' }}>
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
            </div>
          )}
          {!loading && user && collapsed && (
            <div className="flex items-center justify-center py-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold" style={{ background: 'var(--paper-2)', color: 'var(--m-muted)', border: '1px solid var(--rule)' }}>
                {initials}
              </div>
            </div>
          )}

          {/* Settings */}
          <Link
            href="/dashboard/settings"
            onClick={() => setSidebarOpen(false)}
            title={collapsed ? 'Settings' : undefined}
            aria-current={pathname?.startsWith('/dashboard/settings') || pathname?.startsWith('/dashboard/white-label') ? 'page' : undefined}
            className={clsx(
              'w-full flex items-center rounded-lg text-[13px] transition-all hover:bg-black/[0.04]',
              collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-2.5 py-[8px]',
              (pathname?.startsWith('/dashboard/settings') || pathname?.startsWith('/dashboard/white-label')) ? 'font-semibold' : '',
            )}
            style={{
              color: (pathname?.startsWith('/dashboard/settings') || pathname?.startsWith('/dashboard/white-label')) ? 'var(--ink)' : 'var(--ink-2)',
              background: (pathname?.startsWith('/dashboard/settings') || pathname?.startsWith('/dashboard/white-label')) ? '#ffffff' : undefined,
            }}
          >
            <Settings size={collapsed ? 16 : 15} strokeWidth={1.75} style={{ color: (pathname?.startsWith('/dashboard/settings') || pathname?.startsWith('/dashboard/white-label')) ? 'var(--ink)' : 'var(--m-muted)' }} />
            {!collapsed && <span className="truncate">Settings</span>}
          </Link>

          {/* Buy credits */}
          <Link
            href="/dashboard/buy-credits"
            onClick={() => setSidebarOpen(false)}
            title={collapsed ? 'Buy credits' : undefined}
            aria-current={pathname === '/dashboard/buy-credits' ? 'page' : undefined}
            className={clsx(
              'w-full flex items-center rounded-lg text-[13px] transition-all hover:bg-black/[0.04]',
              collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-2.5 py-[8px]',
              pathname === '/dashboard/buy-credits' ? 'font-semibold' : '',
            )}
            style={{
              color: pathname === '/dashboard/buy-credits' ? 'var(--ink)' : 'var(--ink-2)',
              background: pathname === '/dashboard/buy-credits' ? '#ffffff' : undefined,
            }}
          >
            <Coins size={collapsed ? 16 : 15} strokeWidth={1.75} style={{ color: pathname === '/dashboard/buy-credits' ? 'var(--ink)' : 'var(--m-muted)' }} />
            {!collapsed && <span className="truncate">Buy credits</span>}
          </Link>

          {/* Admin link (only for admins) */}
          {((profile as any)?.role === 'admin' || (profile as any)?.role === 'super_admin') && (
            <Link
              href="/admin"
              title={collapsed ? 'Admin' : undefined}
              className={clsx(
                'w-full flex items-center rounded-lg text-[13px] transition-all hover:bg-black/[0.04]',
                collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-2.5 py-[8px]',
              )}
              style={{ color: 'var(--ink-2)' }}
            >
              <ShieldCheck size={collapsed ? 16 : 15} strokeWidth={1.75} style={{ color: 'var(--m-muted)' }} />
              {!collapsed && <span className="truncate">Admin</span>}
            </Link>
          )}

          {/* Sign out + theme toggle */}
          <div className={clsx('flex items-center pt-1 mt-1', collapsed ? 'flex-col gap-1' : 'gap-1 px-1')} style={{ borderTop: '1px solid var(--rule)' }}>
            <button
              onClick={() => signOut()}
              title={collapsed ? 'Sign out' : 'Sign out'}
              className={clsx(
                'flex items-center rounded-md text-[12px] transition-all hover:bg-black/[0.04]',
                collapsed ? 'justify-center py-2 w-full' : 'gap-1.5 px-2 py-1.5',
              )}
              style={{ color: 'var(--ink-2)' }}
            >
              <LogOut size={14} strokeWidth={1.75} />
              {!collapsed && 'Sign out'}
            </button>
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
              <span className="font-sans font-semibold text-[14px] leading-none tracking-[-0.02em]" style={{ color: 'var(--ink)' }}>Fixpath</span>
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
                    : currentHash === 'technical_health' ? 'Technical health'
                    : currentHash === 'ai_xray' ? 'AI Readability'
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
