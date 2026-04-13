'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FileSearch,
  ShieldCheck,
  Menu,
  X,
  LogOut,
  ArrowLeft,
  ChevronRight,
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

  // Check admin role client-side (API routes also check server-side)
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
      // Fallback: check via API in case profile doesn't have role yet
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
  ];

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname === href || pathname.startsWith(href + '/');
  };

  // User initials
  const displayName = profile?.full_name
    || user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || null;
  const initials = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '?';

  if (authorized === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-alt">
        <div className="animate-pulse text-muted text-sm">Loading admin panel...</div>
      </div>
    );
  }

  if (!authorized) return null;

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
        {/* Header with Admin badge */}
        <div className="h-14 px-5 flex items-center justify-between border-b border-border">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="font-manrope font-bold text-[17px] text-text">
              Clear<span className="bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand-text)' }}>UX</span>
            </span>
          </Link>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
            Admin
          </span>
        </div>

        {/* Back to dashboard */}
        <div className="px-3 pt-3 pb-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 w-full px-3 py-2 text-[13px] font-medium text-muted hover:text-text rounded-lg hover:bg-surface-alt transition-all"
          >
            <ArrowLeft size={14} strokeWidth={2} />
            Back to Dashboard
          </Link>
        </div>

        {/* Navigation */}
        <nav aria-label="Admin navigation" className="flex-1 px-3 py-2 overflow-y-auto">
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

        {/* Bottom section */}
        <div className="px-3 py-3 border-t border-border space-y-1">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[11px] text-muted font-medium">Theme</span>
            <ThemeToggle variant="pill" />
          </div>

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

          <button
            onClick={() => signOut()}
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
          <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
            Admin
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

export default AdminShell;
