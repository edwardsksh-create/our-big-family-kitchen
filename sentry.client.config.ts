// Sentry browser-side init. Bundled into the client, so it can only read a
// NEXT_PUBLIC_ env var. Inert until NEXT_PUBLIC_SENTRY_DSN is set — see
// sentry.server.config.ts.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: 0,
    // Keep the client bundle lean and the data minimal — no session replay.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
