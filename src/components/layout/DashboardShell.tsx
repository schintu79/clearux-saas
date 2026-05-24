'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Server,
  RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';
import { AuditBundleProvider } from '@/context/AuditBundleContext';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import ThemeToggle from '@/components/ui/ThemeToggle';
import SiteFavicon from '@/components/ui/SiteFavicon';
import Logo, { Iconmark } from '@/components/ui/Logo';
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

  // Track whether the last setSelectedSiteId call was from an internal UI
  // action (sidebar click, route sync) vs. an external source (subscription
  // from another component calling writeSelection). Only internal changes
  // should write back to the persistent store — otherwise we clobber
  // selections set by the new-audit page's persistAuditSelection().
  const internalChangeRef = useRef(false);

  // Wrapper: call this instead of raw setSelectedSiteId when the change
  // originates from a user action inside this shell (sidebar dropdown,
  // route-sync effect). It flags the change as "internal" so the
  // write-back effect knows to mirror it to the persistent store.
  const selectSiteInternal = (id: string | null) => {
    internalChangeRef.current = true;
    setSelectedSiteId(id);
  };

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
      // External change — do NOT flag as internal so the write-back
      // effect won't clobber what was just written to the store.
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
  const fetchIdRef = useRef(0);
  const loadSites = useCallback(async () => {
    if (!user) return;
    const id = ++fetchIdRef.current;
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
    if (id !== fetchIdRef.current) return;

    // Track which brand_identity_ids have audits
    const brandIdsWithAudits = new Set<string>();
    for (const a of (audits || []) as any[]) {
      if (a.brand_identity_id) brandIdsWithAudits.add(a.brand_identity_id);
    }

    // Build a set of hostnames that already have a matching brand_identity
    // so we can suppress standalone site entries for those domains.
    const brandHostnames = new Set<string>();
    for (const b of (brandsRes?.identities || []) as any[]) {
      if (b.website_url) {
        try {
          const bHost = new URL(b.website_url).hostname.replace(/^www\./, '');
          if (bHost) brandHostnames.add(bHost);
        } catch {}
      }
    }

    const byDomain = new Map<string, SiteEntry>();
    for (const a of (audits || []) as any[]) {
      if (!a.product_url) continue;
      let host = a.product_url as string;
      try { host = new URL(a.product_url).hostname.replace(/^www\./, ''); } catch {}
      // Skip site entry if a brand already covers this hostname
      if (brandHostnames.has(host)) continue;
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

    // Build a lookup from hostname → brand entry id so we can auto-migrate
    // stale site:host selections to their brand equivalent.
    const hostToBrandEntryId = new Map<string, string>();
    for (const b of (brandsRes?.identities || []) as any[]) {
      if (b.website_url) {
        try {
          const bHost = new URL(b.website_url).hostname.replace(/^www\./, '');
          if (bHost) hostToBrandEntryId.set(bHost, `brand:${b.id}`);
        } catch {}
      }
    }

    const all = [...siteEntries, ...brandEntries];
    setSites(all);
    // Default selection: prefer current route context, else most-recent site.
    // Also auto-migrate stale site:host → brand:id when a brand now covers that host.
    setSelectedSiteId((prev) => {
      if (prev?.startsWith('site:')) {
        const host = prev.slice(5);
        const brandEntryId = hostToBrandEntryId.get(host);
        if (brandEntryId) {
          // Persist the migration so localStorage is updated too
          internalChangeRef.current = true;
          return brandEntryId;
        }
      }
      return prev || all[0]?.id || null;
    });
  }, [user]);

  useEffect(() => { loadSites(); }, [loadSites]);

  // When the selected brand/site changes and isn't in the sites list yet
  // (e.g. new audit for a domain that hasn't completed), add a temporary
  // entry so the selector shows the new domain immediately, then refresh
  // the full list in the background.
  useEffect(() => {
    if (!selectedSiteId || !sites.length) return;
    const exists = sites.some(s => s.id === selectedSiteId);
    if (!exists) {
      // Parse the id to create a temporary entry
      if (selectedSiteId.startsWith('site:')) {
        const host = selectedSiteId.slice(5);
        setSites(prev => [...prev, { kind: 'site', id: selectedSiteId, label: host, sub: 'Website', auditId: null }]);
      } else if (selectedSiteId.startsWith('brand:')) {
        const brandId = selectedSiteId.slice(6);
        setSites(prev => [...prev, { kind: 'brand', id: selectedSiteId, label: brandId, sub: 'Brand identity' }]);
      }
      // Refresh the full list so the entry gets proper metadata
      loadSites();
    }
  }, [selectedSiteId, sites, loadSites]);

  // Sync the selected site/brand with the current route so the selector
  // reflects what the user is looking at. Specifically: when the user is on
  // /dashboard/audits/<id>, find the matching site entry and switch.
  useEffect(() => {
    if (!sites.length) return;
    if (pathname?.startsWith('/dashboard/audits/')) {
      const auditId = pathname.split('/')[3];
      const match = sites.find(s => s.kind === 'site' && s.auditId === auditId);
      if (match) selectSiteInternal(match.id);
    } else if (pathname?.startsWith('/dashboard/brand-identity/')) {
      const brandId = pathname.split('/')[3];
      const match = sites.find(s => s.kind === 'brand' && s.id === `brand:${brandId}`);
      if (match) selectSiteInternal(match.id);
    }
  }, [pathname, sites]);

  // Mirror INTERNAL selection changes into the persistent brand-selection
  // store so Overview / Find / Fix / Track scope their queries to the same
  // brand. Only writes when the change came from a user action inside this
  // shell (sidebar dropdown click, route sync) — NOT from an external
  // subscription event. This prevents the race where:
  //   - new-audit page writes { kind:'site', host:'newsite.com' } to store
  //   - the subscription syncs selectedSiteId to the new value
  //   - but this effect would re-write the OLD stale value back to the store
  //     before the subscription fires, clobbering the new selection
  useEffect(() => {
    // Only write back when the change was triggered internally
    if (!internalChangeRef.current) return;
    internalChangeRef.current = false;

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
      label: 'Website',
      items: [
        { label: 'Overview', href: '/dashboard/overview', icon: BarChart3 },
        { label: 'Find', href: '/dashboard/find', icon: Search, matchPaths: ['/dashboard/audits'] },
        { label: 'Fix', href: '/dashboard/fix', icon: Wrench },
        { label: 'Track', href: '/dashboard/track', icon: LineChart },
        { label: 'Connect site', href: '/dashboard/connect', icon: Server },
      ],
    },
    {
      label: 'Brand DNA',
      items: [
        { label: 'Brand DNA', href: '/dashboard/brand-dna', icon: Fingerprint, matchPaths: ['/dashboard/brand-identity'] },
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
      className={clsx('h-12 flex items-center', collapsed ? 'px-2 justify-between' : 'px-3.5 justify-between')}
      style={{ borderBottom: '1px solid var(--rule)' }}
    >
      <Link href="/dashboard" className="flex items-center min-w-0" aria-label="Fixpath home">
        {collapsed ? (
          <Iconmark size={36} />
        ) : (
          <Logo height={52} />
        )}
      </Link>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden md:inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors hover:bg-black/[0.04]"
        style={{ color: 'var(--m-muted)' }}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
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
        data-sidebar-bg="var(--card)"
      >
        {SidebarLogo}

        {/* Dashboard link — always first, prominent */}
        <div className={clsx('pt-3', collapsed ? 'px-1.5' : 'px-2')}>
          <Link
            href="/dashboard"
            onClick={() => setSidebarOpen(false)}
            title={collapsed ? 'Dashboard' : undefined}
            aria-current={pathname === '/dashboard' ? 'page' : undefined}
            className={clsx(
              'flex items-center rounded-lg transition-colors text-[13px] font-semibold outline-none',
              collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-2',
              pathname === '/dashboard' ? '' : 'hover:bg-black/[0.04]',
            )}
            style={{
              color: 'var(--ink)',
              background: pathname === '/dashboard' ? 'var(--paper-2)' : undefined,
              border: pathname === '/dashboard' ? '1px solid var(--rule)' : '1px solid transparent',
            }}
          >
            <LayoutDashboard
              size={collapsed ? 17 : 16}
              strokeWidth={2}
              style={{ color: 'var(--ink)' }}
            />
            {!collapsed && <span className="truncate">Dashboard</span>}
          </Link>
        </div>

        {/* 40px spacer before workspace section */}
        <div style={{ minHeight: 40 }} />

        {/* Brand/site selector */}
        {!collapsed && (
          <div className="px-3 pt-2 pb-3" ref={brandMenuRef}>
            <div className="relative">
              <button
                onClick={() => setBrandMenuOpen((v) => !v)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors hover:bg-black/[0.04]"
                style={{ border: '1px solid var(--rule)' }}
                aria-haspopup="listbox"
                aria-expanded={brandMenuOpen}
                aria-label="Switch site or brand"
              >
                <span
                  className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--ink)', color: 'var(--paper)' }}
                >
                  {selectedSite?.kind === 'brand'
                    ? <Fingerprint size={13} strokeWidth={1.75} />
                    : <SiteFavicon hostname={selectedSite?.label || ''} size={13} />}
                </span>
                <span className="flex-1 min-w-0 text-left">
                  <span className="block text-[13px] font-medium truncate leading-tight" style={{ color: 'var(--ink)' }}>
                    {selectedSite?.label || 'No site yet'}
                  </span>
                  <span className="block text-[10.5px] truncate leading-tight mt-0.5" style={{ color: 'var(--m-muted)' }}>
                    {selectedSite?.sub || 'Run your first audit'}
                  </span>
                </span>
                <ChevronDown size={14} style={{ color: 'var(--m-muted)' }} />
              </button>

              {brandMenuOpen && (
                <div
                  className="absolute left-0 right-0 mt-1 rounded-lg shadow-lg overflow-hidden z-50"
                  style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
                  role="listbox"
                >
                  <div className="max-h-[280px] overflow-y-auto py-1">
                    {sites.length === 0 && (
                      <p className="px-3 py-2.5 text-[12px]" style={{ color: 'var(--m-muted)' }}>
                        No sites or brands yet. Run your first audit.
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
                            selectSiteInternal(s.id);
                            setBrandMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-black/[0.04]"
                        >
                          <span
                            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--m-muted)' }}
                          >
                            {s.kind === 'brand'
                              ? <Fingerprint size={12} strokeWidth={1.75} />
                              : <SiteFavicon hostname={s.label} size={12} />}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[13px] font-medium truncate leading-tight" style={{ color: 'var(--ink)' }}>
                              {s.label}
                            </span>
                          </span>
                          {selected && <Check size={13} style={{ color: 'var(--ink)' }} />}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ borderTop: '1px solid var(--rule)' }}>
                    <Link
                      href="/dashboard/new-audit"
                      onClick={() => { setBrandMenuOpen(false); setSidebarOpen(false); }}
                      className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium transition-colors hover:bg-black/[0.04]"
                      style={{ color: 'var(--m-muted)' }}
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
              className="w-full flex items-center justify-center py-2.5 rounded-lg hover:bg-black/[0.04] transition-colors"
              title={selectedSite ? `${selectedSite.label}` : 'Switch site / brand'}
              aria-label="Switch site or brand"
              style={{ color: 'var(--ink)', border: '1px solid var(--rule)' }}
            >
              {selectedSite?.kind === 'brand'
                ? <Fingerprint size={17} strokeWidth={1.75} />
                : <SiteFavicon hostname={selectedSite?.label || ''} size={17} />}
            </button>
          </div>
        )}

        {/* Context-aware audit actions */}
        <div className={clsx('pb-2', collapsed ? 'px-2' : 'px-3')}>
          {selectedSite && !collapsed ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setSidebarOpen(false);
                  const brandParam = selectedSite.id.startsWith('brand:') ? selectedSite.id.slice(6) : '';
                  const host = selectedSite.kind === 'site' ? selectedSite.label : '';
                  router.push(`/dashboard/new-audit?mode=re-audit${brandParam ? `&brand=${brandParam}` : ''}${host ? `&url=${encodeURIComponent(host)}` : ''}`);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-[7px] text-[12px] font-medium rounded-md transition-all hover:opacity-90"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}
                title="Re-audit this brand"
              >
                <RefreshCw size={12} strokeWidth={1.75} />
                Re-audit
              </button>
              <button
                onClick={() => {
                  setSidebarOpen(false);
                  const brandParam = selectedSite.id.startsWith('brand:') ? selectedSite.id.slice(6) : '';
                  const host = selectedSite.kind === 'site' ? selectedSite.label : '';
                  router.push(`/dashboard/new-audit?mode=dig-deeper${brandParam ? `&brand=${brandParam}` : ''}${host ? `&url=${encodeURIComponent(host)}` : ''}&depth=deep`);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-[7px] text-[12px] font-medium rounded-md transition-all hover:opacity-90"
                style={{ background: 'var(--paper-2)', color: 'var(--ink)', border: '1px solid var(--rule)' }}
                title="Run a deeper audit"
              >
                <Search size={12} strokeWidth={1.75} />
                Dig deeper
              </button>
            </div>
          ) : (
            <Link
              href="/dashboard/new-audit"
              onClick={() => setSidebarOpen(false)}
              className={clsx(
                'flex items-center justify-center w-full rounded-md transition-all hover:opacity-90',
                collapsed ? 'px-0 py-2' : 'gap-1.5 px-3 py-[7px] text-[13px] font-medium',
              )}
              style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              title={collapsed ? 'Add new site or brand' : undefined}
            >
              <PlusCircle size={collapsed ? 16 : 14} strokeWidth={1.75} />
              {!collapsed && 'Add new site or brand'}
            </Link>
          )}
        </div>

        {/* Navigation — Brand workspace nav */}
        <nav aria-label="Dashboard navigation" className={clsx('flex-1 overflow-y-auto pb-2', collapsed ? 'px-1.5' : 'px-2')}>
          {navGroups.map((group, gi) => (
            <div key={`g-${gi}`} className={clsx(gi > 0 && 'mt-3')}>
              {group.label && !collapsed && gi > 0 && (
                <div className="mx-2 my-1.5" style={{ borderTop: '1px solid var(--rule)' }} />
              )}
              {group.label && collapsed && gi > 0 && (
                <div className="mx-2 my-2" style={{ borderTop: '1px solid var(--rule)' }} />
              )}
              {group.label && !collapsed && (
                <p className="px-2 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--m-muted)' }}>
                  {group.label}
                </p>
              )}
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);
                  const onClick = () => setSidebarOpen(false);
                  const linkClass = clsx(
                    'flex items-center rounded-md transition-colors text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-signal/40',
                    collapsed ? 'justify-center px-0 py-1.5' : 'gap-2 px-2 py-[7px]',
                    active ? 'font-medium' : 'hover:bg-black/[0.04]',
                  );
                  const linkStyle = {
                    color: active ? 'var(--ink)' : 'var(--ink-2)',
                    background: active ? 'var(--paper-2)' : undefined,
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
              'w-full flex items-center rounded-md text-[13px] transition-all hover:bg-black/[0.04]',
              collapsed ? 'justify-center px-0 py-1.5' : 'gap-2 px-2 py-[6px]',
              (pathname?.startsWith('/dashboard/settings') || pathname?.startsWith('/dashboard/white-label')) ? 'font-medium' : '',
            )}
            style={{
              color: (pathname?.startsWith('/dashboard/settings') || pathname?.startsWith('/dashboard/white-label')) ? 'var(--ink)' : 'var(--ink-2)',
              background: (pathname?.startsWith('/dashboard/settings') || pathname?.startsWith('/dashboard/white-label')) ? 'var(--paper-2)' : undefined,
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
              'w-full flex items-center rounded-md text-[13px] transition-all hover:bg-black/[0.04]',
              collapsed ? 'justify-center px-0 py-1.5' : 'gap-2 px-2 py-[6px]',
              pathname === '/dashboard/buy-credits' ? 'font-medium' : '',
            )}
            style={{
              color: pathname === '/dashboard/buy-credits' ? 'var(--ink)' : 'var(--ink-2)',
              background: pathname === '/dashboard/buy-credits' ? 'var(--paper-2)' : undefined,
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
                'w-full flex items-center rounded-md text-[13px] transition-all hover:bg-black/[0.04]',
                collapsed ? 'justify-center px-0 py-1.5' : 'gap-2 px-2 py-[6px]',
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
            <span className="md:hidden flex items-center">
              <Logo height={38} />
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
                    : currentHash === 'wcag' ? 'WCAG compliance'
                    : currentHash === 'ai_xray' ? 'AI Readability'
                    : currentHash === 'intelligence' ? 'Benchmark'
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
          <AuditBundleProvider>
            <div className="p-5 sm:p-6 lg:p-8">{children}</div>
          </AuditBundleProvider>
        </main>
      </div>
    </div>
  );
};

export default DashboardShell;
