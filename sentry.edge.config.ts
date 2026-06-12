// Sentry — Edge runtime (middleware).
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn:
    process.env.SENTRY_DSN ||
    'https://36e4bfdffd86ea926516dae217f1da5a@o4511551265570818.ingest.de.sentry.io/4511551273369680',
  sampleRate: 1.0,
  tracesSampleRate: 0.1,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
  enabled: process.env.NODE_ENV === 'production',
})
