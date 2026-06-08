'use client'

import { ShieldCheck, Layers, ScanSearch, BarChart3 } from 'lucide-react'

/**
 * HomeTrustStrip — 4 proof points in a clean horizontal row.
 * Monochrome icons, Geist font, tight and editorial.
 *
 * Mobile: 2×2 grid, left-aligned, no separators.
 * Desktop: 4-across horizontal strip with column dividers.
 */

const TRUST_ITEMS = [
  { Icon: ShieldCheck, value: '112', label: 'verified checks per audit' },
  { Icon: Layers, value: '7', label: 'evidence-scored categories' },
  { Icon: ScanSearch, value: '3-tier', label: 'confidence on every finding' },
  { Icon: BarChart3, value: 'Full', label: 'coverage and confidence visible' },
]

export function HomeTrustStrip() {
  return (
    <section className="pt-10 pb-8 lg:pt-20 lg:pb-18">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">

        {/* ── Desktop: 4-col row with dividers ───────── */}
        <div className="hidden lg:grid grid-cols-4">
          {TRUST_ITEMS.map((item, i) => (
            <div
              key={item.label}
              className="flex items-center justify-center gap-4 py-4"
              style={{
                borderRight: i < 3 ? '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' : 'none',
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: 'color-mix(in srgb, var(--ink) 5%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)',
                }}
              >
                <item.Icon size={20} strokeWidth={1.5} style={{ color: 'var(--ink-2)' }} />
              </div>
              <div>
                <p
                  className="font-sans font-semibold leading-none tracking-[-0.02em] mb-0.5"
                  style={{ fontSize: 'clamp(18px, 2.5vw, 28px)', color: 'var(--ink)' }}
                >
                  {item.value}
                </p>
                <p className="font-sans text-[12px] leading-[1.4]" style={{ color: 'var(--ink-2)' }}>
                  {item.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Mobile: 2×2 grid, left-aligned, no lines ── */}
        <div className="lg:hidden grid grid-cols-2 gap-y-1">
          {TRUST_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center gap-3 py-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: 'color-mix(in srgb, var(--ink) 5%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)',
                }}
              >
                <item.Icon size={16} strokeWidth={1.5} style={{ color: 'var(--ink-2)' }} />
              </div>
              <div>
                <p
                  className="font-sans font-semibold leading-none tracking-[-0.02em] mb-0.5"
                  style={{ fontSize: '18px', color: 'var(--ink)' }}
                >
                  {item.value}
                </p>
                <p className="font-sans text-[11px] leading-[1.4]" style={{ color: 'var(--ink-2)' }}>
                  {item.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Trust support line */}
        <p className="font-sans text-[13px] leading-[1.5] text-center mt-6 max-sm:mt-4" style={{ color: 'var(--m-muted)' }}>
          Every audit separates what was verified, what was observed, and what still relies on judgment.
        </p>
      </div>
    </section>
  )
}
