'use client'

import React from 'react'

interface PageHeaderProps {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children?: React.ReactNode // right-side actions
}

export default function PageHeader({ icon, title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-start gap-3 min-w-0">
        <div
          className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg mt-0.5"
          style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h1
            className="text-[22px] font-sans font-semibold tracking-[-0.01em]"
            style={{ color: 'var(--ink)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children && <div className="flex items-center gap-2 flex-shrink-0">{children}</div>}
    </div>
  )
}
