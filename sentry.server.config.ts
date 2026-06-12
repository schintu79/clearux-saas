// Sentry — Node.js runtime (API routes, RSC, Inngest pipeline).
// The DSN is a publishable key (it is shipped to browsers by design),
// so a hardcoded fallback is safe; env var still wins when set.
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn:
    process.env.SENTRY_DSN ||
    'https://36e4bfdffd86ea926516dae217f1da5a@o4511551265570818.ingest.de.sentry.io/4511551273369680',

  // Errors are the product here (silent-failure history) — keep them all.
  sampleRate: 1.0,
  // Light tracing: enough to see slow pipeline steps without burning quota.
  tracesSampleRate: 0.1,

  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
  enabled: process.env.NODE_ENV === 'production',
})
