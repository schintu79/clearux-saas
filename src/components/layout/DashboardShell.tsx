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
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import Logo from '@/components/ui/Logo';
import ThemeToggle from '@/components/ui/ThemeToggle';

interface DashboardShellProps {
  children: React.ReactNode;
}

const DashboardShell: React.FC<DashboardShellProps> = ({ children }) => {
  const pathname = usePathname();
  const { theme } = useTheme();
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
    <div className="flex h-screen" style={{ background: 'var(--paper)', fontFamily: 'var(--font-sans)' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={clsx(
          'fixed md:static inset-y-0 left-0 w-[240px] flex flex-col z-50 transition-transform duration-200 transform md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ background: 'var(--paper-2)', borderRight: '1px solid var(--rule)' }}
      >
        {/* Logo */}
        <div className="px-5 py-5 flex items-center" style={{ borderBottom: '1px solid var(--rule)' }}>
          <Link href="/dashboard" className="flex items-center">
            <Logo height={26} variant={theme === 'dark' ? 'light' : 'dark'} />
          </Link>
        </div>

        {/* New audit CTA */}
        <div className="px-4 pt-4 pb-2">
          <Link
            href="/dashboard/new-audit"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center justify-center gap-2 w-full px-3 py-2.5 text-[13px] font-medium rounded-full transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: 'var(--signal)', color: '#FFFFFF' }}
          >
            <PlusCircle size={14} strokeWidth={1.5} />
            New audit
          </Link>
        </div>

        {/* Navigation */}
        <nav aria-label="Dashboard navigation" className="flex-1 px-3 py-3 overflow-y-auto">
          <p className="px-3 mb-2 font-mono text-[10px] tracking-[0.1em] uppercase" style={{ color: 'var(--m-muted-2)' }}>
            Workspace
          </p>
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
                      'flex items-center gap-2.5 px-3 py-[8px] rounded-lg transition-all text-[13px]',
                      active
                        ? 'font-medium'
                        : 'hover:bg-[rgba(0,0,0,0.04)]'
                    )}
                    style={{
                      color: active ? 'var(--ink)' : 'var(--m-muted)',
                      background: active ? 'var(--signal-soft)' : undefined,
                    }}
                  >
                    <span className="relative">
                      <Icon size={16} strokeWidth={1.5} style={{ color: active ? 'var(--signal)' : undefined }} />
                      {(item as any).badge && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: 'var(--severe)' }} />
                      )}
                    </span>
                    <span>{item.label}</span>
                    {(item as any).badge && (
                      <span className="ml-auto text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-full leading-none" style={{ background: 'var(--severe)', color: '#FFFFFF' }}>
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
            <div className="rounded-lg p-3" style={{ border: '1px solid var(--rule)', background: 'var(--paper)' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Coins size={13} style={{ color: 'var(--signal)' }} />
                  <span className="text-[11px] font-medium" style={{ color: 'var(--ink)' }}>Credits</span>
                </div>
                <span className="text-base font-serif font-normal tabular-nums" style={{ color: 'var(--signal)' }}>{credits}</span>
              </div>
              <p className="text-[11px] leading-snug mb-2.5" style={{ color: 'var(--m-muted)' }}>
                {credits === 0
                  ? 'No credits remaining'
                  : `${credits} audit${credits !== 1 ? 's' : ''} remaining`}
              </p>
              <Link
                href="/dashboard/buy-credits"
                className="block text-center text-[11px] font-medium rounded-full py-1.5 transition-all"
                style={{ color: 'var(--ink)', border: '1px solid var(--rule)', background: 'transparent' }}
              >
                {credits === 0 ? 'Buy credits' : 'Buy more'}
              </Link>
            </div>
          </div>
        )}

        {/* Bottom section */}
        <div className="px-3 py-3 space-y-1" style={{ borderTop: '1px solid var(--rule)' }}>
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[11px] font-mono uppercase tracking-[0.06em]" style={{ color: 'var(--m-muted-2)' }}>Theme</span>
            <ThemeToggle variant="pill" />
          </div>

          {!loading && user && (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors" style={{ cursor: 'default' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
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
                  displayName ? 'text-[11px]' : 'text-[12px] font-medium'
                )} style={{ color: displayName ? 'var(--m-muted)' : 'var(--ink)' }}>
                  {user.email}
                </p>
              </div>
            </div>
          )}

          {/* Admin link */}
          {((profile as any)?.role === 'admin' || (profile as any)?.role === 'super_admin') && (
            <Link
              href="/admin"
              className="w-full flex items-center gap-2.5 px-2 py-[7px] rounded-lg text-[13px] transition-all"
              style={{ color: 'var(--m-muted)' }}
            >
              <ShieldCheck size={15} strokeWidth={1.75} />
              Admin panel
            </Link>
          )}

          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-2.5 px-2 py-[7px] rounded-lg text-[13px] transition-all"
            style={{ color: 'var(--m-muted)' }}
          >
            <LogOut size={15} strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden h-14 flex items-center px-4" style={{ background: 'var(--paper)', borderBottom: '1px solid var(--rule)' }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-[44px] h-[44px] rounded-lg inline-flex items-center justify-center transition-colors"
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={sidebarOpen}
          >
            <div className="w-5 h-3.5 flex flex-col justify-between">
              <span
                className="block h-[2px] w-full rounded-full transition-all duration-300 origin-center"
                style={{
                  background: 'var(--ink)',
                  transform: sidebarOpen ? 'translateY(5px) rotate(45deg)' : 'none',
                }}
              />
              <span
                className="block h-[2px] w-full rounded-full transition-all duration-300 origin-center"
                style={{
                  background: 'var(--ink)',
                  transform: sidebarOpen ? 'translateY(-5px) rotate(-45deg)' : 'none',
                }}
              />
            </div>
          </button>
          <span className="ml-3">
            <Logo height={26} variant={theme === 'dark' ? 'light' : 'dark'} />
          </span>
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
