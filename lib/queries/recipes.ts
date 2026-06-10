import { supabaseAdmin } from '@/lib/supabase/server';
import { formatDisplayName } from '@/lib/contributors/display-name';
import { slugify } from '@/lib/utils';
import { sectionBySlug, type SectionColorToken } from '@/lib/sections';
import { INTERNAL_TAG_SLUGS } from '@/lib/recipes/status-notes';

export type NativeRecipeSummary = {
  id: string;
  slug: string;
  title: string;
  published_at: string;
  contributor_name: string | null;
  section_slug:     string | null;
  section_name:     string | null;
  primary_family_line_slug: string | null;
};

type RawRow = {
  id: string;
  slug: string | null;
  title: string;
  published_at: string;
  contributor: { name: string | null; email: string } | null;
  section: { slug: string; name: string } | null;
  primary_family_line: { slug: string } | null;
};

function toSummary(row: RawRow): NativeRecipeSummary | null {
  if (!row.slug) return null;
  return {
    id:              row.id,
    slug:            row.slug,
    title:           row.title,
    published_at:    row.published_at,
    contributor_name: row.contributor?.name ?? row.contributor?.email.split('@')[0] ?? null,
    section_slug:     row.section?.slug ?? null,
    section_name:     row.section?.name ?? null,
    primary_family_line_slug: row.primary_family_line?.slug ?? null,
  };
}

export async function fetchRecentPublishedRecipes(limit = 6): Promise<NativeRecipeSummary[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('recipes')
    .select(`
      id, slug, title, published_at,
      contributor:contributors!recipes_contributor_id_fkey ( name, email ),
      section:sections!recipes_section_id_fkey ( slug, name ),
      primary_family_line:family_lines!recipes_primary_family_line_id_fkey ( slug )
    `)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown as RawRow[]).map(toSummary).filter(Boolean) as NativeRecipeSummary[];
}

export async function fetchPublishedRecipesForSection(sectionSlug: string): Promise<NativeRecipeSummary[]> {
  const db = supabaseAdmin();
  const { data: section } = await db.from('sections').select('id').eq('slug', sectionSlug).maybeSingle();
  if (!section) return [];
  const { data } = await db
    .from('recipes')
    .select(`
      id, slug, title, published_at,
      contributor:contributors!recipes_contributor_id_fkey ( name, email ),
      section:sections!recipes_section_id_fkey ( slug, name ),
      primary_family_line:family_lines!recipes_primary_family_line_id_fkey ( slug )
    `)
    .eq('status', 'published')
    .eq('section_id', section.id)
    .order('published_at', { ascending: false });
  return ((data ?? []) as unknown as RawRow[]).map(toSummary).filter(Boolean) as NativeRecipeSummary[];
}

// Bulk-fetch ingredient text per recipe for search-token enrichment.
// One round trip — keyed by recipe_id, joined to one string per recipe.
export async function fetchIngredientTextByRecipe(
  recipeIds: string[],
): Promise<Map<string, string>> {
  if (recipeIds.length === 0) return new Map();
  const db = supabaseAdmin();
  const { data } = await db
    .from('ingredients')
    .select('recipe_id, item_text')
    .in('recipe_id', recipeIds);
  const acc = new Map<string, string[]>();
  for (const row of data ?? []) {
    const arr = acc.get(row.recipe_id as string) ?? [];
    arr.push(row.item_text as string);
    acc.set(row.recipe_id as string, arr);
  }
  const joined = new Map<string, string>();
  for (const [id, items] of acc) joined.set(id, items.join(' '));
  return joined;
}

// -------------------------------------------------------------------------
// Recipe-index payload — used by /recipes for cards + filter/sort + badges.
// One serializable shape for the whole list; computed once per page render.
// -------------------------------------------------------------------------

export type RecipeIndexItem = {
  id: string;
  slug: string;
  title: string;
  published_at: string;
  updated_at: string;
  originally_from: string | null;
  /** Raw FK so the viewer-permission check on needs-prompts can compare
   *  signed-in viewer ↔ this recipe's owner without rehydrating contributors. */
  contributor_id: string | null;
  contributor: {
    slug: string;
    display: string;
  } | null;
  section: {
    slug: string;
    name: string;
    color: SectionColorToken;
  } | null;
  family_line: {
    slug: string;
    name: string;
  } | null;
  has_story:        boolean;
  has_method:       boolean;
  has_ingredients:  boolean;
  has_source_photo: boolean;
  tag_slugs:        string[];
};

type IndexRow = {
  id: string;
  slug: string | null;
  title: string;
  published_at: string;
  updated_at: string;
  originally_from: string | null;
  story: string | null;
  contributor_id: string | null;
  contributor: {
    name: string | null;
    email: string;
    nickname: string | null;
    birth_name: string | null;
  } | null;
  section: { slug: string; name: string } | null;
  primary_family_line: { slug: string; name: string } | null;
};

/**
 * Fetch every published recipe with the data needed for the /recipes index:
 * cards, filter bar, sort, and visual status badges. One recipes query plus
 * three count-bearing follow-up queries (ingredients, instructions, source
 * photos, tags) — bulk by recipe_id, no per-row round trips.
 */
export async function fetchRecipeIndex(): Promise<RecipeIndexItem[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('recipes')
    .select(`
      id, slug, title, published_at, updated_at, originally_from, story, contributor_id,
      contributor:contributors!recipes_contributor_id_fkey ( name, email, nickname, birth_name ),
      section:sections!recipes_section_id_fkey ( slug, name ),
      primary_family_line:family_lines!recipes_primary_family_line_id_fkey ( slug, name )
    `)
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  const rows = ((data ?? []) as unknown as IndexRow[]).filter((r) => r.slug);
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  // PostgREST enforces a 1000-row default cap that .range() can't override;
  // chunk the recipe ids so each join query fits comfortably under it.
  const RECIPE_CHUNK = 40;
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += RECIPE_CHUNK) chunks.push(ids.slice(i, i + RECIPE_CHUNK));

  async function gather<T>(
    runChunk: (chunkIds: string[]) => Promise<T[]>,
  ): Promise<T[]> {
    const all = await Promise.all(chunks.map(runChunk));
    return all.flat();
  }

  const [ingredientRows, instructionRows, sourcePhotoRows, tagJoinRows] = await Promise.all([
    gather<{ recipe_id: string }>(async (c) => {
      const { data } = await db.from('ingredients').select('recipe_id').in('recipe_id', c);
      return (data ?? []) as { recipe_id: string }[];
    }),
    gather<{ recipe_id: string }>(async (c) => {
      const { data } = await db.from('instructions').select('recipe_id').in('recipe_id', c);
      return (data ?? []) as { recipe_id: string }[];
    }),
    gather<{ recipe_id: string }>(async (c) => {
      const { data } = await db.from('photos').select('recipe_id').in('recipe_id', c).eq('photo_type', 'source');
      return (data ?? []) as { recipe_id: string }[];
    }),
    gather<{ recipe_id: string; tag: { slug: string } | null }>(async (c) => {
      const { data } = await db.from('recipe_tags')
        .select('recipe_id, tag:tags!recipe_tags_tag_id_fkey ( slug )')
        .in('recipe_id', c);
      return (data ?? []) as unknown as { recipe_id: string; tag: { slug: string } | null }[];
    }),
  ]);

  const hasIngredient  = new Set(ingredientRows.map((r) => r.recipe_id));
  const hasInstruction = new Set(instructionRows.map((r) => r.recipe_id));
  const hasSourcePhoto = new Set(sourcePhotoRows.map((r) => r.recipe_id));

  const tagsByRecipe = new Map<string, string[]>();
  for (const r of tagJoinRows) {
    const slug = r.tag?.slug;
    if (!slug || INTERNAL_TAG_SLUGS.has(slug)) continue;
    const arr = tagsByRecipe.get(r.recipe_id) ?? [];
    arr.push(slug);
    tagsByRecipe.set(r.recipe_id, arr);
  }

  return rows.map<RecipeIndexItem>((row) => {
    const contribFallbackName =
      row.contributor?.name || row.contributor?.email.split('@')[0] || null;
    const contribDisplay = contribFallbackName
      ? formatDisplayName({
          fullName:   contribFallbackName,
          nickname:   row.contributor?.nickname,
          birth_name: row.contributor?.birth_name,
        })
      : null;
    const contribSlug = contribFallbackName ? slugify(contribFallbackName) : null;

    const sectionInfo = row.section ? sectionBySlug(row.section.slug) : undefined;

    return {
      id:              row.id,
      slug:            row.slug as string,
      title:           row.title,
      published_at:    row.published_at,
      updated_at:      row.updated_at,
      originally_from: row.originally_from,
      contributor_id:  row.contributor_id,
      contributor: contribDisplay && contribSlug
        ? { slug: contribSlug, display: contribDisplay }
        : null,
      section: row.section
        ? {
            slug:  row.section.slug,
            // Prefer canonical name from lib/sections (handles legacy "&" copy).
            name:  sectionInfo?.name  ?? row.section.name,
            color: sectionInfo?.color ?? 'slate',
          }
        : null,
      family_line: row.primary_family_line
        ? { slug: row.primary_family_line.slug, name: row.primary_family_line.name }
        : null,
      has_story:        !!row.story && row.story.trim().length > 0,
      has_method:       hasInstruction.has(row.id),
      has_ingredients:  hasIngredient.has(row.id),
      has_source_photo: hasSourcePhoto.has(row.id),
      tag_slugs:        tagsByRecipe.get(row.id) ?? [],
    };
  });
}

export async function fetchPublishedRecipesForFamilyLine(familyLineSlug: string): Promise<NativeRecipeSummary[]> {
  const db = supabaseAdmin();
  const { data: fl } = await db.from('family_lines').select('id').eq('slug', familyLineSlug).maybeSingle();
  if (!fl) return [];
  const { data } = await db
    .from('recipes')
    .select(`
      id, slug, title, published_at,
      contributor:contributors!recipes_contributor_id_fkey ( name, email ),
      section:sections!recipes_section_id_fkey ( slug, name ),
      primary_family_line:family_lines!recipes_primary_family_line_id_fkey ( slug )
    `)
    .eq('status', 'published')
    .or(`primary_family_line_id.eq.${fl.id},secondary_family_line_id.eq.${fl.id}`)
    .order('published_at', { ascending: false });
  return ((data ?? []) as unknown as RawRow[]).map(toSummary).filter(Boolean) as NativeRecipeSummary[];
}
