'use client'

import { useEffect } from 'react'

const CRISP_WEBSITE_ID = '6d644477-f059-4b4a-a212-31cce6f4498f'

export default function CrispChat() {
  useEffect(() => {
    // Avoid loading twice
    if ((window as any).$crisp) return

    ;(window as any).$crisp = []
    ;(window as any).CRISP_WEBSITE_ID = CRISP_WEBSITE_ID

    const script = document.createElement('script')
    script.src = 'https://client.crisp.chat/l.js'
    script.async = true
    document.head.appendChild(script)

    return () => {
      // Cleanup on unmount (unlikely for root layout, but good practice)
      try { document.head.removeChild(script) } catch {}
    }
  }, [])

  return null
}
