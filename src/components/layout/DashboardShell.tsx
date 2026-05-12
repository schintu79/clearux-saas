'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileSearch,
  PlusCircle,
  Settings,
  LogOut,
  Coins,
  ShieldCheck,
  Bell,
  Paintbrush,
  Fingerprint,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import ThemeToggle from '@/components/ui/ThemeToggle';

interface DashboardShellProps {
  children: React.ReactNode;
}

const DashboardShell: React.FC<DashboardShellProps> = ({ children }) => {
  const pathname = usePathname();
  const { user, profile, signOut, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = () => {
      fetch('/api/credits').then((r) => r.json()).then((d) => setCredits(d.credits ?? 0)).catch(() => {});
      fetch('/api/notifications').then((r) => r.json()).then((d) => setUnreadNotifications(d.unreadCount ?? 0)).catch(() => {});
    };
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user]);

  const navItems = [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Audits', href: '/dashboard/audits', icon: FileSearch },
    { label: 'Brand identity', href: '/dashboard/brand-identity', icon: Fingerprint },
    { label: 'White label', href: '/dashboard/white-label', icon: Paintbrush },
    { label: 'Notifications', href: '/dashboard/notifications', icon: Bell, badge: unreadNotifications > 0 },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const displayName = profile?.full_name
    || user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || null;
  const initials = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '?';

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
          collapsed ? 'w-[60px]' : 'w-[220px]',
        )}
        style={{ background: 'var(--card)', borderRight: '1px solid var(--rule)' }}
      >
        {/* Logo */}
        <div className={clsx('h-14 flex items-center', collapsed ? 'px-3 justify-center' : 'px-5')} style={{ borderBottom: '1px solid var(--rule)' }}>
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <svg width={28} height={28} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-signal block shrink-0">
              <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.5" fill="none" />
              <circle cx="16" cy="16" r="5.5" fill="currentColor" />
            </svg>
            {!collapsed && (
              <span className="font-sans font-semibold text-[18px] leading-none tracking-[-0.02em]" style={{ color: 'var(--ink)' }}>ClearUX</span>
            )}
          </Link>
        </div>

        {/* New audit CTA */}
        <div className={clsx('pt-4 pb-1', collapsed ? 'px-2' : 'px-3')}>
          <Link
            href="/dashboard/new-audit"
            onClick={() => setSidebarOpen(false)}
            className={clsx(
              'flex items-center justify-center w-full rounded-lg transition-all hover:opacity-90',
              collapsed ? 'px-0 py-2' : 'gap-1.5 px-3 py-2 text-[13px] font-medium',
            )}
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
            title={collapsed ? 'New audit' : undefined}
          >
            <PlusCircle size={collapsed ? 16 : 14} strokeWidth={1.5} />
            {!collapsed && 'New audit'}
          </Link>
        </div>

        {/* Navigation */}
        <nav aria-label="Dashboard navigation" className={clsx('flex-1 py-3 overflow-y-auto', collapsed ? 'px-1.5' : 'px-2')}>
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    title={collapsed ? item.label : undefined}
                    className={clsx(
                      'flex items-center rounded-md transition-all text-[13px]',
                      collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-[7px]',
                      active ? 'font-medium' : 'hover:bg-black/[0.04]',
                    )}
                    style={{
                      color: active ? 'var(--ink)' : 'var(--ink-2)',
                      background: active ? 'var(--paper-2)' : undefined,
                    }}
                  >
                    <span className="relative flex-shrink-0">
                      <Icon size={collapsed ? 18 : 16} strokeWidth={1.5} />
                      {(item as any).badge && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: 'var(--severe)' }} />
                      )}
                    </span>
                    {!collapsed && <span>{item.label}</span>}
                    {!collapsed && (item as any).badge && (
                      <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-none" style={{ background: 'var(--severe)', color: '#FFFFFF' }}>
                        {unreadNotifications}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Credit balance */}
        {credits !== null && !collapsed && (
          <div className="mx-3 mb-2">
            <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--paper-2)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[12px]" style={{ color: 'var(--m-muted)' }}>Credits</span>
                <span className="text-[13px] font-medium tabular-nums" style={{ color: 'var(--ink)' }}>{credits}</span>
              </div>
              <Link
                href="/dashboard/buy-credits"
                className="block text-center text-[11px] font-medium rounded-md py-1.5 mt-2 transition-all"
                style={{ color: 'var(--m-muted)', border: '1px solid var(--rule)' }}
              >
                {credits === 0 ? 'Buy credits' : 'Buy more'}
              </Link>
            </div>
          </div>
        )}
        {credits !== null && collapsed && (
          <div className="mx-1.5 mb-2">
            <Link
              href="/dashboard/buy-credits"
              title={`${credits} credits`}
              className="flex items-center justify-center w-full py-2 rounded-lg text-[11px] font-medium tabular-nums"
              style={{ background: 'var(--paper-2)', color: 'var(--ink)' }}
            >
              {credits}
            </Link>
          </div>
        )}

        {/* Bottom section */}
        <div className={clsx('py-3 space-y-0.5', collapsed ? 'px-1.5' : 'px-2')} style={{ borderTop: '1px solid var(--rule)' }}>
          {!loading && user && !collapsed && (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-md">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0" style={{ background: 'var(--paper-2)', color: 'var(--m-muted)', border: '1px solid var(--rule)' }}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                {displayName && (
                  <p className="text-[12px] font-medium truncate leading-tight" style={{ color: 'var(--ink)' }}>
                    {displayName}
                  </p>
                )}
                <p className={clsx(
                  'truncate leading-tight',
                  displayName ? 'text-[11px]' : 'text-[12px]'
                )} style={{ color: 'var(--m-muted)' }}>
                  {user.email}
                </p>
              </div>
            </div>
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

          {/* Admin link */}
          {((profile as any)?.role === 'admin' || (profile as any)?.role === 'super_admin') && (
            <Link
              href="/admin"
              title={collapsed ? 'Admin' : undefined}
              className={clsx(
                'w-full flex items-center rounded-md text-[13px] transition-all hover:bg-black/[0.04]',
                collapsed ? 'justify-center py-2' : 'gap-2.5 px-3 py-[6px]',
              )}
              style={{ color: 'var(--ink-2)' }}
            >
              <ShieldCheck size={collapsed ? 18 : 15} strokeWidth={1.5} />
              {!collapsed && 'Admin'}
            </Link>
          )}

          <button
            onClick={() => signOut()}
            title={collapsed ? 'Sign out' : undefined}
            className={clsx(
              'w-full flex items-center rounded-md text-[13px] transition-all hover:bg-black/[0.04]',
              collapsed ? 'justify-center py-2' : 'gap-2.5 px-3 py-[6px]',
            )}
            style={{ color: 'var(--ink-2)' }}
          >
            <LogOut size={collapsed ? 18 : 15} strokeWidth={1.5} />
            {!collapsed && 'Sign out'}
          </button>

          {/* Theme toggle + Collapse toggle */}
          <div className={clsx('flex items-center pt-1 mt-1', collapsed ? 'flex-col gap-1' : 'justify-between px-1')} style={{ borderTop: '1px solid var(--rule)' }}>
            <ThemeToggle variant="icon" className="!p-1.5" />
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex items-center justify-center w-7 h-7 rounded-md transition-colors hover:bg-black/[0.04]"
              style={{ color: 'var(--m-muted)' }}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden h-14 flex items-center justify-between px-4" style={{ background: 'var(--card)', borderBottom: '1px solid var(--rule)' }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-9 h-9 rounded-md inline-flex items-center justify-center transition-colors hover:bg-black/[0.04]"
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X size={18} style={{ color: 'var(--ink)' }} /> : <Menu size={18} style={{ color: 'var(--ink)' }} />}
          </button>
          <span className="flex items-center gap-1.5">
            <svg width={20} height={20} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-signal block shrink-0">
              <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.5" fill="none" />
              <circle cx="16" cy="16" r="5.5" fill="currentColor" />
            </svg>
            <span className="font-sans font-semibold text-[16px] leading-none tracking-[-0.02em]" style={{ color: 'var(--ink)' }}>ClearUX</span>
          </span>
          <div className="w-9" /> {/* Spacer for centering */}
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
