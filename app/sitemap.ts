import type { MetadataRoute } from 'next';
import { supabaseAdmin } from '@/lib/supabase/server';
import { SECTIONS } from '@/lib/sections';
import { FAMILY_LINES } from '@/lib/family-lines';
import { slugify } from '@/lib/utils';
import { FAMILY } from '@/config/family';
import { isAreaPublic } from '@/lib/access';

export const revalidate = 3600; // refresh once an hour

const BASE_URL = FAMILY.baseUrl;

// Only advertise areas that are publicly readable — a private area's URLs
// must not be listed for search engines (that would leak what's behind the
// sign-in wall). The home page and About are always listed.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const db = supabaseAdmin();
  const [recipesPublic, familyPublic, contributorsPublic] = await Promise.all([
    isAreaPublic('recipes'),
    isAreaPublic('family'),
    isAreaPublic('contributors'),
  ]);

  const [{ data: recipes }, { data: contributors }] = await Promise.all([
    recipesPublic
      ? db.from('recipes').select('slug, published_at, last_edited_at').eq('status', 'published')
      : Promise.resolve({ data: [] as { slug: string; published_at: string | null; last_edited_at: string | null }[] }),
    contributorsPublic
      ? db.from('contributors').select('name, email')
      : Promise.resolve({ data: [] as { name: string | null; email: string }[] }),
  ]);

  const paths: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`,      lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ];

  if (recipesPublic) {
    paths.push(
      { url: `${BASE_URL}/recipes`, lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
      { url: `${BASE_URL}/search`,  lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
      ...SECTIONS.map((s) => ({
        url: `${BASE_URL}/sections/${s.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7,
      })),
      ...(recipes ?? []).filter((r) => r.slug).map((r) => ({
        url: `${BASE_URL}/recipes/${r.slug}`,
        lastModified: new Date(r.last_edited_at ?? r.published_at ?? now),
        changeFrequency: 'monthly' as const,
        priority: 0.8,
      })),
    );
  }

  if (familyPublic) {
    paths.push(...FAMILY_LINES.map((f) => ({
      url: `${BASE_URL}/family-lines/${f.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7,
    })));
  }

  if (contributorsPublic) {
    paths.push(
      { url: `${BASE_URL}/contributors`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
      ...(contributors ?? []).map((c) => ({
        url: `${BASE_URL}/contributors/${slugify(c.name || c.email.split('@')[0])}`,
        lastModified: now, changeFrequency: 'monthly' as const, priority: 0.5,
      })),
    );
  }

  return paths;
}
