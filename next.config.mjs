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

export default nextConfig;
