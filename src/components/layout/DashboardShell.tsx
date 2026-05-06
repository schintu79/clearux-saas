'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileSearch,
  PlusCircle,
  Settings,
  Menu,
  X,
  LogOut,
  Coins,
  ChevronRight,
  ShieldCheck,
  Bell,
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
    { label: 'Notifications', href: '/dashboard/notifications', icon: Bell, badge: unreadNotifications > 0 },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const handleSignOut = () => {
    signOut();
  };

  const displayName = profile?.full_name
    || user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || null;
  const initials = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '?';

  return (
    <div className="flex h-screen bg-surface" style={{ fontFamily: 'var(--font-body)' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed md:static inset-y-0 left-0 w-[220px] bg-card border-r border-border flex flex-col z-50 transition-transform duration-200 transform md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="h-14 px-5 flex items-center border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="font-heading text-2xl font-medium tracking-[0.6px] text-text">clearux.ai</span>
          </Link>
        </div>

        {/* New Audit CTA */}
        <div className="px-3 pt-3 pb-1">
          <Link
            href="/dashboard/new-audit"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 text-[13px] font-medium text-surface dark:text-[#111111] bg-brand rounded-lg transition-all hover:bg-brand-hover hover:shadow-sm active:scale-[0.98]"
          >
            <PlusCircle size={14} strokeWidth={2.5} />
            New Audit
          </Link>
        </div>

        {/* Navigation */}
        <nav aria-label="Dashboard navigation" className="flex-1 px-3 py-2 overflow-y-auto">
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
                      'flex items-center gap-2.5 px-3 py-[7px] rounded-lg transition-all text-[13px]',
                      active
                        ? 'bg-surface text-text font-medium'
                        : 'text-muted hover:text-text hover:bg-surface/60'
                    )}
                  >
                    <span className="relative">
                      <Icon size={16} strokeWidth={active ? 2 : 1.75} />
                      {(item as any).badge && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#EF4444]" />
                      )}
                    </span>
                    <span>{item.label}</span>
                    {(item as any).badge && (
                      <span className="ml-auto text-[9px] font-medium text-white bg-[#EF4444] px-1.5 py-0.5 rounded-full leading-none">
                        {unreadNotifications}
                      </span>
                    )}
                    {active && !(item as any).badge && (
                      <ChevronRight size={12} className="ml-auto text-muted/50" />
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
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Coins size={13} className="text-[#22C55E]" />
                  <span className="text-[11px] font-medium text-text">Credits</span>
                </div>
                <span className="text-base font-medium text-[#22C55E] tabular-nums">{credits}</span>
              </div>
              <p className="text-[10px] text-muted mb-2.5 leading-snug">
                {credits === 0
                  ? 'No credits remaining'
                  : `${credits} audit${credits !== 1 ? 's' : ''} remaining`}
              </p>
              <Link
                href="/dashboard/buy-credits"
                className="block text-center text-[11px] font-medium text-text border border-border rounded-lg py-1.5 transition-all hover:bg-surface"
              >
                {credits === 0 ? 'Buy Credits' : 'Buy More'}
              </Link>
            </div>
          </div>
        )}

        {/* Bottom section */}
        <div className="px-3 py-3 border-t border-border space-y-1">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[11px] text-muted font-medium">Theme</span>
            <ThemeToggle variant="pill" />
          </div>

          {!loading && user && (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-surface transition-colors">
              <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center text-[10px] font-medium text-surface dark:text-[#111111] flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                {displayName && (
                  <p className="text-[12px] font-medium text-text truncate leading-tight">
                    {displayName}
                  </p>
                )}
                <p className={clsx(
                  'truncate leading-tight',
                  displayName ? 'text-[10px] text-muted' : 'text-[12px] font-medium text-text'
                )}>
                  {user.email}
                </p>
              </div>
            </div>
          )}

          {/* Admin link */}
          {((profile as any)?.role === 'admin' || (profile as any)?.role === 'super_admin') && (
            <Link
              href="/admin"
              className="w-full flex items-center gap-2.5 px-2 py-[7px] rounded-lg text-[13px] text-muted hover:text-[#EF4444] hover:bg-[#EF4444]/5 transition-all"
            >
              <ShieldCheck size={15} strokeWidth={1.75} />
              Admin Panel
            </Link>
          )}

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-2 py-[7px] rounded-lg text-[13px] text-muted hover:text-text hover:bg-surface transition-all"
          >
            <LogOut size={15} strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden h-14 bg-card border-b border-border flex items-center px-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-surface transition-colors"
          >
            {sidebarOpen ? (
              <X size={20} className="text-text" />
            ) : (
              <Menu size={20} className="text-text" />
            )}
          </button>
          <span className="ml-3 font-heading text-2xl font-medium tracking-[0.6px] text-text">
            clearux.ai
          </span>
        </div>

        {/* Content area */}
        <main id="main-content" className="flex-1 overflow-auto">
          <div className="p-4 sm:p-5 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default DashboardShell;
