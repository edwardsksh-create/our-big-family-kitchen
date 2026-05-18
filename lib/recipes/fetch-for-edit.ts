import { supabaseAdmin } from '@/lib/supabase/server';
import { type RecipeDraft, type PhotoEntry, newRowId } from '@/lib/recipes/draft';
import { publicUrl } from '@/lib/storage/photos';

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
      primary_family_line_id, secondary_family_line_id, section_id, kitchen_notes
    `)
    .eq('id', id)
    .maybeSingle();
  if (!row) return null;

  const [{ data: ings }, { data: instrs }, { data: tagJoins }, { data: photos }] = await Promise.all([
    db.from('ingredients').select('sub_header, item_text, sort_order').eq('recipe_id', id).order('sort_order'),
    db.from('instructions').select('sub_header, body, sort_order').eq('recipe_id', id).order('sort_order'),
    db.from('recipe_tags').select('tag:tags!recipe_tags_tag_id_fkey(name)').eq('recipe_id', id),
    db.from('photos').select('id, url, storage_path, caption, photo_type, sort_order').eq('recipe_id', id).order('sort_order'),
  ]);

  type PhotoRow = {
    id: string;
    url: string | null;
    storage_path: string | null;
    caption: string | null;
    photo_type: 'source' | 'dish';
    sort_order: number;
  };

  const allPhotos: PhotoEntry[] = ((photos ?? []) as PhotoRow[]).map((p) => ({
    id:           p.id,
    storage_path: p.storage_path ?? '',
    public_url:   p.storage_path ? publicUrl(p.storage_path) : (p.url ?? ''),
    photo_type:   p.photo_type,
    caption:      p.caption ?? undefined,
  })).filter((p) => p.public_url);

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
    kitchen_notes: (row.kitchen_notes as string[] | null) ?? [],
    source_photos: allPhotos.filter((p) => p.photo_type === 'source'),
    dish_photos:   allPhotos.filter((p) => p.photo_type === 'dish'),
  };

  if (draft.ingredients.length === 0) {
    draft.ingredients = [{ id: newRowId(), sub_header: '', item_text: '' }];
  }
  if (draft.instructions.length === 0) {
    draft.instructions = [{ id: newRowId(), sub_header: '', body: '' }];
  }

  return { draft, status: row.status };
}
