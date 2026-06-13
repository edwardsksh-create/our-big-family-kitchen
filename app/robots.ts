import type { MetadataRoute } from 'next';
import { FAMILY } from '@/config/family';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow:     '/',
        disallow: [
          '/add',       // sign-in walled
          '/admin',     // admin-only
          '/album',     // public-by-link, but family photos stay out of search
          '/api/',      // never crawl APIs
          '/sign-in',
          '/sign-out',
        ],
      },
    ],
    sitemap: `${FAMILY.baseUrl}/sitemap.xml`,
    host:    FAMILY.baseUrl,
  };
}
