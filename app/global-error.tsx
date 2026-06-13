'use client';

// Root-level error boundary. App Router renders this in place of the whole
// page (including the root layout) when a render error escapes everywhere
// else, so it must provide its own <html>/<body>. We report the error to
// Sentry (a no-op when the SDK is disabled) and show a calm fallback in the
// site's voice rather than a stack trace.
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          background: '#FBF7EE',
          color: '#2A2522',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 0,
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '32rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontStyle: 'italic', margin: '0 0 0.75rem' }}>
            Something went wrong in the kitchen.
          </h1>
          <p style={{ color: '#5C544F', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
            The page hit an unexpected error. Trying again usually does it.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              border: 'none',
              borderRadius: 999,
              background: '#8D2842',
              color: '#FBF7EE',
              padding: '0.7rem 1.5rem',
              fontSize: '0.85rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
