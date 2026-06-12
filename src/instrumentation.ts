// Next.js instrumentation hook (Plan §0.5) — loads Sentry on boot for
// each runtime. onRequestError captures errors from nested React Server
// Components, route handlers, and the Inngest serve route.
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
