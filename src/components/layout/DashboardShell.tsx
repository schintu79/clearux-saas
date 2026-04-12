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

  // Fetch credits on mount + re-fetch when tab regains focus (e.g. returning from Stripe)
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
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'My Audits', href: '/dashboard/audits', icon: FileSearch },
    { label: 'New Audit', href: '/dashboard/new-audit', icon: PlusCircle },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const handleSignOut = () => {
    signOut(); // signOut() does window.location.replace('/')
  };

  return (
    <div className="flex h-screen bg-surface-alt">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed md:static inset-y-0 left-0 w-52 bg-sidebar text-sidebar-text flex flex-col z-50 transition-transform duration-200 transform md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="px-4 py-4 border-b border-white/10">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="font-inter font-bold text-xl text-white">
              Clear<span className="bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand-text)' }}>UX</span>
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-2 overflow-y-auto">
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
                      'flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-xs',
                      active
                        ? 'bg-white/10 text-white'
                        : 'text-sidebar-text/60 hover:text-sidebar-text hover:bg-white/5'
                    )}
                  >
                    <Icon size={15} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Credit balance */}
        {credits !== null && (
          <div className="px-3 py-3 border-t border-white/10">
            <div className="bg-white/5 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Coins size={14} className="text-emerald-400" />
                  <span className="text-xs font-semibold text-sidebar-text">Credits</span>
                </div>
                <span className="text-lg font-bold text-emerald-400">{credits}</span>
              </div>
              <p className="text-[10px] text-sidebar-text/40 mb-2">
                {credits === 0
                  ? 'No credits remaining'
                  : `${credits} audit${credits !== 1 ? 's' : ''} remaining`}
              </p>
              <Link
                href="/dashboard/buy-credits"
                className="block text-center text-[11px] font-semibold text-white rounded-md py-1.5 transition-all hover:brightness-110"
                style={{ background: 'var(--gradient-brand)' }}
              >
                {credits === 0 ? 'Buy Credits' : 'Buy More'}
              </Link>
            </div>
          </div>
        )}

        {/* Bottom section */}
        <div className="px-2 py-2 border-t border-white/10 space-y-1">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[10px] text-sidebar-text/40 uppercase tracking-wider">
              Theme
            </span>
            <ThemeToggle variant="pill" />
          </div>

          {!loading && user && (() => {
            const displayName = profile?.full_name
              || user.user_metadata?.full_name
              || user.user_metadata?.name
              || null;
            return (
              <div className="px-3 py-2 bg-white/5 rounded-md">
                {displayName && (
                  <p className="text-xs font-medium text-sidebar-text truncate">
                    {displayName}
                  </p>
                )}
                <p className={`text-sidebar-text truncate ${displayName ? 'text-[10px] text-sidebar-text/40' : 'text-xs font-medium'}`}>
                  {user.email}
                </p>
              </div>
            );
          })()}

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-sidebar-text/60 hover:text-sidebar-text hover:bg-white/5 transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden h-12 bg-surface border-b border-border flex items-center px-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md hover:bg-off transition-colors"
          >
            {sidebarOpen ? (
              <X size={20} className="text-text" />
            ) : (
              <Menu size={20} className="text-text" />
            )}
          </button>
          <span className="ml-3 font-inter font-bold text-xl text-text">
            Clear<span className="bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand-text)' }}>UX</span>
          </span>
        </div>

        {/* Content area */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-5 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default DashboardShell;
