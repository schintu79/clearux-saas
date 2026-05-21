'use client'

import { Button } from './Button'
import { ArrowRightIcon } from './icons'
import { useTheme } from '@/context/ThemeContext'

export function HomeCta() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: isDark ? 'var(--paper-2)' : 'var(--ink)',
        color: isDark ? 'var(--ink)' : 'var(--paper)',
        padding: '100px 0',
      }}
    >
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5 relative">
        <div className="max-w-[680px] mx-auto text-center">
          <h2
            className="font-serif font-normal leading-[0.95] tracking-[-0.025em] mb-6"
            style={{
              fontSize: 'clamp(40px, 5.5vw, 72px)',
              color: isDark ? 'var(--ink)' : 'var(--paper)',
            }}
          >
            Find the issue. Follow the fix path.{' '}
            <em className="italic" style={{ color: isDark ? 'var(--signal)' : '#A4B26A' }}>
              Track improvement.
            </em>
          </h2>
          <p
            className="text-[18px] leading-[1.6] mb-10 font-sans"
            style={{ color: isDark ? 'var(--m-muted)' : 'color-mix(in srgb, var(--paper) 75%, transparent)' }}
          >
            Your first audit is free, no credit card required. Run 96 checkpoints across
            six modules and get your Website Health Score in under ten minutes.
          </p>
          <Button href="/register" size="large" className={isDark ? '' : '!bg-signal !border-signal !text-white hover:!opacity-90'}>
            Start free audit
            <ArrowRightIcon size={14} />
          </Button>
        </div>

        <div
          className="mt-16 pt-6 flex justify-between font-mono text-[11px] tracking-[0.08em] uppercase"
          style={{
            borderTop: isDark ? '1px solid var(--rule)' : '1px solid color-mix(in srgb, var(--paper) 12%, transparent)',
            color: isDark ? 'var(--m-muted)' : 'color-mix(in srgb, var(--paper) 45%, transparent)',
          }}
        >
          <span>96 checkpoints · 6 modules</span>
          <span>Free first audit</span>
        </div>
      </div>
    </section>
  )
}
