import type { ReactNode } from 'react'
import Link from 'next/link'

type Props = {
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'ghost'
  size?: 'default' | 'large'
  children: ReactNode
  className?: string
}

const sizeMap = {
  default: 'px-[22px] py-[11px] text-[14px]',
  large: 'px-[32px] py-[16px] text-[15px]',
}

export function Button({ href, onClick, variant = 'primary', size = 'default', children, className = '' }: Props) {
  const base = `inline-flex items-center gap-2 font-sans font-medium border rounded-full no-underline cursor-pointer transition-all ${sizeMap[size]}`

  const variantClasses = variant === 'primary'
    ? 'bg-ink text-paper border-ink hover:bg-signal hover:border-signal hover:text-white'
    : 'bg-transparent text-ink border-rule-2 hover:border-ink'

  const cls = `${base} ${variantClasses} ${className}`

  if (href) {
    return <Link href={href} className={cls}>{children}</Link>
  }
  return <button onClick={onClick} className={cls}>{children}</button>
}
