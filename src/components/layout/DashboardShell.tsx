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
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';

interface DashboardShellProps {
  children: React.ReactNode;
}

const DashboardShell: React.FC<DashboardShellProps> = ({ children }) => {
  const pathname = usePathname();
  const { user, profile, signOut, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
          'fixed md:static inset-y-0 left-0 w-[220px] flex flex-col z-50 transition-transform duration-200 transform md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ background: 'var(--card)', borderRight: '1px solid var(--rule)' }}
      >
        {/* Logo */}
        <div className="px-5 h-14 flex items-center" style={{ borderBottom: '1px solid var(--rule)' }}>
          <Link href="/dashboard" className="flex items-center gap-2">
            <svg width={22} height={22} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-signal block shrink-0">
              <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.5" fill="none" />
              <circle cx="16" cy="16" r="5.5" fill="currentColor" />
            </svg>
            <span className="font-sans font-semibold text-[17px] leading-none tracking-[-0.02em]" style={{ color: 'var(--ink)' }}>ClearUX</span>
          </Link>
        </div>

        {/* New audit CTA */}
        <div className="px-3 pt-4 pb-1">
          <Link
            href="/dashboard/new-audit"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-[13px] font-medium rounded-lg transition-all hover:opacity-90"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            <PlusCircle size={14} strokeWidth={1.5} />
            New audit
          </Link>
        </div>

        {/* Navigation */}
        <nav aria-label="Dashboard navigation" className="flex-1 px-2 py-3 overflow-y-auto">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={clsx(
                      'flex items-center gap-2.5 px-3 py-[7px] rounded-md transition-all text-[13px]',
                      active
                        ? 'font-medium'
                        : 'hover:bg-black/[0.04]'
                    )}
                    style={{
                      color: active ? 'var(--ink)' : 'var(--m-muted)',
                      background: active ? 'var(--paper-2)' : undefined,
                    }}
                  >
                    <span className="relative">
                      <Icon size={16} strokeWidth={1.5} />
                      {(item as any).badge && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: 'var(--severe)' }} />
                      )}
                    </span>
                    <span>{item.label}</span>
                    {(item as any).badge && (
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
        {credits !== null && (
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

        {/* Bottom section */}
        <div className="px-2 py-3 space-y-0.5" style={{ borderTop: '1px solid var(--rule)' }}>
          {!loading && user && (
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

          {/* Admin link */}
          {((profile as any)?.role === 'admin' || (profile as any)?.role === 'super_admin') && (
            <Link
              href="/admin"
              className="w-full flex items-center gap-2.5 px-3 py-[6px] rounded-md text-[13px] transition-all hover:bg-black/[0.04]"
              style={{ color: 'var(--m-muted)' }}
            >
              <ShieldCheck size={15} strokeWidth={1.5} />
              Admin
            </Link>
          )}

          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-2.5 px-3 py-[6px] rounded-md text-[13px] transition-all hover:bg-black/[0.04]"
            style={{ color: 'var(--m-muted)' }}
          >
            <LogOut size={15} strokeWidth={1.5} />
            Sign out
          </button>
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
