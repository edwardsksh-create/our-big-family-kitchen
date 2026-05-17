import { supabaseAdmin } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

export type ContributorSummary = {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  role: 'admin' | 'contributor' | 'viewer';
  slug: string;
  joined_at: string | null;
  family_lines: { slug: string; name: string }[];
};

export function displayName(c: { name: string | null; email: string }): string {
  return c.name || c.email.split('@')[0];
}

function isStubEmail(email: string): boolean {
  return email.endsWith('@ourbigfamilykitchen.local');
}

export async function fetchAllContributors(): Promise<ContributorSummary[]> {
  const db = supabaseAdmin();
  const [{ data: rows }, { data: cflRows }, { data: flRows }] = await Promise.all([
    db.from('contributors').select('id, email, name, bio, role, joined_at').order('joined_at', { nullsFirst: false }),
    db.from('contributor_family_lines').select('contributor_id, family_line_id'),
    db.from('family_lines').select('id, slug, name'),
  ]);

  const flById = new Map((flRows ?? []).map((f) => [f.id, f]));
  const linesByContributor = new Map<string, { slug: string; name: string }[]>();
  for (const link of cflRows ?? []) {
    const fl = flById.get(link.family_line_id);
    if (!fl) continue;
    const arr = linesByContributor.get(link.contributor_id) ?? [];
    arr.push({ slug: fl.slug, name: fl.name });
    linesByContributor.set(link.contributor_id, arr);
  }

  return (rows ?? []).map((c) => {
    const name = displayName(c);
    return {
      id:           c.id,
      name,
      email:        isStubEmail(c.email) ? '' : c.email,
      bio:          c.bio,
      role:         c.role,
      slug:         slugify(name),
      joined_at:    c.joined_at,
      family_lines: linesByContributor.get(c.id) ?? [],
    };
  });
}

export async function fetchContributorBySlug(slug: string): Promise<ContributorSummary | null> {
  const all = await fetchAllContributors();
  return all.find((c) => c.slug === slug) ?? null;
}

export async function fetchContributorsForFamilyLine(
  familyLineSlug: string,
): Promise<ContributorSummary[]> {
  const all = await fetchAllContributors();
  return all.filter((c) => c.family_lines.some((f) => f.slug === familyLineSlug));
}
