'use client'

import { Button } from './Button'
import { ArrowRightIcon } from './icons'
import { useTheme } from '@/context/ThemeContext'

/**
 * HomeCta — final CTA section.
 * Fresh headline that doesn't repeat "Find. Fix. Track." from earlier.
 * Feels like the final conversion moment, not a repeated slogan.
 */
export function HomeCta() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const fg = isDark ? 'var(--ink)' : 'var(--paper)'
  const muted = isDark ? 'var(--m-muted)' : 'color-mix(in srgb, var(--paper) 55%, transparent)'
  const divider = isDark ? 'var(--rule)' : 'color-mix(in srgb, var(--paper) 12%, transparent)'
  const accent = isDark ? 'var(--signal)' : '#A4B26A'

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: isDark ? 'var(--paper-2)' : 'var(--ink)',
        color: fg,
        padding: '100px 0',
      }}
    >
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5 relative">
        <div className="max-w-[680px] mx-auto text-center">
          <h2
            className="font-serif font-normal leading-[0.94] tracking-[-0.025em] mb-6"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)', color: fg }}
          >
            See what needs{' '}
            <em className="italic" style={{ color: accent }}>attention.</em>
          </h2>
          <p
            className="text-[18px] leading-[1.6] mb-10 font-sans max-w-[480px] mx-auto"
            style={{ color: muted }}
          >
            Your first audit is free. Severity-ranked findings, clear fix
            guidance, and a path to measurable improvement.
          </p>
          <div className="flex gap-3.5 justify-center max-sm:flex-col max-sm:items-stretch">
            <Button
              href="/register"
              size="large"
              className={isDark ? '' : '!bg-signal !border-signal !text-white hover:!opacity-90'}
            >
              Start free audit
              <ArrowRightIcon size={14} />
            </Button>
            <Button
              href="/contact"
              variant="ghost"
              size="large"
              className={isDark ? '' : '!text-white/60 !border-white/15 hover:!border-white/35 hover:!text-white/90'}
            >
              Book a demo
            </Button>
          </div>
        </div>

        {/* Micro-proof row */}
        <div
          className="mt-16 pt-6 flex justify-between font-sans text-[12px] tracking-[0.02em]"
          style={{ borderTop: `1px solid ${divider}`, color: muted }}
        >
          <span>112 checkpoints · 7 categories</span>
          <span>Free first audit · No credit card</span>
        </div>
      </div>
    </section>
  )
}
