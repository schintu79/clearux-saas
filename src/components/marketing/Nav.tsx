'use client'

import { useState, useRef, useEffect } from 'react'
import { Logo } from './Logo'
import { Button } from './Button'
import { ArrowRightIcon, MoonIcon, SunIcon, ChevronDownIcon, UserIcon, LayoutDashboardIcon, LogOutIcon } from './icons'
import { useTheme } from '@/context/ThemeContext'
import { useAuth } from '@/context/AuthContext'

const NAV_LINKS = [
  { label: 'Product', href: '/product' },
  { label: 'Why Fixpath', href: '/why-fixpath' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Resources', href: '/resources' },
]

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Nav() {
  const { theme, toggleTheme } = useTheme()
  const { user, profile, loading: authLoading, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isLoggedIn = !authLoading && !!user
  const fullName = profile?.full_name || ''
  const firstName = fullName.split(' ')[0] || ''
  const initials = getInitials(fullName)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  return (
    <>
      {/* Skip link — first focusable element; visible only on keyboard focus.
          Targets the <main id="main-content"> present on every marketing page. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-3 focus:left-3 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-ink focus:text-paper focus:text-[14px] focus:font-medium"
      >
        Skip to main content
      </a>
    <nav aria-label="Primary" className="border-b border-rule sticky top-0 z-50 backdrop-blur-md" style={{ background: 'color-mix(in srgb, var(--paper) 92%, transparent)' }}>
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <div className="flex items-center justify-between gap-6 py-5 max-sm:py-3">
          <Logo height={64} className="max-sm:h-[48px] max-sm:w-auto" />

          {/* Desktop links — min 44px tap height (WCAG 2.5.5) via inline-flex + py */}
          <ul className="hidden lg:flex gap-[38px] list-none">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <a href={link.href} className="inline-flex items-center min-h-[44px] text-ink-2 no-underline text-[15px] font-medium hover:text-signal transition-colors">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex gap-3 items-center">
            <button
              onClick={toggleTheme}
              className="w-[38px] h-[38px] bg-transparent rounded-full inline-flex items-center justify-center text-ink hover:bg-paper-2 hover:text-signal transition-all shrink-0"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>

            {isLoggedIn ? (
              /* Logged-in: initials avatar + name + dropdown */
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(prev => !prev)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-full hover:bg-paper-2 transition-colors cursor-pointer"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                >
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-mono font-semibold tracking-[0.02em] shrink-0"
                    style={{ background: 'var(--ink)', color: 'var(--paper)' }}
                  >
                    {initials}
                  </span>
                  <span className="text-[14px] font-sans font-medium text-ink max-sm:hidden">
                    {firstName}
                  </span>
                  <ChevronDownIcon
                    size={12}
                    className={`text-m-muted transition-transform duration-200 max-sm:hidden ${dropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Dropdown menu */}
                {dropdownOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-[200px] rounded-lg overflow-hidden shadow-lg"
                    style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}
                  >
                    <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--rule)' }}>
                      <p className="text-[13px] font-sans font-medium text-ink truncate">{fullName || 'Account'}</p>
                      <p className="text-[11px] font-mono text-m-muted truncate mt-0.5">{user?.email}</p>
                    </div>
                    <div className="py-1">
                      <a
                        href="/dashboard/settings"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-sans font-medium text-ink hover:bg-paper-2 transition-colors no-underline"
                      >
                        <UserIcon size={15} className="text-m-muted" />
                        My account
                      </a>
                      <a
                        href="/dashboard"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-sans font-medium text-ink hover:bg-paper-2 transition-colors no-underline"
                      >
                        <LayoutDashboardIcon size={15} className="text-m-muted" />
                        Dashboard
                      </a>
                    </div>
                    <div style={{ borderTop: '1px solid var(--rule)' }}>
                      <button
                        onClick={() => { setDropdownOpen(false); signOut() }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-[13px] font-sans font-medium text-ink hover:bg-paper-2 transition-colors cursor-pointer bg-transparent"
                        style={{ border: 'none' }}
                      >
                        <LogOutIcon size={15} className="text-m-muted" />
                        Log out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Logged-out: show login + register */
              <>
                <Button href="/login" variant="ghost" className="max-lg:hidden">Sign in</Button>
                <Button href="/register" className="max-sm:hidden">
                  Start free audit
                  <ArrowRightIcon />
                </Button>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(prev => !prev)}
              className="lg:hidden w-[44px] h-[44px] rounded-lg hover:bg-paper-2 transition-colors inline-flex items-center justify-center shrink-0"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              <div className="w-5 h-3.5 flex flex-col justify-between">
                <span
                  className="block h-[2px] w-full bg-ink rounded-full transition-all duration-300 origin-center"
                  style={mobileOpen ? { transform: 'translateY(5px) rotate(45deg)' } : {}}
                />
                <span
                  className="block h-[2px] w-full bg-ink rounded-full transition-all duration-300 origin-center"
                  style={mobileOpen ? { transform: 'translateY(-5px) rotate(-45deg)' } : {}}
                />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-rule">
          <div className="max-w-mkt mx-auto px-8 max-sm:px-5 py-6 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block py-3 text-[16px] font-sans font-medium text-ink hover:text-signal transition-colors no-underline border-b border-rule last:border-b-0"
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-1 mt-4 pt-2 border-t border-rule">
              {isLoggedIn ? (
                <>
                  <a href="/dashboard/settings" onClick={() => setMobileOpen(false)} className="block py-3 text-[16px] font-sans font-medium text-ink hover:text-signal transition-colors no-underline">My account</a>
                  <a href="/dashboard" onClick={() => setMobileOpen(false)} className="block py-3 text-[16px] font-sans font-medium text-ink hover:text-signal transition-colors no-underline">Dashboard</a>
                  <button onClick={() => { setMobileOpen(false); signOut() }} className="block py-3 text-[16px] font-sans font-medium text-ink hover:text-signal transition-colors cursor-pointer bg-transparent border-0 text-left w-full px-0">Log out</button>
                </>
              ) : (
                <div className="flex gap-3">
                  <Button href="/login" variant="ghost" className="flex-1 justify-center">Sign in</Button>
                  <Button href="/register" className="flex-1 justify-center">
                    Start free audit
                    <ArrowRightIcon />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
    </>
  )
}
