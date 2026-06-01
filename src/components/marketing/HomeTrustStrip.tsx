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
          {TRUST_ITEMS.map((item, i) => {
            /* 2-col: only left-column items (even) get right border
               4-col: all except last get right border
               Compromise: even items always get border-right — on 4-col this
               creates a paired visual (0|1  2|3) which is acceptable. */
            const showBorder = i % 2 === 0
            return (
              <div
                key={item.label}
                className="flex items-center justify-center gap-3 lg:gap-4 py-4 max-sm:py-3"
                style={{
                  borderRight: showBorder ? '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' : 'none',
                }}
              >
                {/* Icon */}
                <div
                  className="w-9 h-9 lg:w-11 lg:h-11 rounded-lg lg:rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: 'color-mix(in srgb, var(--ink) 5%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)',
                  }}
                >
                  <item.Icon
                    size={16}
                    strokeWidth={1.5}
                    className="lg:!w-5 lg:!h-5"
                    style={{ color: 'var(--ink-2)' }}
                  />
                </div>

                {/* Text */}
                <div>
                  <p
                    className="font-sans font-semibold leading-none tracking-[-0.02em] mb-0.5"
                    style={{ fontSize: 'clamp(18px, 2.5vw, 28px)', color: 'var(--ink)' }}
                  >
                    {item.value}
                  </p>
                  <p
                    className="font-sans text-[11px] lg:text-[12px] leading-[1.4]"
                    style={{ color: 'var(--ink-2)' }}
                  >
                    {item.label}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
