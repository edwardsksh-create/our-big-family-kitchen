import { supabaseAdmin } from '@/lib/supabase/server';
import { familyPhotoUrl } from '@/lib/storage/photos';
import type { FamilyPhotoHints } from '@/lib/photos/family-photo-hints';

export type FamilyPhotoTagPerson = {
  person_type: 'contributor' | 'family_member';
  id: string;
  name: string;
  nickname:   string | null;
  birth_name: string | null;
  contributor_slug: string | null;   // for linking from /album lightbox or contributor pages
};

export type FamilyPhotoTagRecipe = {
  id: string;
  slug: string;
  title: string;
};

export type FamilyPhotoFull = {
  id:           string;
  storage_path: string;
  public_url:   string;
  caption:      string | null;
  year:         string | null;
  place:        string | null;
  additional_people: string | null;
  pets:         string | null;
  ai_hints:     FamilyPhotoHints | null;
  reviewed:     boolean;
  not_for_archive: boolean;
  uploaded_at:  string;
  people:       FamilyPhotoTagPerson[];
  occasions:    string[];
  recipes:      FamilyPhotoTagRecipe[];
};

type Joined = {
  id: string;
  storage_path: string;
  caption: string | null;
  year: string | null;
  place: string | null;
  additional_people: string | null;
  pets: string | null;
  ai_hints: FamilyPhotoHints | null;
  reviewed: boolean;
  not_for_archive: boolean;
  uploaded_at: string;
  people:    { person_type: 'contributor' | 'family_member'; contributor_id: string | null; family_member_id: string | null }[];
  occasions: { occasion_slug: string }[];
  recipes:   { recipe: { id: string; slug: string | null; title: string } | null }[];
};

async function hydratePhotos(rows: Joined[]): Promise<FamilyPhotoFull[]> {
  if (rows.length === 0) return [];
  const db = supabaseAdmin();

  // Pull all referenced contributors + family_members in one shot.
  const contributorIds = new Set<string>();
  const familyMemberIds = new Set<string>();
  for (const r of rows) {
    for (const p of r.people) {
      if (p.contributor_id)   contributorIds.add(p.contributor_id);
      if (p.family_member_id) familyMemberIds.add(p.family_member_id);
    }
  }

  const [{ data: contribRows }, { data: memberRows }] = await Promise.all([
    contributorIds.size > 0
      ? db.from('contributors').select('id, name, nickname, birth_name').in('id', [...contributorIds])
      : Promise.resolve({ data: [] as { id: string; name: string | null; nickname: string | null; birth_name: string | null }[] }),
    familyMemberIds.size > 0
      ? db.from('family_members').select('id, name, nickname, birth_name, contributor_slug').in('id', [...familyMemberIds])
      : Promise.resolve({ data: [] as { id: string; name: string; nickname: string | null; birth_name: string | null; contributor_slug: string | null }[] }),
  ]);

  // contributors → slug. We slugify here to match the app's convention.
  const contribById = new Map((contribRows ?? []).map((c) => [c.id, c]));
  const memberById  = new Map((memberRows  ?? []).map((m) => [m.id, m]));

  function slugify(s: string): string {
    return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  return rows.map((r) => ({
    id:                r.id,
    storage_path:      r.storage_path,
    public_url:        familyPhotoUrl(r.storage_path),
    caption:           r.caption,
    year:              r.year,
    place:             r.place,
    additional_people: r.additional_people,
    pets:              r.pets,
    ai_hints:          r.ai_hints,
    reviewed:          r.reviewed,
    not_for_archive:   r.not_for_archive,
    uploaded_at:       r.uploaded_at,
    people: r.people.map((p): FamilyPhotoTagPerson => {
      if (p.person_type === 'contributor' && p.contributor_id) {
        const c = contribById.get(p.contributor_id);
        return {
          person_type: 'contributor',
          id:          p.contributor_id,
          name:        c?.name ?? '',
          nickname:    c?.nickname ?? null,
          birth_name:  c?.birth_name ?? null,
          contributor_slug: c?.name ? slugify(c.name) : null,
        };
      }
      const m = p.family_member_id ? memberById.get(p.family_member_id) : undefined;
      return {
        person_type: 'family_member',
        id:          p.family_member_id ?? '',
        name:        m?.name ?? '',
        nickname:    m?.nickname ?? null,
        birth_name:  m?.birth_name ?? null,
        contributor_slug: m?.contributor_slug ?? null,
      };
    }),
    occasions: r.occasions.map((o) => o.occasion_slug),
    recipes: r.recipes
      .map((rr) => rr.recipe)
      .filter((x): x is { id: string; slug: string | null; title: string } => !!x && !!x.slug)
      .map((rr) => ({ id: rr.id, slug: rr.slug as string, title: rr.title })),
  }));
}

const COMMON_SELECT = `
  id, storage_path, caption, year, place, additional_people, pets,
  ai_hints, reviewed, not_for_archive, uploaded_at,
  people:family_photo_people ( person_type, contributor_id, family_member_id ),
  occasions:family_photo_occasions ( occasion_slug ),
  recipes:family_photo_recipes ( recipe:recipes!family_photo_recipes_recipe_id_fkey ( id, slug, title ) )
`;

export async function fetchFirstUnreviewedPhoto(): Promise<FamilyPhotoFull | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('family_photos')
    .select(COMMON_SELECT)
    .eq('reviewed', false)
    .eq('not_for_archive', false)
    .order('uploaded_at', { ascending: true })
    .limit(1);
  const hydrated = await hydratePhotos((data ?? []) as unknown as Joined[]);
  return hydrated[0] ?? null;
}

export async function fetchMostRecentlyReviewedPhoto(): Promise<FamilyPhotoFull | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('family_photos')
    .select(COMMON_SELECT)
    .eq('reviewed', true)
    .eq('not_for_archive', false)
    .order('uploaded_at', { ascending: false })
    .limit(1);
  const hydrated = await hydratePhotos((data ?? []) as unknown as Joined[]);
  return hydrated[0] ?? null;
}

export async function fetchPhotoReviewProgress(): Promise<{ total: number; reviewed: number; remaining: number }> {
  const db = supabaseAdmin();
  const [allCnt, reviewedCnt] = await Promise.all([
    db.from('family_photos').select('*', { count: 'exact', head: true }).eq('not_for_archive', false),
    db.from('family_photos').select('*', { count: 'exact', head: true }).eq('reviewed', true).eq('not_for_archive', false),
  ]);
  const total = allCnt.count ?? 0;
  const reviewed = reviewedCnt.count ?? 0;
  return { total, reviewed, remaining: total - reviewed };
}

export async function fetchAllReviewedPhotos(): Promise<FamilyPhotoFull[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('family_photos')
    .select(COMMON_SELECT)
    .eq('reviewed', true)
    .eq('not_for_archive', false)
    .order('year', { ascending: false, nullsFirst: false })
    .order('uploaded_at', { ascending: false });
  return hydratePhotos((data ?? []) as unknown as Joined[]);
}

export async function fetchPhotosForContributor(contributorId: string, limit = 6): Promise<FamilyPhotoFull[]> {
  const db = supabaseAdmin();
  const { data: joinRows } = await db
    .from('family_photo_people')
    .select('family_photo_id')
    .eq('contributor_id', contributorId);
  const photoIds = [...new Set((joinRows ?? []).map((j) => j.family_photo_id))];
  if (photoIds.length === 0) return [];
  const { data } = await db
    .from('family_photos')
    .select(COMMON_SELECT)
    .in('id', photoIds)
    .eq('reviewed', true)
    .eq('not_for_archive', false)
    .order('uploaded_at', { ascending: false })
    .limit(limit);
  return hydratePhotos((data ?? []) as unknown as Joined[]);
}

export async function fetchPhotosForRecipe(recipeId: string): Promise<FamilyPhotoFull[]> {
  const db = supabaseAdmin();
  const { data: joinRows } = await db
    .from('family_photo_recipes')
    .select('family_photo_id')
    .eq('recipe_id', recipeId);
  const photoIds = [...new Set((joinRows ?? []).map((j) => j.family_photo_id))];
  if (photoIds.length === 0) return [];
  const { data } = await db
    .from('family_photos')
    .select(COMMON_SELECT)
    .in('id', photoIds)
    .eq('reviewed', true)
    .eq('not_for_archive', false)
    .order('uploaded_at', { ascending: false });
  return hydratePhotos((data ?? []) as unknown as Joined[]);
}

// People + recipes pickers — small datasets loaded upfront for client-side filtering.

export type PickerPerson = {
  person_type: 'contributor' | 'family_member';
  id: string;
  name: string;
  nickname: string | null;
  birth_name: string | null;
  family_line_name: string | null;
};

export async function fetchAllPeopleForPicker(): Promise<PickerPerson[]> {
  const db = supabaseAdmin();
  const [{ data: contribs }, { data: members }, { data: cfl }, { data: lines }] = await Promise.all([
    db.from('contributors').select('id, name, nickname, birth_name').order('name'),
    db.from('family_members').select('id, name, nickname, birth_name, family_line_id, sort_order').order('sort_order'),
    db.from('contributor_family_lines').select('contributor_id, family_line_id, rank'),
    db.from('family_lines').select('id, name'),
  ]);
  const lineNameById = new Map((lines ?? []).map((l) => [l.id, l.name]));
  const contribLineByContributor = new Map<string, string>();
  for (const link of cfl ?? []) {
    if (link.rank !== 'primary') continue;
    const ln = lineNameById.get(link.family_line_id);
    if (ln) contribLineByContributor.set(link.contributor_id, ln);
  }
  const out: PickerPerson[] = [];
  for (const c of contribs ?? []) {
    if (!c.name) continue;
    out.push({
      person_type: 'contributor',
      id:          c.id,
      name:        c.name,
      nickname:    c.nickname,
      birth_name:  c.birth_name,
      family_line_name: contribLineByContributor.get(c.id) ?? null,
    });
  }
  for (const m of members ?? []) {
    out.push({
      person_type: 'family_member',
      id:          m.id,
      name:        m.name,
      nickname:    m.nickname,
      birth_name:  m.birth_name,
      family_line_name: lineNameById.get(m.family_line_id) ?? null,
    });
  }
  return out;
}

export type PickerRecipe = { id: string; slug: string; title: string };

export async function fetchAllRecipesForPicker(): Promise<PickerRecipe[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('recipes')
    .select('id, slug, title')
    .eq('status', 'published')
    .not('slug', 'is', null)
    .order('title');
  return ((data ?? []) as { id: string; slug: string | null; title: string }[])
    .filter((r) => !!r.slug)
    .map((r) => ({ id: r.id, slug: r.slug as string, title: r.title }));
}

export type OccasionType = { slug: string; name: string; sort_order: number };

export async function fetchOccasionTypes(): Promise<OccasionType[]> {
  const db = supabaseAdmin();
  const { data } = await db.from('family_photo_occasion_types').select('slug, name, sort_order').order('sort_order');
  return (data ?? []) as OccasionType[];
}
