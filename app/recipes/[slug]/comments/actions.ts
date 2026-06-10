'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { canDeleteComment, canPostComment, type CommentViewer } from '@/lib/recipes/comment-permissions';

const MAX_BODY_LENGTH = 2000;

export type AddCommentResult =
  | { ok: true; commentId: string }
  | { ok: false; error: 'unauthorized' | 'cannot_post' | 'invalid_body' | 'recipe_not_found' | 'insert_failed' };

export type DeleteCommentResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'forbidden' | 'comment_not_found' | 'delete_failed' };

async function resolveViewer(): Promise<CommentViewer | null> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;
  const isAdmin = (session?.user?.role ?? '') === 'admin';
  const { data } = await supabaseAdmin()
    .from('contributors')
    .select('id, can_sign_in')
    .ilike('email', email)
    .maybeSingle();
  if (!data) return null;
  return { isAdmin, contributorId: data.id, canSignIn: !!data.can_sign_in };
}

/**
 * Post a memory on a recipe. Any signed-in contributor with can_sign_in=true
 * can post on ANY recipe — the contributor of the recipe being deceased or
 * stubbed doesn't matter; only the COMMENTER's permission matters.
 */
export async function addComment(input: {
  recipeId:   string;
  recipeSlug: string;
  body:       string;
}): Promise<AddCommentResult> {
  const viewer = await resolveViewer();
  if (!viewer) return { ok: false, error: 'unauthorized' };
  if (!canPostComment(viewer)) return { ok: false, error: 'cannot_post' };

  const body = (input.body ?? '').trim();
  if (body.length === 0 || body.length > MAX_BODY_LENGTH) {
    return { ok: false, error: 'invalid_body' };
  }

  const db = supabaseAdmin();
  // Defense: confirm the recipe exists so we don't insert orphan comments.
  const { data: recipe } = await db.from('recipes').select('id').eq('id', input.recipeId).maybeSingle();
  if (!recipe) return { ok: false, error: 'recipe_not_found' };

  const { data: inserted, error } = await db
    .from('recipe_comments')
    .insert({
      recipe_id:             input.recipeId,
      author_contributor_id: viewer.contributorId!,
      body,
    })
    .select('id')
    .single();
  if (error || !inserted) {
    console.error('addComment failed', error);
    return { ok: false, error: 'insert_failed' };
  }

  revalidatePath(`/recipes/${input.recipeSlug}`);
  return { ok: true, commentId: inserted.id };
}

/**
 * Delete a memory. Only the author of the comment, or admin, can delete.
 */
export async function deleteComment(input: {
  commentId:  string;
  recipeSlug: string;
}): Promise<DeleteCommentResult> {
  const viewer = await resolveViewer();
  if (!viewer) return { ok: false, error: 'unauthorized' };

  const db = supabaseAdmin();
  const { data: existing } = await db
    .from('recipe_comments')
    .select('id, author_contributor_id')
    .eq('id', input.commentId)
    .maybeSingle();
  if (!existing) return { ok: false, error: 'comment_not_found' };

  if (!canDeleteComment(viewer, { authorContributorId: existing.author_contributor_id })) {
    return { ok: false, error: 'forbidden' };
  }

  const { error } = await db.from('recipe_comments').delete().eq('id', input.commentId);
  if (error) {
    console.error('deleteComment failed', error);
    return { ok: false, error: 'delete_failed' };
  }

  revalidatePath(`/recipes/${input.recipeSlug}`);
  return { ok: true };
}
