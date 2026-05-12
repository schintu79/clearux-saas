'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Settings, LogOut, LayoutDashboard, ArrowUpRight, ChevronDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/marketing/Logo';
import ThemeToggle from '@/components/ui/ThemeToggle';

function UserAvatar({ name, email }: { name?: string | null; email?: string }) {
  const initials = name
    ? name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : email ? email[0].toUpperCase() : '?';

  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium select-none" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
      {initials}
    </div>
  );
}

const Navbar: React.FC = () => {
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    await signOut();
  };

  const navLinks = [
    { label: 'How it works', href: '/how-it-works' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Demo report', href: '/demo-report' },
    { label: 'FAQ', href: '/faq' },
    { label: 'Contact', href: '/contact' },
  ];

  const isLoggedIn = !loading && !!user;

  return (
    <>
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-white focus:text-paper focus:shadow-lg focus:text-sm focus:font-medium"
    >
      Skip to main content
    </a>
    <nav aria-label="Main navigation" className="sticky top-0 z-50 nav-bg backdrop-blur-xl border-b border-rule">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="flex justify-between items-center h-[84px]">
          {/* Logo */}
          <Logo size={28} />

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-7">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[15px] font-medium text-m-muted hover:text-ink transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle variant="icon" />

            {isLoggedIn ? (
              <>
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-expanded={menuOpen}
                  aria-haspopup="true"
                  className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-paper-2 transition-colors"
                >
                  <UserAvatar name={profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name} email={user?.email} />
                  <span className="text-sm text-ink font-medium max-w-[120px] truncate">
                    {(profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name)?.split(' ')[0] || user?.email?.split('@')[0]}
                  </span>
                  <ChevronDown size={14} className="text-m-muted" />
                </button>

                {menuOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-48 bg-paper border border-rule rounded-xl shadow-xl shadow-black/10 py-1.5 z-50">
                    <Link
                      href="/dashboard"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-paper-2 transition-colors"
                    >
                      <LayoutDashboard size={15} className="text-m-muted" />
                      Dashboard
                    </Link>
                    <Link
                      href="/dashboard/settings"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-paper-2 transition-colors"
                    >
                      <Settings size={15} className="text-m-muted" />
                      Settings
                    </Link>
                    <div className="border-t border-rule my-1" />
                    <button
                      onClick={handleSignOut}
                      role="menuitem"
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-paper-2 transition-colors"
                    >
                      <LogOut size={15} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
              </>
            ) : !loading ? (
              <>
                <Link
                  href="/login"
                  className="text-[15px] font-medium text-m-muted hover:text-ink rounded-full px-3 py-1.5 transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="text-xs font-medium text-paper bg-signal hover:opacity-90 rounded-full px-5 py-2.5 transition-all hover:-translate-y-0.5 flex items-center gap-1.5"
                >
                  Start free audit
                  <ArrowUpRight size={14} />
                </Link>
              </>
            ) : null}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-1">
            <ThemeToggle variant="icon" />
            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isOpen}
              className="relative w-[44px] h-[44px] rounded-lg hover:bg-paper-2 transition-colors flex items-center justify-center"
            >
              <div className="w-5 h-3.5 flex flex-col justify-between">
                <span
                  className="block h-[2px] w-full bg-ink rounded-full transition-all duration-300 origin-center"
                  style={isOpen ? { transform: 'translateY(5px) rotate(45deg)' } : {}}
                />
                <span
                  className="block h-[2px] w-full bg-ink rounded-full transition-all duration-300 origin-center"
                  style={isOpen ? { transform: 'translateY(-5px) rotate(-45deg)' } : {}}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden pb-4 border-t border-rule">
            <div className="flex flex-col gap-1 pt-3">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-[17px] text-m-muted hover:text-ink transition-colors px-3 py-[1.2rem] min-h-[44px] flex items-center"
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex flex-col gap-1 pt-3 border-t border-rule mt-2">
                {isLoggedIn ? (
                  <>
                    <Link href="/dashboard" onClick={() => setIsOpen(false)} className="text-sm font-medium text-ink px-3 py-[1.2rem] min-h-[44px] flex items-center">
                      Dashboard
                    </Link>
                    <button onClick={handleSignOut} className="text-sm text-red-400 px-3 py-[1.2rem] min-h-[44px] text-left">
                      Sign out
                    </button>
                  </>
                ) : !loading ? (
                  <>
                    <Link href="/login" onClick={() => setIsOpen(false)} className="text-[17px] text-m-muted hover:text-ink transition-colors px-3 py-[1.2rem] min-h-[44px] flex items-center">
                      Login
                    </Link>
                    <Link href="/register" onClick={() => setIsOpen(false)} className="text-sm font-medium text-paper bg-signal rounded-full px-7 py-[1.2rem] text-center min-h-[48px] flex items-center justify-center mt-1">
                      Start free audit
                    </Link>
                  </>
                ) : null}
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
