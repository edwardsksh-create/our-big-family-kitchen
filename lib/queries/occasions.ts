import { supabaseAdmin } from '@/lib/supabase/server';

export type Occasion = { slug: string; name: string };

export async function fetchOccasionBySlug(slug: string): Promise<Occasion | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('family_photo_occasion_types')
    .select('slug, name')
    .eq('slug', slug)
    .maybeSingle();
  return data ?? null;
}

/** Ids of published recipes tagged with an occasion. The occasion page
 *  resolves card data through fetchRecipeIndex (which already computes
 *  card images) and filters to these ids. */
export async function fetchRecipeIdsForOccasion(occasionSlug: string): Promise<string[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('recipe_occasions')
    .select('recipe_id')
    .eq('occasion_slug', occasionSlug);
  return [...new Set((data ?? []).map((r) => r.recipe_id))];
}

/** Occasions a recipe is tagged with, in vocabulary (seed) order — the
 *  recipe page's quiet "on the table at …" line. */
export async function fetchOccasionsForRecipe(recipeId: string): Promise<Occasion[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('recipe_occasions')
    .select('occasion:family_photo_occasion_types!recipe_occasions_occasion_slug_fkey ( slug, name, sort_order )')
    .eq('recipe_id', recipeId);
  return ((data ?? []) as unknown as { occasion: { slug: string; name: string; sort_order: number } | null }[])
    .map((j) => j.occasion)
    .filter((o): o is { slug: string; name: string; sort_order: number } => !!o)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(({ slug, name }) => ({ slug, name }));
}

/** Occasion slugs that have at least one published recipe or one reviewed
 *  photo — entry-point links only open doors that lead somewhere. */
export async function fetchOccasionSlugsWithContent(): Promise<Set<string>> {
  const db = supabaseAdmin();
  const [{ data: recipeJoins }, { data: photoJoins }] = await Promise.all([
    db.from('recipe_occasions').select('occasion_slug, recipe:recipes!recipe_occasions_recipe_id_fkey ( status )'),
    db.from('family_photo_occasions').select('occasion_slug, photo:family_photos!family_photo_occasions_family_photo_id_fkey ( reviewed, not_for_archive )'),
  ]);
  const slugs = new Set<string>();
  for (const j of (recipeJoins ?? []) as unknown as { occasion_slug: string; recipe: { status: string } | null }[]) {
    if (j.recipe?.status === 'published') slugs.add(j.occasion_slug);
  }
  for (const j of (photoJoins ?? []) as unknown as { occasion_slug: string; photo: { reviewed: boolean; not_for_archive: boolean } | null }[]) {
    if (j.photo?.reviewed && !j.photo.not_for_archive) slugs.add(j.occasion_slug);
  }
  return slugs;
}
