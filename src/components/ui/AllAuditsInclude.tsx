'use client'

import { CheckCircle, Globe2, Clock, Zap } from 'lucide-react'

const ITEMS = [
  { Icon: CheckCircle, title: '96 checkpoints' },
  { Icon: Globe2, title: '6 languages' },
  { Icon: Clock, title: 'Credits never expire' },
  { Icon: Zap, title: 'Instant delivery' },
]

interface AllAuditsIncludeProps {
  className?: string
  compact?: boolean
}

export default function AllAuditsInclude({ className = '' }: AllAuditsIncludeProps) {
  return (
    <div className={`${className}`}>
      <p
        className="text-[11px] font-mono tracking-[0.08em] uppercase mb-3"
        style={{ color: 'var(--m-muted)' }}
      >
        All audits include
      </p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {ITEMS.map((item, i) => {
          const ItemIcon = item.Icon
          return (
            <div key={i} className="flex items-center gap-1.5">
              <ItemIcon size={13} strokeWidth={1.5} style={{ color: 'var(--signal)' }} />
              <span className="text-[13px]" style={{ color: 'var(--ink)' }}>{item.title}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
