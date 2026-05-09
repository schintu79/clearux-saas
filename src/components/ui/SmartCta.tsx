'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

// ============================================================
// SmartCta — Auth-aware call-to-action button
// Shows contextual text/link based on user state:
//   - Logged out → "Start free audit" → /register
//   - Logged in, no audits yet → "Start free audit" → /dashboard/new-audit
//   - Logged in, has audits → "Start an audit" → /dashboard/new-audit
// ============================================================

interface SmartCtaProps {
  className?: string
  iconSize?: number
  /** Override default label for logged-out state */
  loggedOutLabel?: string
  /** Override default label for returning users */
  returningLabel?: string
  /** Pass a pending URL to forward through registration */
  pendingUrl?: string
  /** Hide the arrow icon */
  hideArrow?: boolean
  /** Extra children after the label (e.g. custom icon) */
  children?: React.ReactNode
}

export default function SmartCta({
  className = 'group inline-flex items-center justify-center gap-2.5 px-7 py-[1.2rem] rounded-full bg-[#0F0F0F] text-white dark:bg-white dark:text-[#111114] text-base font-medium transition-all hover:opacity-90 whitespace-nowrap min-h-[48px]',
  iconSize = 16,
  loggedOutLabel = 'Start free audit',
  returningLabel = 'Start an audit',
  pendingUrl,
  hideArrow = false,
  children,
}: SmartCtaProps) {
  const { user, profile, loading } = useAuth()

  const isLoggedIn = !!user && !loading
  const hasAudited = isLoggedIn && profile && profile.audit_count > 0

  const label = hasAudited ? returningLabel : loggedOutLabel
  const href = isLoggedIn
    ? '/dashboard/new-audit'
    : pendingUrl
      ? `/register?url=${encodeURIComponent(pendingUrl)}`
      : '/register'

  return (
    <Link href={href} className={className}>
      {label}
      {children}
      {!hideArrow && (
        <ArrowRight size={iconSize} className="group-hover:translate-x-0.5 transition-transform" />
      )}
    </Link>
  )
}
