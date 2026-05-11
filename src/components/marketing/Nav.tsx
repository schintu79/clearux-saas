'use client'

import { useState } from 'react'
import { Logo } from './Logo'
import { Button } from './Button'
import { ArrowRightIcon, MoonIcon, SunIcon } from './icons'
import { useTheme } from '@/context/ThemeContext'

const NAV_LINKS = [
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Demo report', href: '/demo-report' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Contact', href: '/contact' },
]


export function Nav() {
  const { theme, toggleTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="border-b border-rule sticky top-0 z-50 backdrop-blur-md" style={{ background: 'color-mix(in srgb, var(--paper) 92%, transparent)' }}>
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <div className="flex items-center justify-between gap-6 py-7">
          <Logo />

          {/* Desktop links */}
          <ul className="hidden lg:flex gap-[38px] list-none">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <a href={link.href} className="text-ink-2 no-underline text-[15px] font-medium hover:text-signal transition-colors">
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
            <Button href="/login" variant="ghost" className="max-lg:hidden">Login</Button>
            <Button href="/register" className="max-sm:hidden">
              Start free audit
              <ArrowRightIcon />
            </Button>

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
            <div className="flex gap-3 mt-4 pt-2">
              <Button href="/login" variant="ghost" className="flex-1 justify-center">Login</Button>
              <Button href="/register" className="flex-1 justify-center">
                Start free audit
                <ArrowRightIcon />
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
