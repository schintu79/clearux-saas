'use client'

import React from 'react'
import Link from 'next/link'

type ActionLinkVariant = 'primary' | 'muted'

interface ActionLinkBaseProps {
  icon?: React.ElementType
  variant?: ActionLinkVariant
  children: React.ReactNode
  className?: string
}

interface ActionLinkAnchor extends ActionLinkBaseProps {
  href: string
  onClick?: never
}

interface ActionLinkButton extends ActionLinkBaseProps {
  href?: never
  onClick: () => void
}

type ActionLinkProps = ActionLinkAnchor | ActionLinkButton

const shared =
  'inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-md whitespace-nowrap transition-opacity hover:opacity-90'

const variants: Record<ActionLinkVariant, { background: string; color: string }> = {
  primary: { background: 'var(--ink)', color: 'var(--paper)' },
  muted: { background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' },
}

export default function ActionLink({
  href,
  onClick,
  icon: Icon,
  variant = 'primary',
  children,
  className = '',
}: ActionLinkProps) {
  const style = variants[variant]

  if (href) {
    return (
      <Link href={href} className={`${shared} ${className}`} style={style}>
        {Icon && <Icon size={13} />}
        {children}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={`${shared} ${className}`} style={style}>
      {Icon && <Icon size={13} />}
      {children}
    </button>
  )
}
