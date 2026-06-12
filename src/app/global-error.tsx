'use client'

// Root-level error boundary (Plan §0.5). Catches React render crashes
// that would otherwise white-screen the dashboard with no trace —
// reports to Sentry and gives the user a way back.

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: '#555', fontSize: 14, marginBottom: 20 }}>
            The error has been reported automatically. Your data is safe — try reloading.
          </p>
          <button
            onClick={() => reset()}
            style={{ background: '#111', color: '#fff', border: 0, borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}
          >
            Reload page
          </button>
        </div>
      </body>
    </html>
  )
}
