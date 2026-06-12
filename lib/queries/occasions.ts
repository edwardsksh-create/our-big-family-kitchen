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
