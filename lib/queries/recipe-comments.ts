import { supabaseAdmin } from '@/lib/supabase/server';
import { formatDisplayName } from '@/lib/contributors/display-name';
import { slugify } from '@/lib/utils';

export type RecipeComment = {
  id:                  string;
  body:                string;
  createdAt:           string;
  authorContributorId: string;
  author: {
    displayName: string;
    slug:        string;
  };
};

type Row = {
  id: string;
  body: string;
  created_at: string;
  author_contributor_id: string;
  author: {
    name:       string | null;
    email:      string;
    nickname:   string | null;
    birth_name: string | null;
  } | null;
};

/**
 * Comments for a recipe, newest first. Author display name is formatted via
 * the standard formatDisplayName helper so nicknames + birth names render
 * consistently with every other "by X" line on the site.
 */
export async function fetchCommentsForRecipe(recipeId: string): Promise<RecipeComment[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('recipe_comments')
    .select(`
      id, body, created_at, author_contributor_id,
      author:contributors!recipe_comments_author_contributor_id_fkey ( name, email, nickname, birth_name )
    `)
    .eq('recipe_id', recipeId)
    .order('created_at', { ascending: false });

  return ((data ?? []) as unknown as Row[]).map((r) => {
    const fullName = r.author?.name || (r.author?.email ? r.author.email.split('@')[0] : '') || 'A family member';
    const displayName = formatDisplayName({
      fullName,
      nickname:   r.author?.nickname,
      birth_name: r.author?.birth_name,
    });
    return {
      id:                  r.id,
      body:                r.body,
      createdAt:           r.created_at,
      authorContributorId: r.author_contributor_id,
      author: {
        displayName,
        slug: slugify(fullName),
      },
    };
  });
}
