import { supabaseAdmin } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';
import { FAMILY } from '@/config/family';

export type FamilyLineRef = { slug: string; name: string };

export type ContributorSummary = {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  role: 'admin' | 'contributor' | 'viewer';
  slug: string;
  joined_at: string | null;
  can_sign_in: boolean;
  /** Trusted-contributor flag — their submissions publish directly instead
   *  of landing in pending_review. Admin is always effectively trusted. */
  can_publish: boolean;
  deceased: boolean;
  nickname: string | null;
  birth_name: string | null;
  hero_photo_path: string | null;
  primary_family_line:   FamilyLineRef | null;
  secondary_family_line: FamilyLineRef | null;
};

export function displayName(c: { name: string | null; email: string }): string {
  return c.name || c.email.split('@')[0];
}

function isStubEmail(email: string): boolean {
  return email.endsWith(FAMILY.stubEmailSuffix);
}

export async function fetchAllContributors(): Promise<ContributorSummary[]> {
  const db = supabaseAdmin();
  const [{ data: rows }, { data: cflRows }, { data: flRows }] = await Promise.all([
    db.from('contributors').select('id, email, name, bio, role, joined_at, can_sign_in, can_publish, deceased, nickname, birth_name, hero_photo_path').order('name'),
    db.from('contributor_family_lines').select('contributor_id, family_line_id, rank'),
    db.from('family_lines').select('id, slug, name'),
  ]);

  const flById = new Map((flRows ?? []).map((f) => [f.id, { slug: f.slug, name: f.name }]));
  const primaryBy   = new Map<string, FamilyLineRef>();
  const secondaryBy = new Map<string, FamilyLineRef>();
  for (const link of cflRows ?? []) {
    const fl = flById.get(link.family_line_id);
    if (!fl) continue;
    if (link.rank === 'secondary') secondaryBy.set(link.contributor_id, fl);
    else                            primaryBy.set(link.contributor_id, fl);
  }

  return (rows ?? []).map((c) => {
    const name = displayName(c);
    return {
      id:           c.id,
      name,
      email:        isStubEmail(c.email) ? '' : c.email,
      bio:          c.bio,
      // role is a text column with a CHECK constraint enforcing the union;
      // narrowing here is safe in practice.
      role:         c.role as ContributorSummary['role'],
      slug:         slugify(name),
      joined_at:    c.joined_at,
      can_sign_in:  !!c.can_sign_in,
      can_publish:  !!c.can_publish,
      deceased:     !!c.deceased,
      nickname:     c.nickname ?? null,
      birth_name:   c.birth_name ?? null,
      hero_photo_path: c.hero_photo_path ?? null,
      primary_family_line:   primaryBy.get(c.id)   ?? null,
      secondary_family_line: secondaryBy.get(c.id) ?? null,
    };
  });
}

export async function fetchContributorBySlug(slug: string): Promise<ContributorSummary | null> {
  const all = await fetchAllContributors();
  return all.find((c) => c.slug === slug) ?? null;
}

/**
 * Pure filter for the public /contributors index: keep only people who have
 * at least one published recipe attributed to them as `contributor_id`.
 * Recipes a person merely added (added_by_id) don't count — listing a stub
 * that's never authored anything makes the index feel padded.
 *
 * Exported so the filter can be unit-tested without touching the database.
 * Other surfaces (/family-lines, /contributors/[slug], admin listings) keep
 * using the full list so structure-only people still appear where their
 * presence belongs.
 */
export function filterToListedContributors(
  all: ContributorSummary[],
  authoredContributorIds: Set<string>,
): ContributorSummary[] {
  return all.filter((c) => authoredContributorIds.has(c.id));
}

/**
 * Public /contributors listing. Fetches every contributor (so each row's
 * display data is fully hydrated), then narrows to those who actually have
 * a published authored recipe.
 */
export async function fetchListedContributors(): Promise<ContributorSummary[]> {
  const [all, ids] = await Promise.all([
    fetchAllContributors(),
    fetchContributorIdsWithPublishedRecipes(),
  ]);
  return filterToListedContributors(all, ids);
}

async function fetchContributorIdsWithPublishedRecipes(): Promise<Set<string>> {
  const db = supabaseAdmin();
  // Chunked select would matter if the table ballooned past PostgREST's
  // 1000-row cap; published-recipe count is well under that, so a single
  // query with .range is enough for the foreseeable future.
  const { data } = await db
    .from('recipes')
    .select('contributor_id')
    .eq('status', 'published')
    .range(0, 9999);
  const out = new Set<string>();
  for (const row of (data ?? []) as { contributor_id: string | null }[]) {
    if (row.contributor_id) out.add(row.contributor_id);
  }
  return out;
}

export type ContributorsForFamilyLine = {
  primary:   ContributorSummary[];
  secondary: ContributorSummary[];
};

export async function fetchContributorsForFamilyLine(
  familyLineSlug: string,
): Promise<ContributorsForFamilyLine> {
  const all = await fetchAllContributors();
  return {
    primary:   all.filter((c) => c.primary_family_line?.slug   === familyLineSlug),
    secondary: all.filter((c) => c.secondary_family_line?.slug === familyLineSlug),
  };
}

// Map of family-line slug → contributor display names (primary + secondary,
// deduplicated, alphabetized). Used by home-page family-line cards.
export async function fetchMemberNamesByFamilyLine(): Promise<Record<string, string[]>> {
  const all = await fetchAllContributors();
  const bySlug: Record<string, Set<string>> = {};
  for (const c of all) {
    for (const fl of [c.primary_family_line, c.secondary_family_line]) {
      if (!fl) continue;
      (bySlug[fl.slug] ??= new Set()).add(c.name);
    }
  }
  return Object.fromEntries(
    Object.entries(bySlug).map(([slug, names]) => [slug, [...names].sort()]),
  );
}
