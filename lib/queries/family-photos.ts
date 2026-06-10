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
  needs_editing:   boolean;        // admin-only — never rendered on public pages
  editing_note:    string | null;  // admin-only
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
  needs_editing: boolean;
  editing_note:  string | null;
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
    needs_editing:     r.needs_editing,
    editing_note:      r.editing_note,
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
  ai_hints, reviewed, not_for_archive, needs_editing, editing_note, uploaded_at,
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

export async function fetchPhotosNeedingEditing(): Promise<FamilyPhotoFull[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('family_photos')
    .select(COMMON_SELECT)
    .eq('needs_editing', true)
    .eq('not_for_archive', false)
    .order('uploaded_at', { ascending: true });
  return hydratePhotos((data ?? []) as unknown as Joined[]);
}

export async function countPhotosNeedingEditing(): Promise<number> {
  const db = supabaseAdmin();
  const { count } = await db
    .from('family_photos')
    .select('*', { count: 'exact', head: true })
    .eq('needs_editing', true)
    .eq('not_for_archive', false);
  return count ?? 0;
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
  // 'contributor:<id>' or 'family_member:<id>'. The form action splits this
  // back into a person_type and id when saving family_photo_people rows.
  ref: string;
  name: string;
  nickname:   string | null;
  birth_name: string | null;
  // All family lines this person belongs to, joined together so the
  // autocomplete row can show e.g. "Leusch · Sundy" for cross-listed people.
  family_line_names: string[];
};

// Normalizing key so multiple records that belong to the same human collapse
// into one autocomplete entry: contributor_slug when set, otherwise the
// person's name with whitespace and case smoothed out.
function personKey(name: string, contributorSlug: string | null): string {
  if (contributorSlug && contributorSlug.trim()) return `slug:${contributorSlug.trim().toLowerCase()}`;
  return `name:${name.toLowerCase().replace(/\s+/g, ' ').trim()}`;
}

function slugifyName(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Inputs for dedupePeopleForPicker — exported so tests can construct them
// without touching the DB.
export type DedupeContributor = {
  id:         string;
  name:       string | null;
  nickname:   string | null;
  birth_name: string | null;
};
export type DedupeFamilyMember = {
  id:               string;
  name:             string;
  nickname:         string | null;
  birth_name:       string | null;
  contributor_slug: string | null;
  family_line_id:   string;
};
export type DedupeContribLink = {
  contributor_id: string;
  family_line_id: string;
  rank:           string | null;
};
export type DedupeFamilyLine = { id: string; name: string };

/**
 * Pure dedup logic: one PickerPerson per real human. A contributor record
 * takes precedence — when a family_members row points at (or matches by
 * name) an existing contributor, the family_members row is dropped.
 * Cross-listed family_members rows (one per family line) collapse into a
 * single option whose family_line_names lists every line they belong to.
 */
export function dedupePeopleForPicker(
  contributors:     DedupeContributor[],
  members:          DedupeFamilyMember[],
  contributorLines: DedupeContribLink[],
  familyLines:      DedupeFamilyLine[],
): PickerPerson[] {
  const lineNameById = new Map(familyLines.map((l) => [l.id, l.name]));

  // Lines per contributor: primary first, then the rest. Stable sort
  // preserves insertion order for non-primary links.
  const linesPerContributor = new Map<string, string[]>();
  const ordered = contributorLines.slice().sort(
    (a, b) => (a.rank === 'primary' ? -1 : 0) - (b.rank === 'primary' ? -1 : 0),
  );
  for (const link of ordered) {
    const ln = lineNameById.get(link.family_line_id);
    if (!ln) continue;
    const arr = linesPerContributor.get(link.contributor_id) ?? [];
    if (!arr.includes(ln)) arr.push(ln);
    linesPerContributor.set(link.contributor_id, arr);
  }

  // Contributor lookup keyed by BOTH slug-of-name AND lowercased name so a
  // family_members row matches whether it carries a contributor_slug or not.
  const contributorKeys = new Set<string>();
  for (const c of contributors) {
    if (!c.name) continue;
    contributorKeys.add(personKey(c.name, slugifyName(c.name))); // slug:annie-sundy
    contributorKeys.add(personKey(c.name, null));                // name:annie sundy
  }

  // Collapse same-person family_members rows into one entry.
  const familyOnly = new Map<string, {
    id: string; name: string; nickname: string | null; birth_name: string | null; family_line_names: string[];
  }>();
  for (const m of members) {
    const key = personKey(m.name, m.contributor_slug);
    if (contributorKeys.has(key)) continue;
    const ln = lineNameById.get(m.family_line_id);
    const existing = familyOnly.get(key);
    if (existing) {
      if (ln && !existing.family_line_names.includes(ln)) existing.family_line_names.push(ln);
    } else {
      familyOnly.set(key, {
        id:                m.id,
        name:              m.name,
        nickname:          m.nickname,
        birth_name:        m.birth_name,
        family_line_names: ln ? [ln] : [],
      });
    }
  }

  const out: PickerPerson[] = [];
  for (const c of contributors) {
    if (!c.name) continue;
    out.push({
      ref:               `contributor:${c.id}`,
      name:              c.name,
      nickname:          c.nickname,
      birth_name:        c.birth_name,
      family_line_names: linesPerContributor.get(c.id) ?? [],
    });
  }
  for (const f of familyOnly.values()) {
    out.push({
      ref:               `family_member:${f.id}`,
      name:              f.name,
      nickname:          f.nickname,
      birth_name:        f.birth_name,
      family_line_names: f.family_line_names,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export async function fetchAllPeopleForPicker(): Promise<PickerPerson[]> {
  const db = supabaseAdmin();
  const [{ data: contribs }, { data: members }, { data: cfl }, { data: lines }] = await Promise.all([
    db.from('contributors').select('id, name, nickname, birth_name').order('name'),
    db.from('family_members').select('id, name, nickname, birth_name, family_line_id, contributor_slug, sort_order').order('sort_order'),
    db.from('contributor_family_lines').select('contributor_id, family_line_id, rank'),
    db.from('family_lines').select('id, name'),
  ]);
  return dedupePeopleForPicker(
    (contribs ?? []) as DedupeContributor[],
    (members  ?? []) as DedupeFamilyMember[],
    (cfl      ?? []) as DedupeContribLink[],
    (lines    ?? []) as DedupeFamilyLine[],
  );
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
