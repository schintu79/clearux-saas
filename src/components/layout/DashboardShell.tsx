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

  useEffect(() => {
    if (!user) return;
    const load = () =>
      fetch('/api/credits')
        .then((r) => r.json())
        .then((d) => setCredits(d.credits ?? 0))
        .catch(() => {});
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user]);

  const navItems = [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Audits', href: '/dashboard/audits', icon: FileSearch },
    { label: 'Notifications', href: '/dashboard/notifications', icon: Bell, badge: false },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const handleSignOut = () => {
    signOut();
  };

  // User initials for avatar
  const displayName = profile?.full_name
    || user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || null;
  const initials = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '?';

  return (
    <div className="flex h-screen bg-surface-alt">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={clsx(
          'fixed md:static inset-y-0 left-0 w-[220px] bg-surface border-r border-border flex flex-col z-50 transition-transform duration-200 transform md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="h-14 px-5 flex items-center border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="font-manrope font-bold text-[17px] text-text">
              Clear<span className="bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand-text)' }}>UX</span>
            </span>
          </Link>
        </div>

        {/* New Audit CTA */}
        <div className="px-3 pt-3 pb-1">
          <Link
            href="/dashboard/new-audit"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 text-[13px] font-semibold text-white rounded-lg transition-all hover:brightness-110 hover:shadow-md active:scale-[0.98]"
            style={{ background: 'var(--gradient-brand)' }}
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
                        ? 'bg-surface-alt text-text font-medium'
                        : 'text-muted hover:text-text hover:bg-surface-alt/60'
                    )}
                  >
                    <Icon size={16} strokeWidth={active ? 2 : 1.75} />
                    <span>{item.label}</span>
                    {active && (
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
                  <Coins size={13} className="text-emerald-500" />
                  <span className="text-[11px] font-semibold text-text">Credits</span>
                </div>
                <span className="text-base font-bold text-emerald-500 tabular-nums">{credits}</span>
              </div>
              <p className="text-[10px] text-muted mb-2.5 leading-snug">
                {credits === 0
                  ? 'No credits remaining'
                  : `${credits} audit${credits !== 1 ? 's' : ''} remaining`}
              </p>
              <Link
                href="/dashboard/buy-credits"
                className="block text-center text-[11px] font-semibold text-text border border-border rounded-md py-1.5 transition-all hover:bg-surface-alt"
              >
                {credits === 0 ? 'Buy Credits' : 'Buy More'}
              </Link>
            </div>
          </div>
        )}

        {/* Bottom section */}
        <div className="px-3 py-3 border-t border-border space-y-1">
          {/* Theme toggle */}
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[11px] text-muted font-medium">Theme</span>
            <ThemeToggle variant="pill" />
          </div>

          {/* User */}
          {!loading && user && (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-surface-alt transition-colors">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                style={{ background: 'var(--gradient-brand)' }}
              >
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

          {/* Admin link (only for admin/super_admin) */}
          {((profile as any)?.role === 'admin' || (profile as any)?.role === 'super_admin') && (
            <Link
              href="/admin"
              className="w-full flex items-center gap-2.5 px-2 py-[7px] rounded-lg text-[13px] text-muted hover:text-red-500 hover:bg-red-500/5 transition-all"
            >
              <ShieldCheck size={15} strokeWidth={1.75} />
              Admin Panel
            </Link>
          )}

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-2 py-[7px] rounded-lg text-[13px] text-muted hover:text-text hover:bg-surface-alt transition-all"
          >
            <LogOut size={15} strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden h-14 bg-surface border-b border-border flex items-center px-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-surface-alt transition-colors"
          >
            {sidebarOpen ? (
              <X size={20} className="text-text" />
            ) : (
              <Menu size={20} className="text-text" />
            )}
          </button>
          <span className="ml-3 font-manrope font-bold text-[17px] text-text">
            Clear<span className="bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand-text)' }}>UX</span>
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
