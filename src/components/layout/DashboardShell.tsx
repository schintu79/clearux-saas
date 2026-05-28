'use client';

/**
 * DashboardShell — Workspace-aware sidebar + top bar layout.
 *
 * Reads the workspace slug from the URL path (/dashboard/[slug]/...) and
 * uses it to scope all navigation links. The old brand-selection dropdown
 * is replaced by a workspace name display derived from the URL.
 *
 * AuditBundleProvider is NOT rendered here — it lives in the [slug] layout
 * so it can access WorkspaceContext.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
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
  Target,
  Bot,
  Gauge,
  LayoutDashboard,
  FolderOpen,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import ThemeToggle from '@/components/ui/ThemeToggle';
import SiteFavicon from '@/components/ui/SiteFavicon';
import Logo, { Iconmark } from '@/components/ui/Logo';

interface DashboardShellProps {
  children: React.ReactNode;
}

/**
 * Extract the workspace slug from the current pathname.
 * Pattern: /dashboard/[slug]/...
 * If we're at /dashboard (no slug), returns null.
 */
function extractSlugFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const parts = pathname.split('/').filter(Boolean);
  // /dashboard/[slug]/... → parts = ['dashboard', slug, ...]
  if (parts.length >= 2 && parts[0] === 'dashboard') {
    const candidate = parts[1];
    // These are known non-slug dashboard routes at /dashboard level
    const nonSlugRoutes = new Set([
      'settings', 'buy-credits', 'notifications', 'new-audit',
      'portfolio', 'reports', 'audits', 'brand-identity',
      'deploy', 'admin',
    ]);
    if (!nonSlugRoutes.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

const DashboardShell: React.FC<DashboardShellProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, signOut, loading } = useAuth();

  // Extract workspace slug from URL
  const workspaceSlug = extractSlugFromPath(pathname);

  // Sidebar UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Credit data
  const [creditData, setCreditData] = useState<{
    credits: number;
    subscription_plan: string | null;
    subscription_status: string | null;
    audits_remaining: number;
    audits_per_month: number;
    first_audit_free: boolean;
  } | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Workspace list for the workspace switcher dropdown
  const [workspaces, setWorkspaces] = useState<Array<{
    id: string;
    slug: string;
    name: string;
    primary_domain: string | null;
    brand_name: string | null;
    workspace_type: string;
  }>>([]);
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const wsMenuRef = useRef<HTMLDivElement>(null);

  // Fetch workspaces for the sidebar switcher
  useEffect(() => {
    if (!user) return;
    fetch('/api/workspaces')
      .then((r) => r.ok ? r.json() : { workspaces: [] })
      .then((d) => setWorkspaces(d.workspaces || []))
      .catch(() => {});
  }, [user]);

  // Current workspace derived from slug
  const currentWorkspace = useMemo(
    () => workspaces.find((w) => w.slug === workspaceSlug) || null,
    [workspaces, workspaceSlug],
  );

  // Fetch credits and notifications
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

  // Click-outside / Escape to close workspace menu
  useEffect(() => {
    if (!wsMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (wsMenuRef.current && !wsMenuRef.current.contains(e.target as Node)) {
        setWsMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setWsMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [wsMenuOpen]);

  // Hash tracking for breadcrumb
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

  // Nav base path — when inside a workspace, prefix all links
  const navBase = workspaceSlug ? `/dashboard/${workspaceSlug}` : '/dashboard';

  // Audit detail detection
  const onAuditDetail = pathname?.startsWith(`${navBase}/audits/`) && pathname.split('/').length >= 5;

  type NavItem = {
    label: string;
    href: string;
    icon: React.ElementType;
    badge?: boolean;
    matchPaths?: string[];
  };
  type NavGroup = { label: string | null; items: NavItem[] };

  const navGroups: NavGroup[] = [
    {
      label: '',
      items: [
        { label: 'Overview', href: `${navBase}/overview`, icon: LayoutDashboard },
      ],
    },
    {
      label: 'Analysis',
      items: [
        { label: 'Competitors', href: `${navBase}/competitors`, icon: Target },
        { label: 'Brand intelligence', href: `${navBase}/intelligence`, icon: BarChart3 },
        { label: 'AI Perception', href: `${navBase}/ai-perception`, icon: Bot, matchPaths: [`${navBase}/ai-readability`] },
        { label: 'Website speed', href: `${navBase}/speed`, icon: Gauge },
        { label: 'Brand DNA', href: `${navBase}/brand-dna`, icon: Fingerprint, matchPaths: [`${navBase}/brand-identity`] },
      ],
    },
    {
      label: 'Actions',
      items: [
        { label: 'Find', href: `${navBase}/find`, icon: Search, matchPaths: [`${navBase}/audits`] },
        { label: 'Fix', href: `${navBase}/fix`, icon: Wrench },
        { label: 'Track', href: `${navBase}/track`, icon: LineChart },
        { label: 'Connect site', href: `${navBase}/connect`, icon: Server },
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

  const workspaceLabel = currentWorkspace?.name
    || currentWorkspace?.primary_domain
    || workspaceSlug
    || null;

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

        {/* Spacer before workspace selector */}
        <div style={{ minHeight: 12 }} />

        {/* Workspace selector */}
        {!collapsed && (
          <div className="px-3 pt-2 pb-3" ref={wsMenuRef}>
            <div className="relative">
              <button
                onClick={() => setWsMenuOpen((v) => !v)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors hover:bg-black/[0.04]"
                style={{ border: '1px solid var(--rule)' }}
                aria-haspopup="listbox"
                aria-expanded={wsMenuOpen}
                aria-label="Switch workspace"
              >
                <span
                  className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--m-muted)' }}
                >
                  {currentWorkspace?.primary_domain
                    ? <SiteFavicon key={currentWorkspace.primary_domain} hostname={currentWorkspace.primary_domain} size={15} />
                    : <FolderOpen size={13} strokeWidth={1.75} />}
                </span>
                <span className="flex-1 min-w-0 text-left">
                  <span className="block text-[13px] font-medium truncate leading-tight" style={{ color: 'var(--ink)' }}>
                    {workspaceLabel || 'Select workspace'}
                  </span>
                  <span className="block text-[10.5px] truncate leading-tight mt-0.5" style={{ color: 'var(--m-muted)' }}>
                    {currentWorkspace?.primary_domain || currentWorkspace?.workspace_type || 'Choose a workspace'}
                  </span>
                </span>
                <ChevronDown size={14} style={{ color: 'var(--m-muted)' }} />
              </button>

              {wsMenuOpen && (
                <div
                  className="absolute left-0 right-0 mt-1 rounded-lg shadow-lg overflow-hidden z-50"
                  style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
                  role="listbox"
                >
                  <div className="max-h-[280px] overflow-y-auto py-1">
                    {workspaces.length === 0 && (
                      <p className="px-3 py-2.5 text-[12px]" style={{ color: 'var(--m-muted)' }}>
                        No workspaces yet. Create one to get started.
                      </p>
                    )}
                    {workspaces.map((ws) => {
                      const selected = ws.slug === workspaceSlug;
                      return (
                        <button
                          key={ws.id}
                          role="option"
                          aria-selected={selected}
                          onClick={() => {
                            setWsMenuOpen(false);
                            if (!selected) {
                              // When already inside a workspace, carry over the current sub-page;
                              // otherwise (on /dashboard with no slug) go to the workspace's overview.
                              const currentPage = workspaceSlug
                                ? (pathname?.replace(`/dashboard/${workspaceSlug}`, '') || '/overview')
                                : '/overview';
                              router.push(`/dashboard/${ws.slug}${currentPage}`);
                            }
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-black/[0.04]"
                        >
                          <span
                            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--m-muted)' }}
                          >
                            {ws.primary_domain
                              ? <SiteFavicon hostname={ws.primary_domain} size={12} />
                              : <FolderOpen size={12} strokeWidth={1.75} />}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[13px] font-medium truncate leading-tight" style={{ color: 'var(--ink)' }}>
                              {ws.name}
                            </span>
                            {ws.primary_domain && (
                              <span className="block text-[10px] truncate leading-tight mt-0.5" style={{ color: 'var(--m-muted)' }}>
                                {ws.primary_domain}
                              </span>
                            )}
                          </span>
                          {selected && <Check size={13} style={{ color: 'var(--ink)' }} />}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ borderTop: '1px solid var(--rule)' }}>
                    <Link
                      href="/dashboard"
                      onClick={() => { setWsMenuOpen(false); setSidebarOpen(false); }}
                      className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium transition-colors hover:bg-black/[0.04]"
                      style={{ color: 'var(--m-muted)' }}
                    >
                      <Plus size={12} />
                      All workspaces
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Collapsed: tiny workspace icon → expand to choose */}
        {collapsed && (
          <div className="px-2 pt-2 pb-1">
            <button
              onClick={() => setCollapsed(false)}
              className="w-full flex items-center justify-center py-2.5 rounded-lg hover:bg-black/[0.04] transition-colors"
              title={workspaceLabel || 'Switch workspace'}
              aria-label="Switch workspace"
              style={{ color: 'var(--ink)', border: '1px solid var(--rule)' }}
            >
              {currentWorkspace?.primary_domain
                ? <SiteFavicon key={currentWorkspace.primary_domain} hostname={currentWorkspace.primary_domain} size={17} />
                : <FolderOpen size={17} strokeWidth={1.75} />}
            </button>
          </div>
        )}

        {/* "Create workspace" CTA when no workspace is selected */}
        {!workspaceSlug && (
          <div className={clsx('pb-2', collapsed ? 'px-2' : 'px-3')}>
            <Link
              href="/dashboard"
              onClick={() => setSidebarOpen(false)}
              className={clsx(
                'flex items-center justify-center w-full rounded-md transition-all hover:opacity-90',
                collapsed ? 'px-0 py-2' : 'gap-1.5 px-3 py-[7px] text-[13px] font-medium',
              )}
              style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              title={collapsed ? 'Create workspace' : undefined}
            >
              <PlusCircle size={collapsed ? 16 : 14} strokeWidth={1.75} />
              {!collapsed && 'Create workspace'}
            </Link>
          </div>
        )}

        {/* Navigation */}
        <nav aria-label="Dashboard navigation" className={clsx('flex-1 overflow-y-auto pb-2', collapsed ? 'px-1.5' : 'px-2')}>
          {/* Prompt to select workspace when none is active */}
          {!workspaceSlug && !collapsed && (
            <div className="mx-2 mb-3 mt-1 rounded-md px-3 py-3" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
              <p className="text-[12px] font-medium leading-snug" style={{ color: 'var(--ink-2)' }}>
                Select a workspace to access your dashboard
              </p>
            </div>
          )}
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
                  const disabled = !workspaceSlug;
                  const onClick = () => setSidebarOpen(false);
                  const linkClass = clsx(
                    'flex items-center rounded-md transition-colors text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-signal/40',
                    collapsed ? 'justify-center px-0 py-1.5' : 'gap-2 px-2 py-[7px]',
                    disabled ? 'pointer-events-none opacity-[0.33]' : active ? 'font-medium' : 'hover:bg-black/[0.04]',
                  );
                  const linkStyle = {
                    color: disabled ? 'var(--m-muted)' : active ? 'var(--ink)' : 'var(--ink-2)',
                    background: active && !disabled ? 'var(--paper-2)' : undefined,
                  } as React.CSSProperties;
                  return (
                    <li key={`${group.label}-${item.label}`}>
                      <Link
                        href={disabled ? '#' : item.href}
                        onClick={disabled ? (e) => e.preventDefault() : onClick}
                        title={collapsed ? item.label : undefined}
                        aria-current={active && !disabled ? 'page' : undefined}
                        aria-disabled={disabled || undefined}
                        tabIndex={disabled ? -1 : undefined}
                        className={linkClass}
                        style={linkStyle}
                      >
                        <Icon
                          size={collapsed ? 17 : 15}
                          strokeWidth={1.75}
                          style={{ color: disabled ? 'var(--m-muted)' : active ? 'var(--ink)' : 'var(--m-muted)' }}
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

          {/* Settings — global page, not workspace-scoped */}
          <Link
            href="/dashboard/settings"
            onClick={() => setSidebarOpen(false)}
            title={collapsed ? 'Settings' : undefined}
            aria-current={pathname?.startsWith('/dashboard/settings') ? 'page' : undefined}
            className={clsx(
              'w-full flex items-center rounded-md text-[13px] transition-all hover:bg-black/[0.04]',
              collapsed ? 'justify-center px-0 py-1.5' : 'gap-2 px-2 py-[6px]',
              (pathname?.startsWith('/dashboard/settings')) ? 'font-medium' : '',
            )}
            style={{
              color: (pathname?.startsWith('/dashboard/settings')) ? 'var(--ink)' : 'var(--ink-2)',
              background: (pathname?.startsWith('/dashboard/settings')) ? 'var(--paper-2)' : undefined,
            }}
          >
            <Settings size={collapsed ? 16 : 15} strokeWidth={1.75} style={{ color: (pathname?.startsWith('/dashboard/settings')) ? 'var(--ink)' : 'var(--m-muted)' }} />
            {!collapsed && <span className="truncate">Settings</span>}
          </Link>

          {/* Buy credits — global page, not workspace-scoped */}
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
        {/* Top bar */}
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
            {workspaceLabel && (
              <div className="hidden md:flex items-center gap-1.5 min-w-0">
                <span className="text-[12px]" style={{ color: 'var(--m-muted)' }}>Viewing</span>
                <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                  {workspaceLabel}
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

        {/* Content area — AuditBundleProvider is in [slug]/layout.tsx */}
        <main id="main-content" className="flex-1 overflow-auto">
          <div className="p-5 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default DashboardShell;
