'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Settings, LogOut, LayoutDashboard, Coins } from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { useAuth } from '@/context/AuthContext';

function UserAvatar({ name, email }: { name?: string | null; email?: string }) {
  const initials = name
    ? name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : email ? email[0].toUpperCase() : '?';

  return (
    <div className="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-medium select-none" style={{ background: 'var(--gradient-brand)' }}>
      {initials}
    </div>
  );
}

const Navbar: React.FC = () => {
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch credits on mount + re-fetch when tab regains focus (e.g. returning from Stripe)
  useEffect(() => {
    if (loading || !user) return;
    const load = () =>
      fetch('/api/credits')
        .then((r) => r.json())
        .then((d) => setCredits(d.credits ?? 0))
        .catch(() => {});
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loading, user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut(); // signOut() does window.location.replace('/') — hard redirect
  };

  const navLinks = [
    { label: 'Features', href: '/#features' },
    { label: 'Pricing', href: '/#pricing' },
    { label: 'About', href: '/about' },
    { label: 'FAQ', href: '/#faq' },
    { label: 'Contact', href: '/contact' },
  ];

  const isLoggedIn = !loading && !!user;

  return (
    <>
    {/* Skip navigation link for keyboard / screen-reader users */}
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-white focus:text-violet-700 focus:shadow-lg focus:text-sm focus:font-semibold"
    >
      Skip to main content
    </a>
    <nav aria-label="Main navigation" className="sticky top-0 z-50 bg-surface/90 backdrop-blur-xl border-b border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            <span className="font-inter font-semibold text-2xl text-text">
              Clear<span className="bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand-text)' }}>UX</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-text/70 hover:text-text transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle variant="pill" />

            {isLoggedIn ? (
              /* ── Logged-in: credit badge + avatar dropdown ── */
              <>
              {credits !== null && (
                <Link
                  href="/dashboard/buy-credits"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors"
                >
                  <Coins size={13} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{credits}</span>
                </Link>
              )}

              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-expanded={menuOpen}
                  aria-haspopup="true"
                  className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-off transition-colors"
                >
                  <UserAvatar name={profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name} email={user?.email} />
                  <span className="text-sm text-text font-medium max-w-[120px] truncate">
                    {(profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name)?.split(' ')[0] || user?.email?.split('@')[0]}
                  </span>
                </button>

                {menuOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-48 bg-card border border-border/60 rounded-xl shadow-xl shadow-black/8 py-1.5 z-50">
                    <Link
                      href="/dashboard"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-off transition-colors"
                    >
                      <LayoutDashboard size={15} className="text-muted" />
                      Dashboard
                    </Link>
                    <Link
                      href="/dashboard/settings"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-off transition-colors"
                    >
                      <Settings size={15} className="text-muted" />
                      Settings
                    </Link>
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={handleSignOut}
                      role="menuitem"
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-off transition-colors"
                    >
                      <LogOut size={15} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
              </>
            ) : (
              /* ── Not logged in: login + CTA ── */
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-text hover:bg-off rounded-md px-3 py-1.5 transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="text-sm font-medium text-white rounded-full px-5 py-1.5 transition-all hover:shadow-lg hover:-translate-y-0.5"
                  style={{ background: 'var(--gradient-brand)', boxShadow: '0 4px 12px rgba(124,58,237,.15), 0 2px 6px rgba(236,72,153,.08)' }}
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle variant="icon" />
            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isOpen}
              className="relative w-[44px] h-[44px] rounded-md hover:bg-off transition-colors flex items-center justify-center"
            >
              {/* Animated 2-line → X toggle */}
              <div className="w-5 h-3.5 flex flex-col justify-between">
                <span
                  className="block h-[2px] w-full bg-text rounded-full transition-all duration-300 origin-center"
                  style={isOpen ? { transform: 'translateY(5px) rotate(45deg)' } : {}}
                />
                <span
                  className="block h-[2px] w-full bg-text rounded-full transition-all duration-300 origin-center"
                  style={isOpen ? { transform: 'translateY(-5px) rotate(-45deg)' } : {}}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden pb-4 border-t border-border">
            <div className="flex flex-col gap-1 pt-3">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-sm text-muted hover:text-text transition-colors px-3 py-3 min-h-[44px] flex items-center"
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex flex-col gap-1 pt-3 border-t border-border mt-2">
                {isLoggedIn ? (
                  <>
                    <Link href="/dashboard" onClick={() => setIsOpen(false)} className="text-sm font-medium text-text px-3 py-3 min-h-[44px] flex items-center">
                      Dashboard
                    </Link>
                    <button onClick={handleSignOut} className="text-sm text-red-600 dark:text-red-400 px-3 py-3 min-h-[44px] text-left">
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setIsOpen(false)} className="text-sm font-medium text-text px-3 py-3 min-h-[44px] flex items-center">
                      Login
                    </Link>
                    <Link href="/register" onClick={() => setIsOpen(false)} className="text-sm font-medium text-white rounded-lg px-4 py-3 text-center min-h-[44px] flex items-center justify-center mt-1" style={{ background: 'var(--gradient-brand)' }}>
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
    </>
  );
};

export default Navbar;
