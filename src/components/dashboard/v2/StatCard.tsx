'use client'

import React from 'react'
import DashCard from './DashCard'

type StatTone = 'ink' | 'ok' | 'warn' | 'severe' | 'muted'

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: string
  tone?: StatTone
  hint?: string
}

const toneColors: Record<StatTone, string> = {
  ink: 'var(--ink)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  severe: 'var(--severe)',
  muted: 'var(--m-muted)',
}

export default function StatCard({
  icon: Icon,
  label,
  value,
  tone = 'ink',
  hint,
}: StatCardProps) {
  return (
    <DashCard>
      <div className="flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--m-muted)' }}>
        <Icon size={12} strokeWidth={1.75} />
        <span className="text-[11px] uppercase tracking-wide font-medium">{label}</span>
      </div>
      <p
        className="text-[28px] font-semibold tabular-nums leading-none"
        style={{ color: toneColors[tone] }}
      >
        {value}
      </p>
      {hint && (
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--m-muted)' }}>
          {hint}
        </p>
      )}
    </DashCard>
  )
}
