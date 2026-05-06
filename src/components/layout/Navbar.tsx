'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Settings, LogOut, LayoutDashboard, Coins, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

function UserAvatar({ name, email }: { name?: string | null; email?: string }) {
  const initials = name
    ? name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : email ? email[0].toUpperCase() : '?';

  return (
    <div className="w-7 h-7 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-medium select-none">
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
    { label: 'How It Works', href: '/how-it-works' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'FAQ', href: '/faq' },
    { label: 'Contact', href: '/contact' },
  ];

  const isLoggedIn = !loading && !!user;

  return (
    <>
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-white focus:text-[#111114] focus:shadow-lg focus:text-sm focus:font-semibold"
    >
      Skip to main content
    </a>
    <nav aria-label="Main navigation" className="sticky top-0 z-50 bg-[#111114]/95 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0 flex items-center gap-1" aria-label="ClearUX home">
            <span className="font-heading text-2xl font-bold tracking-tight text-white">ClearUX</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-7">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[15px] font-medium text-white/50 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-2">
            {isLoggedIn ? (
              <>
              {credits !== null && (
                <Link
                  href="/dashboard/buy-credits"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.10] transition-colors"
                >
                  <Coins size={13} className="text-white/50" />
                  <span className="text-xs font-bold text-white/70">{credits}</span>
                </Link>
              )}

              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-expanded={menuOpen}
                  aria-haspopup="true"
                  className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/[0.04] transition-colors"
                >
                  <UserAvatar name={profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name} email={user?.email} />
                  <span className="text-sm text-white/70 font-medium max-w-[120px] truncate">
                    {(profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name)?.split(' ')[0] || user?.email?.split('@')[0]}
                  </span>
                </button>

                {menuOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-48 bg-[#18181C] border border-white/[0.08] rounded-xl shadow-xl shadow-black/20 py-1.5 z-50">
                    <Link
                      href="/dashboard"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:bg-white/[0.04] transition-colors"
                    >
                      <LayoutDashboard size={15} className="text-white/30" />
                      Dashboard
                    </Link>
                    <Link
                      href="/dashboard/settings"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:bg-white/[0.04] transition-colors"
                    >
                      <Settings size={15} className="text-white/30" />
                      Settings
                    </Link>
                    <div className="border-t border-white/[0.06] my-1" />
                    <button
                      onClick={handleSignOut}
                      role="menuitem"
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-white/[0.04] transition-colors"
                    >
                      <LogOut size={15} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-[15px] font-medium text-white/50 hover:text-white rounded-lg px-3 py-1.5 transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="text-[15px] font-semibold text-[#111114] bg-white hover:bg-white/90 rounded-xl px-5 py-2.5 min-h-[44px] transition-all hover:-translate-y-0.5 flex items-center gap-1.5"
                >
                  Start Free Audit
                  <ArrowUpRight size={14} />
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isOpen}
              className="relative w-[44px] h-[44px] rounded-lg hover:bg-white/[0.04] transition-colors flex items-center justify-center"
            >
              <div className="w-5 h-3.5 flex flex-col justify-between">
                <span
                  className="block h-[2px] w-full bg-white rounded-full transition-all duration-300 origin-center"
                  style={isOpen ? { transform: 'translateY(5px) rotate(45deg)' } : {}}
                />
                <span
                  className="block h-[2px] w-full bg-white rounded-full transition-all duration-300 origin-center"
                  style={isOpen ? { transform: 'translateY(-5px) rotate(-45deg)' } : {}}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden pb-4 border-t border-white/[0.06]">
            <div className="flex flex-col gap-1 pt-3">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-[17px] text-white/40 hover:text-white transition-colors px-3 py-3 min-h-[44px] flex items-center"
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex flex-col gap-1 pt-3 border-t border-white/[0.06] mt-2">
                {isLoggedIn ? (
                  <>
                    <Link href="/dashboard" onClick={() => setIsOpen(false)} className="text-sm font-medium text-white px-3 py-3 min-h-[44px] flex items-center">
                      Dashboard
                    </Link>
                    <button onClick={handleSignOut} className="text-sm text-red-400 px-3 py-3 min-h-[44px] text-left">
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setIsOpen(false)} className="text-[17px] text-white/40 hover:text-white transition-colors px-3 py-3 min-h-[44px] flex items-center">
                      Login
                    </Link>
                    <Link href="/register" onClick={() => setIsOpen(false)} className="text-[15px] font-semibold text-[#111114] bg-white rounded-xl px-6 py-3 text-center min-h-[48px] flex items-center justify-center mt-1">
                      Start Free Audit
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
