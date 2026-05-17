import { supabaseAdmin } from '@/lib/supabase/server';
import { SECTIONS } from '@/lib/sections';
import type { FederatedRecipe, FederatedRecipeBySection } from '@/lib/federated';

export async function fetchAllFederatedRecipes(): Promise<FederatedRecipe[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('federated_recipes')
    .select('id, source_url, title, contributor_name, section_slug, search_tokens, fetched_at')
    .order('title');
  if (error) throw error;
  return (data ?? []) as FederatedRecipe[];
}

export async function fetchFederatedRecipesForSection(
  sectionSlug: string,
): Promise<FederatedRecipe[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('federated_recipes')
    .select('id, source_url, title, contributor_name, section_slug, search_tokens, fetched_at')
    .eq('section_slug', sectionSlug)
    .order('title');
  if (error) throw error;
  return (data ?? []) as FederatedRecipe[];
}

export function groupBySection(recipes: FederatedRecipe[]): FederatedRecipeBySection[] {
  const bySlug = new Map<string, FederatedRecipe[]>();
  for (const r of recipes) {
    if (!r.section_slug) continue;
    const arr = bySlug.get(r.section_slug) ?? [];
    arr.push(r);
    bySlug.set(r.section_slug, arr);
  }
  return SECTIONS
    .filter((s) => bySlug.has(s.slug))
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      color: s.color,
      recipes: bySlug.get(s.slug) ?? [],
    }));
}

export async function fetchFederatedCount(): Promise<number> {
  const db = supabaseAdmin();
  const { count, error } = await db
    .from('federated_recipes')
    .select('id', { head: true, count: 'exact' });
  if (error) throw error;
  return count ?? 0;
}
