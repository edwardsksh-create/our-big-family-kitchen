// Sentry init for the edge runtime (middleware / edge routes). Loaded by
// instrumentation.ts. Inert until a DSN is configured — see
// sentry.server.config.ts.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: 0,
  });
}
