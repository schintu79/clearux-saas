'use client'

import React from 'react'

interface SectionHeaderProps {
  title: string
  children?: React.ReactNode // right-side action (link, button, etc.)
}

export default function SectionHeader({ title, children }: SectionHeaderProps) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
        {title}
      </h2>
      {children && (
        <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--m-muted)' }}>
          {children}
        </div>
      )}
    </div>
  )
}
