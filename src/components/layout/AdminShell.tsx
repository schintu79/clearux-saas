'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FileSearch,
  ShieldCheck,
  LogOut,
  ArrowLeft,
  Bell,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import ThemeToggle from '@/components/ui/ThemeToggle';

interface AdminShellProps {
  children: React.ReactNode;
}

const AdminShell: React.FC<AdminShellProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, signOut, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    const role = (profile as any)?.role;
    if (role === 'admin' || role === 'super_admin') {
      setAuthorized(true);
    } else {
      fetch('/api/admin/stats')
        .then((r) => {
          if (r.ok) setAuthorized(true);
          else {
            setAuthorized(false);
            router.push('/dashboard');
          }
        })
        .catch(() => {
          setAuthorized(false);
          router.push('/dashboard');
        });
    }
  }, [user, profile, loading, router]);

  const navItems = [
    { label: 'Overview', href: '/admin', icon: LayoutDashboard },
    { label: 'Users', href: '/admin/users', icon: Users },
    { label: 'Audits', href: '/admin/audits', icon: FileSearch },
    { label: 'Admins', href: '/admin/admins', icon: ShieldCheck },
    { label: 'Notifications', href: '/admin/notifications', icon: Bell },
  ];

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const displayName = profile?.full_name
    || user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || null;
  const initials = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '?';

  if (authorized === null) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--paper)' }}>
        <div className="animate-pulse text-sm" style={{ color: 'var(--m-muted)' }}>Loading admin panel...</div>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="flex h-screen" style={{ background: 'var(--paper)', fontFamily: 'var(--font-sans)' }}>
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
        {/* Header with Admin badge */}
        <div className="px-5 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--rule)' }}>
          <Link href="/admin" className="flex items-center gap-2.5">
            <svg width={26} height={26} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-signal block shrink-0">
              <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.5" fill="none" />
              <circle cx="16" cy="16" r="5.5" fill="currentColor" />
            </svg>
            <span className="font-sans font-bold text-[22px] leading-none tracking-[-0.025em]" style={{ color: 'var(--ink)' }}>ClearUX</span>
          </Link>
          <span className="text-[10px] font-mono uppercase tracking-[0.1em] px-2.5 py-1 rounded-full" style={{ background: 'var(--severe)', color: '#FFFFFF' }}>
            Admin
          </span>
        </div>

        {/* Back to dashboard */}
        <div className="px-4 pt-4 pb-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 w-full px-3 py-2 text-[13px] font-medium rounded-lg transition-all"
            style={{ color: 'var(--m-muted)' }}
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
            Back to dashboard
          </Link>
        </div>

        {/* Navigation */}
        <nav aria-label="Admin navigation" className="flex-1 px-3 py-3 overflow-y-auto">
          <p className="px-3 mb-2 font-mono text-[10px] tracking-[0.1em] uppercase" style={{ color: 'var(--m-muted-2)' }}>
            Administration
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
                    <Icon size={16} strokeWidth={1.5} style={{ color: active ? 'var(--signal)' : undefined }} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom section */}
        <div className="px-3 py-3 space-y-1" style={{ borderTop: '1px solid var(--rule)' }}>
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[11px] font-mono uppercase tracking-[0.06em]" style={{ color: 'var(--m-muted-2)' }}>Theme</span>
            <ThemeToggle variant="pill" />
          </div>

          {!loading && user && (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors" style={{ cursor: 'default' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
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
                  displayName ? 'text-[10px]' : 'text-[12px] font-medium'
                )} style={{ color: displayName ? 'var(--m-muted)' : 'var(--ink)' }}>
                  {user.email}
                </p>
              </div>
            </div>
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
          <span className="ml-3 flex items-center gap-2">
            <svg width={24} height={24} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-signal block shrink-0">
              <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.5" fill="none" />
              <circle cx="16" cy="16" r="5.5" fill="currentColor" />
            </svg>
            <span className="font-sans font-bold text-[20px] leading-none tracking-[-0.025em]" style={{ color: 'var(--ink)' }}>ClearUX</span>
          </span>
          <span className="ml-2 text-[10px] font-mono uppercase tracking-[0.1em] px-2.5 py-1 rounded-full" style={{ background: 'var(--severe)', color: '#FFFFFF' }}>
            Admin
          </span>
        </div>

        <main id="main-content" className="flex-1 overflow-auto">
          <div className="p-5 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default AdminShell;
