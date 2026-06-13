// Sentry server-side init (Node runtime). Loaded by instrumentation.ts.
//
// Inert until SENTRY_DSN is set: Sentry.init with an empty/undefined dsn
// disables the SDK entirely, so this is a no-op in any environment where
// the DSN env var hasn't been configured (e.g. local dev, or before the
// Sentry project exists). Set SENTRY_DSN (server) / NEXT_PUBLIC_SENTRY_DSN
// (client) in Vercel to turn it on.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    // Errors only by default — this is a small family site, not a
    // performance-profiling target. Turn tracing up here if needed later.
    tracesSampleRate: 0,
  });
}
