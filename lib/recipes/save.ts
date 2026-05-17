'use server';

import { Resend } from 'resend';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';
import type { RecipeDraft } from '@/lib/recipes/draft';

export type SaveAction =
  | 'draft'
  | 'publish'
  | 'submit_for_review'
  | 'admin_save'      // admin keeps the recipe in its current review status, but saves edits
  | 'admin_reject';   // admin marks pending recipe as rejected

export type SaveOutcome =
  | { ok: true; recipeId: string; slug: string; status: 'draft' | 'pending_review' | 'published' | 'rejected' }
  | { ok: false; error: string };

type ContributorRow = { id: string; email: string; name: string | null; role: 'admin' | 'contributor' | 'viewer' };

async function ensureUniqueSlug(base: string, existingId?: string): Promise<string> {
  const db = supabaseAdmin();
  const root = slugify(base) || 'recipe';
  let candidate = root;
  let suffix = 1;
  // Loop until we find a free slug, ignoring the row we're updating.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data } = await db
      .from('recipes')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (!data || data.id === existingId) return candidate;
    suffix += 1;
    candidate = `${root}-${suffix}`;
  }
}

async function syncIngredients(recipeId: string, rows: RecipeDraft['ingredients']) {
  const db = supabaseAdmin();
  await db.from('ingredients').delete().eq('recipe_id', recipeId);
  const clean = rows.filter((r) => r.item_text.trim().length > 0);
  if (clean.length === 0) return;
  await db.from('ingredients').insert(
    clean.map((r, idx) => ({
      recipe_id:  recipeId,
      sub_header: r.sub_header.trim() || null,
      item_text:  r.item_text.trim(),
      sort_order: idx,
    })),
  );
}

async function syncInstructions(recipeId: string, rows: RecipeDraft['instructions']) {
  const db = supabaseAdmin();
  await db.from('instructions').delete().eq('recipe_id', recipeId);
  const clean = rows.filter((r) => r.body.trim().length > 0);
  if (clean.length === 0) return;
  await db.from('instructions').insert(
    clean.map((r, idx) => ({
      recipe_id:  recipeId,
      sub_header: r.sub_header.trim() || null,
      body:       r.body.trim(),
      sort_order: idx,
    })),
  );
}

async function syncTags(recipeId: string, names: string[]) {
  const db = supabaseAdmin();
  const cleaned = Array.from(
    new Set(names.map((t) => t.trim()).filter(Boolean).map((t) => t.toLowerCase())),
  );
  await db.from('recipe_tags').delete().eq('recipe_id', recipeId);
  if (cleaned.length === 0) return;

  const tagIds: string[] = [];
  for (const name of cleaned) {
    const slug = slugify(name);
    const { data: existing } = await db
      .from('tags')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (existing) {
      tagIds.push(existing.id);
    } else {
      const { data: created } = await db
        .from('tags')
        .insert({ slug, name })
        .select('id')
        .single();
      if (created) tagIds.push(created.id);
    }
  }
  if (tagIds.length === 0) return;
  await db.from('recipe_tags').insert(
    tagIds.map((tag_id) => ({ recipe_id: recipeId, tag_id })),
  );
}

async function notifyAdminOfSubmission(args: {
  recipeId: string;
  title:    string;
  contributorName: string;
}) {
  const apiKey      = process.env.RESEND_API_KEY;
  const adminEmail  = process.env.ADMIN_EMAIL;
  const fromAddress = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  const base        = process.env.NEXTAUTH_URL || 'https://our-big-family-kitchen.vercel.app';
  if (!apiKey || !adminEmail) return;

  const resend = new Resend(apiKey);
  try {
    await resend.emails.send({
      from:    fromAddress,
      to:      adminEmail,
      subject: `New recipe submitted: ${args.title}`,
      text: `${args.contributorName} submitted "${args.title}".\n\nReview at: ${base}/admin/queue`,
    });
  } catch (err) {
    console.error('admin notification failed:', err);
  }
}

export async function saveRecipe(
  draft: RecipeDraft,
  action: SaveAction,
): Promise<SaveOutcome> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, error: 'unauthorized' };

  const db = supabaseAdmin();
  const { data: contributorRow } = await db
    .from('contributors')
    .select('id, email, name, role')
    .ilike('email', session.user.email)
    .maybeSingle();
  const contributor: ContributorRow | null = contributorRow;
  if (!contributor) return { ok: false, error: 'not_a_contributor' };

  const isAdmin = contributor.role === 'admin';
  if ((action === 'publish' || action === 'admin_save' || action === 'admin_reject') && !isAdmin) {
    return { ok: false, error: 'admin_only' };
  }

  // For admin actions we need an existing recipe id (we're editing an existing pending recipe).
  if ((action === 'admin_save' || action === 'admin_reject') && !draft.id) {
    return { ok: false, error: 'missing_recipe_id' };
  }

  // Validation. Auto-save (draft) is permissive; publish/submit/admin-save are strict.
  const strict = action !== 'draft' && action !== 'admin_reject';
  const title = draft.title.trim();
  if (strict && title.length < 2) return { ok: false, error: 'missing_title' };
  if (strict && !draft.primary_family_line_id) return { ok: false, error: 'missing_family_line' };
  if (strict && !draft.section_id) return { ok: false, error: 'missing_section' };

  // Attribution: use whatever the form picked (may be a stub). Falls back to
  // the signed-in user when nothing's picked.
  const contributorId = draft.contributor_id || contributor.id;

  // Look up current status for admin_save (we preserve it).
  let preservedStatus: 'draft' | 'pending_review' | 'published' | 'rejected' = 'draft';
  if (action === 'admin_save' && draft.id) {
    const { data: existing } = await db
      .from('recipes')
      .select('status')
      .eq('id', draft.id)
      .maybeSingle();
    preservedStatus = (existing?.status as typeof preservedStatus) ?? 'pending_review';
  }

  const nextStatus: 'draft' | 'pending_review' | 'published' | 'rejected' =
    action === 'publish' ? 'published'
    : action === 'submit_for_review' ? 'pending_review'
    : action === 'admin_save' ? preservedStatus
    : action === 'admin_reject' ? 'rejected'
    : 'draft';

  const slug = title ? await ensureUniqueSlug(title, draft.id) : null;

  const baseRow = {
    title:                    title || 'Untitled recipe',
    slug,
    contributor_id:           contributorId,
    originally_from:          draft.originally_from?.trim() || null,
    primary_family_line_id:   draft.primary_family_line_id ?? null,
    secondary_family_line_id: draft.secondary_family_line_id || null,
    section_id:               draft.section_id ?? null,
    story:                    draft.story?.trim() || null,
    status:                   nextStatus,
    published_at:             nextStatus === 'published' ? new Date().toISOString() : null,
  };

  let recipeId = draft.id;
  if (recipeId) {
    const { error } = await db.from('recipes').update(baseRow).eq('id', recipeId);
    if (error) {
      console.error('recipe update failed:', error);
      return { ok: false, error: 'db_update_failed' };
    }
  } else {
    // A first auto-save can land here with no required fields filled in yet.
    // Insert needs the not-null FKs; if we lack them, refuse and surface a hint.
    if (!baseRow.primary_family_line_id || !baseRow.section_id) {
      return { ok: false, error: 'pick_family_and_section_before_first_save' };
    }
    const { data: inserted, error } = await db
      .from('recipes')
      .insert(baseRow)
      .select('id')
      .single();
    if (error || !inserted) {
      console.error('recipe insert failed:', error);
      return { ok: false, error: 'db_insert_failed' };
    }
    recipeId = inserted.id;
  }

  // Skip child-table churn on pure reject — no edits needed.
  if (action !== 'admin_reject') {
    await Promise.all([
      syncIngredients(recipeId!, draft.ingredients),
      syncInstructions(recipeId!, draft.instructions),
      syncTags(recipeId!, draft.tags),
    ]);
  }

  if (action === 'admin_reject' || action === 'publish') {
    // Close out any open submission for this recipe.
    await db
      .from('submissions')
      .update({
        status:      action === 'publish' ? 'approved' : 'rejected',
        reviewed_by_id: contributor.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('recipe_id_if_published', recipeId!)
      .eq('status', 'queued');
  }

  if (action === 'submit_for_review') {
    await db.from('submissions').insert({
      source:                 'form',
      raw_payload:            { recipe_id: recipeId },
      contributor_id:         contributor.id,
      status:                 'queued',
      recipe_id_if_published: recipeId,
    });
    await notifyAdminOfSubmission({
      recipeId:        recipeId!,
      title:           baseRow.title,
      contributorName: contributor.name || contributor.email,
    });
  }

  return { ok: true, recipeId: recipeId!, slug: slug ?? '', status: nextStatus };
}
