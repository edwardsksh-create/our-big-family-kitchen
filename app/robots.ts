import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow:     '/',
        disallow: [
          '/add',       // sign-in walled
          '/admin',     // admin-only
          '/api/',      // never crawl APIs
          '/sign-in',
          '/sign-out',
        ],
      },
    ],
    sitemap: 'https://bigfamilykitchen.com/sitemap.xml',
    host:    'https://bigfamilykitchen.com',
  };
}
