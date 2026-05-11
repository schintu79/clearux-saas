'use client'

import { useEffect, type ReactNode } from 'react'

export function MarketingBody({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.classList.add('marketing-v2')
    return () => {
      document.body.classList.remove('marketing-v2')
    }
  }, [])

  return <>{children}</>
}
