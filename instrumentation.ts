// Next.js instrumentation hook — runs once per server runtime at startup.
// Loads the right Sentry init for the active runtime. Both configs are
// inert until a DSN is set, so this is a no-op until Sentry is turned on.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Captures errors thrown in nested React Server Components / route handlers
// and reports them to Sentry (no-op when the SDK is disabled).
export { captureRequestError as onRequestError } from '@sentry/nextjs';
