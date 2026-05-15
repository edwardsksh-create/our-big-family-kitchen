/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'glyukuiofsurjwlluhqe.supabase.co' },
    ],
  },
};

export default nextConfig;
