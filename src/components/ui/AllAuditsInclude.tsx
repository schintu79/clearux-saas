'use client'

import { CheckCircle, Globe2, Clock, Zap } from 'lucide-react'

const ITEMS = [
  { Icon: CheckCircle, title: 'Full 64-checkpoint analysis', desc: 'Every category, every checkpoint. No feature tiers or locked sections.' },
  { Icon: Globe2, title: 'Available in 6 languages', desc: 'English, Spanish, French, German, Italian, and Portuguese.' },
  { Icon: Clock, title: 'Credits never expire', desc: 'Buy once, use whenever you need. No monthly fees, no pressure.' },
  { Icon: Zap, title: 'Instant delivery', desc: 'Reports within minutes. PDF, Word, and interactive dashboard included.' },
]

interface AllAuditsIncludeProps {
  className?: string
  compact?: boolean
}

export default function AllAuditsInclude({ className = '', compact = false }: AllAuditsIncludeProps) {
  return (
    <div
      className={`rounded-2xl border border-brand/20 dark:border-brand/10 ${compact ? 'p-4 sm:p-5' : 'p-6 sm:p-8'} ${className}`}
      style={{ background: 'var(--gradient-brand-subtle)' }}
    >
      <p className={`font-heading font-semibold text-text ${compact ? 'text-base mb-4' : 'text-2xl mb-8 text-center'}`}>
        All audits include
      </p>
      <div className={`grid gap-4 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5'}`}>
        {ITEMS.map((item, i) => {
          const ItemIcon = item.Icon
          return (
            <div key={i} className={`bg-card/80 dark:bg-card rounded-xl border border-border/30 dark:border-white/[0.06] ${compact ? 'p-3.5 flex items-start gap-3' : 'p-5'}`}>
              <div className={`rounded-xl bg-brand/15 dark:bg-brand/10 flex items-center justify-center flex-shrink-0 ${compact ? 'w-8 h-8' : 'w-10 h-10 mb-3'}`}>
                <ItemIcon size={compact ? 14 : 18} className="text-brand" />
              </div>
              <div>
                <p className={`font-bold text-text ${compact ? 'text-xs mb-0.5' : 'text-sm mb-1.5'}`}>{item.title}</p>
                <p className={`text-muted leading-relaxed ${compact ? 'text-[11px]' : 'text-xs'}`}>{item.desc}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
