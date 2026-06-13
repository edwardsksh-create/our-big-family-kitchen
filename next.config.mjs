import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'glyukuiofsurjwlluhqe.supabase.co' },
    ],
  },
  experimental: {
    // Required on Next 14.2 for instrumentation.ts (Sentry init) to run.
    instrumentationHook: true,
    // sharp's prebuilt binary dlopens libvips from the sibling
    // @img/sharp-libvips-* package, an edge Next's file tracing can't see —
    // without this the serverless bundle ships sharp without libvips and
    // the import dies with ERR_DLOPEN_FAILED at runtime. Only the two
    // sharp-using entrypoints carry the extra weight.
    outputFileTracingIncludes: {
      '/api/photos/upload':  ['./node_modules/@img/**'],
      '/admin/photo-review': ['./node_modules/@img/**'],
    },
  },
};

// Sentry build wrapper. Source-map upload is enabled only when a
// SENTRY_AUTH_TOKEN is present, so builds without it — local, CI, and any
// deploy before Sentry is fully configured — succeed quietly and just ship
// minified stack traces. The runtime SDK stays inert until a DSN is set
// (see sentry.*.config.ts).
const sentryBuildOptions = {
  org:           process.env.SENTRY_ORG,
  project:       process.env.SENTRY_PROJECT,
  authToken:     process.env.SENTRY_AUTH_TOKEN,
  silent:        true,
  disableLogger: true,
  // Don't attempt source-map upload without a token to do it with.
  sourcemaps:    { disable: !process.env.SENTRY_AUTH_TOKEN },
  bundleSizeOptimizations: { excludeDebugStatements: true },
};

export default withSentryConfig(nextConfig, sentryBuildOptions);
