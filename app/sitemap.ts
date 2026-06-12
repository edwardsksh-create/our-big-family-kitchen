import type { MetadataRoute } from 'next';
import { supabaseAdmin } from '@/lib/supabase/server';
import { SECTIONS } from '@/lib/sections';
import { FAMILY_LINES } from '@/lib/family-lines';
import { slugify } from '@/lib/utils';
import { FAMILY } from '@/config/family';

export const revalidate = 3600; // refresh once an hour

const BASE_URL = FAMILY.baseUrl;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const db = supabaseAdmin();

  const [{ data: recipes }, { data: contributors }] = await Promise.all([
    db.from('recipes').select('slug, published_at, last_edited_at').eq('status', 'published'),
    db.from('contributors').select('name, email'),
  ]);

  const staticPaths: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`,            lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE_URL}/recipes`,     lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE_URL}/contributors`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE_URL}/about`,       lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/search`,      lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ];

  const familyLinePaths: MetadataRoute.Sitemap = FAMILY_LINES.map((f) => ({
    url: `${BASE_URL}/family-lines/${f.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const sectionPaths: MetadataRoute.Sitemap = SECTIONS.map((s) => ({
    url: `${BASE_URL}/sections/${s.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const recipePaths: MetadataRoute.Sitemap = (recipes ?? [])
    .filter((r) => r.slug)
    .map((r) => ({
      url: `${BASE_URL}/recipes/${r.slug}`,
      lastModified: new Date(r.last_edited_at ?? r.published_at ?? now),
      changeFrequency: 'monthly',
      priority: 0.8,
    }));

  const contributorPaths: MetadataRoute.Sitemap = (contributors ?? [])
    .map((c) => {
      const name = c.name || c.email.split('@')[0];
      return {
        url: `${BASE_URL}/contributors/${slugify(name)}`,
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      };
    });

  return [
    ...staticPaths,
    ...familyLinePaths,
    ...sectionPaths,
    ...recipePaths,
    ...contributorPaths,
  ];
}
