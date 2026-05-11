'use client'

import type { ReactNode } from 'react'

/**
 * MarketingBody — wrapper for marketing pages.
 * v2 tokens are now global, so this is a minimal wrapper
 * that can be used for any marketing-specific scoping if needed.
 */
export function MarketingBody({ children }: { children: ReactNode }) {
  return <>{children}</>
}
