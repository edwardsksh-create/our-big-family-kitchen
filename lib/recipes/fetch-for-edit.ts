import { supabaseAdmin } from '@/lib/supabase/server';
import { type RecipeDraft, newRowId } from '@/lib/recipes/draft';

export type RecipeForEdit = {
  draft:  RecipeDraft;
  status: 'draft' | 'pending_review' | 'published' | 'rejected';
};

export async function fetchRecipeForEdit(id: string): Promise<RecipeForEdit | null> {
  const db = supabaseAdmin();
  const { data: row } = await db
    .from('recipes')
    .select(`
      id, title, slug, story, originally_from, status, contributor_id,
      primary_family_line_id, secondary_family_line_id, section_id
    `)
    .eq('id', id)
    .maybeSingle();
  if (!row) return null;

  const [{ data: ings }, { data: instrs }, { data: tagJoins }] = await Promise.all([
    db.from('ingredients').select('sub_header, item_text, sort_order').eq('recipe_id', id).order('sort_order'),
    db.from('instructions').select('sub_header, body, sort_order').eq('recipe_id', id).order('sort_order'),
    db.from('recipe_tags').select('tag:tags!recipe_tags_tag_id_fkey(name)').eq('recipe_id', id),
  ]);

  const draft: RecipeDraft = {
    id:                       row.id,
    title:                    row.title ?? '',
    contributor_id:           row.contributor_id ?? undefined,
    originally_from:          row.originally_from ?? '',
    primary_family_line_id:   row.primary_family_line_id ?? undefined,
    secondary_family_line_id: row.secondary_family_line_id ?? undefined,
    section_id:               row.section_id ?? undefined,
    story:                    row.story ?? '',
    ingredients: (ings ?? []).map((r) => ({
      id:         newRowId(),
      sub_header: r.sub_header ?? '',
      item_text:  r.item_text ?? '',
    })),
    instructions: (instrs ?? []).map((r) => ({
      id:         newRowId(),
      sub_header: r.sub_header ?? '',
      body:       r.body ?? '',
    })),
    tags: ((tagJoins ?? []) as unknown as { tag: { name: string } | null }[])
      .map((j) => j.tag?.name)
      .filter(Boolean) as string[],
  };

  if (draft.ingredients.length === 0) {
    draft.ingredients = [{ id: newRowId(), sub_header: '', item_text: '' }];
  }
  if (draft.instructions.length === 0) {
    draft.instructions = [{ id: newRowId(), sub_header: '', body: '' }];
  }

  return { draft, status: row.status };
}
