'use client'

import { Crosshair, Layers, Zap, RotateCcw } from 'lucide-react'

/**
 * HomeTrustStrip — 4 proof points in a clean horizontal row.
 * Monochrome icons, Geist font, tight and editorial.
 */

const TRUST_ITEMS = [
  { Icon: Crosshair, value: '112', label: 'checkpoints per audit' },
  { Icon: Layers, value: '7', label: 'audit categories' },
  { Icon: Zap, value: 'Deploy', label: 'fixes directly to your site' },
  { Icon: RotateCcw, value: 'Re-audit', label: 'track what actually improved' },
]

export function HomeTrustStrip() {
  return (
    <section className="pt-16 pb-14 lg:pt-20 lg:pb-18">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {TRUST_ITEMS.map((item, i) => (
            <div
              key={item.label}
              className="flex items-center justify-center gap-4 py-4 max-sm:py-3"
              style={{
                borderRight: i < TRUST_ITEMS.length - 1 ? '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' : 'none',
              }}
            >
              {/* Icon */}
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: 'color-mix(in srgb, var(--ink) 5%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)',
                }}
              >
                <item.Icon
                  size={20}
                  strokeWidth={1.5}
                  style={{ color: 'var(--ink-2)' }}
                />
              </div>

              {/* Text */}
              <div>
                <p
                  className="font-sans font-semibold leading-none tracking-[-0.02em] mb-0.5"
                  style={{ fontSize: 'clamp(22px, 2.5vw, 28px)', color: 'var(--ink)' }}
                >
                  {item.value}
                </p>
                <p
                  className="font-sans text-[12px] leading-[1.4]"
                  style={{ color: 'var(--ink-2)' }}
                >
                  {item.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
