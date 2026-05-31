'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SectionMarker } from '@/components/marketing/SectionMarker'
import { ArrowRightIcon } from '@/components/marketing/icons'

/* ── Types ── */
export type FaqItem = { q: string; a: string }

/* ── Chevron Icon ── */
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
      <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ── Accordion Item ── */
function AccordionItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderBottom: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)' }} className="last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 py-5 px-1 text-left hover:text-signal transition-colors group"
        aria-expanded={isOpen}
      >
        <span className="flex-1 font-sans font-medium text-ink text-[15px] leading-relaxed group-hover:text-signal transition-colors">{q}</span>
        <ChevronIcon open={isOpen} />
      </button>
      {isOpen && (
        <div className="pb-5 px-1">
          <p className="font-sans text-[14px] text-ink-2 leading-[1.75]">{a}</p>
        </div>
      )}
    </div>
  )
}

/* ── FaqPreview Section ── */
export function FaqPreview({
  sectionNumber,
  items,
}: {
  sectionNumber: string
  items: FaqItem[]
}) {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set())

  const toggleItem = (index: number) => {
    setOpenItems(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  return (
    <section className="py-[80px] border-b border-rule max-sm:py-14">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <SectionMarker number={sectionNumber} label="FAQ" centered />
        <h2
          className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-12 text-center"
          style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
        >
          Common <em className="italic text-signal">questions.</em>
        </h2>

        <div className="max-w-2xl mx-auto">
          <div style={{ borderTop: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)' }}>
            {items.map((item, i) => (
              <AccordionItem
                key={i}
                q={item.q}
                a={item.a}
                isOpen={openItems.has(i)}
                onToggle={() => toggleItem(i)}
              />
            ))}
          </div>

          <div className="text-center mt-10">
            <Link
              href="/faq"
              className="inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.08em] uppercase text-signal hover:text-ink transition-colors group"
            >
              Read all FAQs
              <ArrowRightIcon className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
