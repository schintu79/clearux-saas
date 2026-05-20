'use client'

import React from 'react'

type DashCardPadding = 'none' | 'sm' | 'md' | 'lg'

interface DashCardProps {
  children?: React.ReactNode
  padding?: DashCardPadding
  hover?: boolean
  dashed?: boolean
  className?: string
  onClick?: () => void
  style?: React.CSSProperties
}

const paddingMap: Record<DashCardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
}

export default function DashCard({
  children,
  padding = 'md',
  hover = false,
  dashed = false,
  className = '',
  onClick,
  style,
}: DashCardProps) {
  const base = `rounded-xl transition-all duration-200 ${paddingMap[padding]} ${className}`
  const hoverClass = hover
    ? 'cursor-pointer hover:shadow-sm hover:-translate-y-0.5'
    : ''

  return (
    <div
      className={`${base} ${hoverClass}`.trim()}
      onClick={onClick}
      style={{
        background: hover ? undefined : 'var(--card)',
        border: `1px ${dashed ? 'dashed' : 'solid'} var(--rule)`,
        ...style,
      }}
      // For hover cards, apply background via onMouseEnter/Leave or CSS
      {...(hover
        ? {
            onMouseEnter: (e) => {
              ;(e.currentTarget as HTMLDivElement).style.background = 'var(--card-hover)'
            },
            onMouseLeave: (e) => {
              ;(e.currentTarget as HTMLDivElement).style.background = 'var(--card)'
            },
            ref: (el) => {
              if (el) el.style.background = 'var(--card)'
            },
          }
        : {})}
    >
      {children}
    </div>
  )
}
