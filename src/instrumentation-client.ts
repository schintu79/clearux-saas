// Sentry — browser. Captures client-side errors (frozen screens, dead
// buttons, hydration failures) that server logs never see.
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ||
    'https://36e4bfdffd86ea926516dae217f1da5a@o4511551265570818.ingest.de.sentry.io/4511551273369680',
  sampleRate: 1.0,
  tracesSampleRate: 0.05,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || 'development',
  enabled: process.env.NODE_ENV === 'production',
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
