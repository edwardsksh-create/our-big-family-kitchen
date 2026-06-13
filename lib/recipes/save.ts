'use server';

import { revalidatePath } from 'next/cache';
import { Resend } from 'resend';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { normalizeOccasionSlugs } from '@/lib/recipes/occasions';
import { slugify } from '@/lib/utils';
import type { RecipeDraft } from '@/lib/recipes/draft';
import type { Database } from '@/types/supabase';
import { FAMILY } from '@/config/family';

type RecipeInsert = Database['public']['Tables']['recipes']['Insert'];
type RecipeUpdate = Database['public']['Tables']['recipes']['Update'];

export type SaveAction =
  | 'draft'
  | 'publish'
  | 'submit_for_review'
  | 'admin_save'      // admin keeps the recipe in its current review status, but saves edits
  | 'admin_reject'    // admin marks pending recipe as rejected
  | 'edit'            // admin or original contributor editing a published/draft recipe; status preserved
  | 'unpublish';      // admin pulls a published recipe back to draft

export type SaveOutcome =
  | { ok: true; recipeId: string; slug: string; status: 'draft' | 'pending_review' | 'published' | 'rejected' }
  | { ok: false; error: string };

type ContributorRow = {
  id:          string;
  email:       string;
  name:        string | null;
  role:        'admin' | 'contributor' | 'viewer';
  can_publish: boolean;
};

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

// The child-table syncs are delete-then-insert without a wrapping
// transaction (no RPC yet — see the security-gate list). The one disaster
// that design allows is a delete that lands and an insert that doesn't,
// silently: the recipe loses its ingredients while the user sees "Saved".
// Every step is therefore checked and failures THROW; saveRecipe surfaces
// 'sync_failed' so the user retries, and a retry converges because each
// sync rebuilds its table from the draft.
class SyncError extends Error {
  constructor(step: string, cause: { message: string }) {
    super(`${step}: ${cause.message}`);
  }
}

async function syncIngredients(recipeId: string, rows: RecipeDraft['ingredients']) {
  const db = supabaseAdmin();
  const { error: delErr } = await db.from('ingredients').delete().eq('recipe_id', recipeId);
  if (delErr) throw new SyncError('ingredients delete', delErr);
  const clean = rows.filter((r) => r.item_text.trim().length > 0);
  if (clean.length === 0) return;
  const { error: insErr } = await db.from('ingredients').insert(
    clean.map((r, idx) => ({
      recipe_id:  recipeId,
      sub_header: r.sub_header.trim() || null,
      item_text:  r.item_text.trim(),
      sort_order: idx,
    })),
  );
  if (insErr) throw new SyncError('ingredients insert', insErr);
}

async function syncInstructions(recipeId: string, rows: RecipeDraft['instructions']) {
  const db = supabaseAdmin();
  const { error: delErr } = await db.from('instructions').delete().eq('recipe_id', recipeId);
  if (delErr) throw new SyncError('instructions delete', delErr);
  const clean = rows.filter((r) => r.body.trim().length > 0);
  if (clean.length === 0) return;
  const { error: insErr } = await db.from('instructions').insert(
    clean.map((r, idx) => ({
      recipe_id:  recipeId,
      sub_header: r.sub_header.trim() || null,
      body:       r.body.trim(),
      sort_order: idx,
    })),
  );
  if (insErr) throw new SyncError('instructions insert', insErr);
}

async function syncPhotos(
  recipeId: string,
  contributorId: string,
  source: { id?: string; storage_path: string; public_url: string; thumb_path?: string | null; caption?: string }[],
  dish:   { id?: string; storage_path: string; public_url: string; thumb_path?: string | null; caption?: string }[],
) {
  const db = supabaseAdmin();
  // Wholesale-replace approach keyed on storage_path: any existing photo
  // whose storage_path isn't in the incoming sets gets removed (so the user
  // can delete photos by omitting them from the draft).
  const keepPaths = new Set<string>([
    ...source.map((p) => p.storage_path),
    ...dish.map((p) => p.storage_path),
  ]);
  const { data: existing, error: listErr } = await db
    .from('photos')
    .select('id, storage_path')
    .eq('recipe_id', recipeId);
  if (listErr) throw new SyncError('photos list', listErr);
  const removeIds = (existing ?? [])
    .filter((p) => p.storage_path && !keepPaths.has(p.storage_path))
    .map((p) => p.id);
  if (removeIds.length > 0) {
    const { error: delErr } = await db.from('photos').delete().in('id', removeIds);
    if (delErr) throw new SyncError('photos delete', delErr);
  }

  // Upsert by storage_path. The DB doesn't have a unique constraint on
  // storage_path (it's nullable), so we do a per-photo check.
  let order = 0;
  for (const list of [source, dish] as const) {
    const photoType = list === source ? 'source' : 'dish';
    for (const photo of list) {
      const { data: hit, error: hitErr } = await db
        .from('photos')
        .select('id')
        .eq('recipe_id', recipeId)
        .eq('storage_path', photo.storage_path)
        .maybeSingle();
      if (hitErr) throw new SyncError('photos lookup', hitErr);
      if (hit) {
        const { error: updErr } = await db
          .from('photos')
          .update({ caption: photo.caption ?? null, sort_order: order, photo_type: photoType })
          .eq('id', hit.id);
        if (updErr) throw new SyncError('photos update', updErr);
      } else {
        const { error: insErr } = await db.from('photos').insert({
          recipe_id:      recipeId,
          contributor_id: contributorId,
          url:            photo.public_url,
          storage_path:   photo.storage_path,
          thumb_path:     photo.thumb_path ?? null,
          caption:        photo.caption ?? null,
          photo_type:     photoType,
          sort_order:     order,
        });
        if (insErr) throw new SyncError('photos insert', insErr);
      }
      order += 1;
    }
  }
}

async function syncTags(recipeId: string, names: string[]) {
  const db = supabaseAdmin();
  const cleaned = Array.from(
    new Set(names.map((t) => t.trim()).filter(Boolean).map((t) => t.toLowerCase())),
  );
  const { error: delErr } = await db.from('recipe_tags').delete().eq('recipe_id', recipeId);
  if (delErr) throw new SyncError('tags delete', delErr);
  if (cleaned.length === 0) return;

  const tagIds: string[] = [];
  for (const name of cleaned) {
    const slug = slugify(name);
    const { data: existing, error: selErr } = await db
      .from('tags')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (selErr) throw new SyncError('tags lookup', selErr);
    if (existing) {
      tagIds.push(existing.id);
    } else {
      const { data: created, error: insErr } = await db
        .from('tags')
        .insert({ slug, name })
        .select('id')
        .single();
      // A concurrent save can create the same tag between our lookup and
      // insert; the retry that 'sync_failed' prompts will find it.
      if (insErr || !created) throw new SyncError('tags create', insErr ?? { message: 'no row returned' });
      tagIds.push(created.id);
    }
  }
  if (tagIds.length === 0) return;
  const { error: linkErr } = await db.from('recipe_tags').insert(
    tagIds.map((tag_id) => ({ recipe_id: recipeId, tag_id })),
  );
  if (linkErr) throw new SyncError('tags link', linkErr);
}

async function syncOccasions(recipeId: string, slugs: string[]) {
  const db = supabaseAdmin();
  // Validate against the canonical vocabulary — unknown slugs are dropped
  // (the FK would reject them anyway; this keeps the failure graceful).
  const { data: types } = await db.from('family_photo_occasion_types').select('slug');
  const valid = new Set((types ?? []).map((t) => t.slug));
  const clean = normalizeOccasionSlugs(slugs, valid);

  const { error: delErr } = await db.from('recipe_occasions').delete().eq('recipe_id', recipeId);
  if (delErr) throw new SyncError('occasions delete', delErr);
  if (clean.length === 0) return;
  const { error: insErr } = await db.from('recipe_occasions').insert(
    clean.map((occasion_slug) => ({ recipe_id: recipeId, occasion_slug })),
  );
  if (insErr) throw new SyncError('occasions insert', insErr);
}

// PostgREST returns PGRST202 when no matching function is in the schema
// cache; Postgres' own undefined_function code is 42883. Either means the
// 0035 migration isn't applied yet → use the per-statement fallback so
// deploying this code before the migration can't break saving.
function isMissingRpc(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === 'PGRST202' || err.code === '42883'
    || /replace_recipe_children/.test(err.message ?? '');
}

/**
 * The transactional child-table sync (security gate item 8 — the RPC upgrade
 * to PR #4's error-checking). The app resolves the "smart" parts here
 * (trim/filter, slugify tags, validate occasion slugs, order photos) exactly
 * as the per-statement syncs did, then one RPC replaces every child table in
 * a single DB transaction — so a mid-sync failure rolls back instead of
 * leaving a recipe momentarily missing its content. Falls back to the
 * per-statement path when the RPC isn't deployed yet.
 *
 * Returns null on success, or a reason string (already logged) on failure.
 */
async function syncRecipeChildren(
  recipeId: string,
  contributorId: string,
  draft: RecipeDraft,
): Promise<string | null> {
  const db = supabaseAdmin();

  const ingredients = draft.ingredients
    .filter((r) => r.item_text.trim().length > 0)
    .map((r, idx) => ({ sub_header: r.sub_header.trim() || null, item_text: r.item_text.trim(), sort_order: idx }));

  const instructions = draft.instructions
    .filter((r) => r.body.trim().length > 0)
    .map((r, idx) => ({ sub_header: r.sub_header.trim() || null, body: r.body.trim(), sort_order: idx }));

  // Dedupe (trim + lowercase) and slugify in TS, exactly as syncTags does;
  // the RPC find-or-creates each tag atomically.
  const tagNames = Array.from(
    new Set(draft.tags.map((t) => t.trim()).filter(Boolean).map((t) => t.toLowerCase())),
  );
  const tags = tagNames.map((name) => ({ slug: slugify(name), name }));

  const { data: types } = await db.from('family_photo_occasion_types').select('slug');
  const valid = new Set((types ?? []).map((t) => t.slug));
  const occasions = normalizeOccasionSlugs(draft.occasion_slugs ?? [], valid);

  // Source photos first, then dish; sort_order is the running index across
  // both lists — matches the per-statement path.
  type PhotoRow = { storage_path: string; url: string; thumb_path: string | null; caption: string | null; photo_type: 'source' | 'dish'; sort_order: number };
  const photos: PhotoRow[] = [];
  let order = 0;
  for (const p of draft.source_photos ?? []) {
    photos.push({ storage_path: p.storage_path, url: p.public_url, thumb_path: p.thumb_path ?? null, caption: p.caption ?? null, photo_type: 'source', sort_order: order++ });
  }
  for (const p of draft.dish_photos ?? []) {
    photos.push({ storage_path: p.storage_path, url: p.public_url, thumb_path: p.thumb_path ?? null, caption: p.caption ?? null, photo_type: 'dish', sort_order: order++ });
  }

  const { error } = await db.rpc('replace_recipe_children', {
    p_recipe_id:      recipeId,
    p_contributor_id: contributorId,
    p_ingredients:    ingredients,
    p_instructions:   instructions,
    p_tags:           tags,
    p_occasions:      occasions,
    p_photos:         photos,
  });
  if (!error) return null;

  if (isMissingRpc(error)) {
    console.warn('replace_recipe_children RPC unavailable; using per-statement sync fallback.');
    return syncChildrenFallback(recipeId, contributorId, draft);
  }
  console.error('recipe sync (rpc) failed:', recipeId, error.message);
  return 'sync_failed';
}

// Per-statement fallback (the pre-RPC behavior from PR #4): each sync
// rebuilds its table and throws on error; allSettled so one failure doesn't
// abort its siblings. Used only until the 0035 migration is applied.
async function syncChildrenFallback(
  recipeId: string,
  contributorId: string,
  draft: RecipeDraft,
): Promise<string | null> {
  const results = await Promise.allSettled([
    syncIngredients(recipeId, draft.ingredients),
    syncInstructions(recipeId, draft.instructions),
    syncTags(recipeId, draft.tags),
    syncOccasions(recipeId, draft.occasion_slugs ?? []),
    syncPhotos(recipeId, contributorId, draft.source_photos ?? [], draft.dish_photos ?? []),
  ]);
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed.length > 0) {
    for (const f of failed) {
      console.error('recipe sync failed:', recipeId, (f.reason as Error)?.message ?? f.reason);
    }
    return 'sync_failed';
  }
  return null;
}

async function notifyAdminOfSubmission(args: {
  recipeId: string;
  title:    string;
  contributorName: string;
}) {
  const apiKey      = process.env.RESEND_API_KEY;
  const adminEmail  = process.env.ADMIN_EMAIL;
  const fromAddress = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  const base        = process.env.NEXTAUTH_URL || FAMILY.baseUrl;
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
    .select('id, email, name, role, can_publish')
    .ilike('email', session.user.email)
    .maybeSingle();
  // role is a text column with a CHECK constraint enforcing the union.
  const contributor = contributorRow as unknown as ContributorRow | null;
  if (!contributor) return { ok: false, error: 'not_a_contributor' };

  const isAdmin   = contributor.role === 'admin';
  // can_publish is re-read from the DB at submit time — a client-passed flag
  // would not be trusted here. When true, a non-admin contributor's
  // submit_for_review action is promoted to direct publish below.
  const isTrustedToPublish = isAdmin || !!contributor.can_publish;
  if ((action === 'publish' || action === 'admin_save' || action === 'admin_reject' || action === 'unpublish') && !isAdmin) {
    return { ok: false, error: 'admin_only' };
  }

  // For actions that mutate an existing recipe we need an id.
  if ((action === 'admin_save' || action === 'admin_reject' || action === 'edit' || action === 'unpublish') && !draft.id) {
    return { ok: false, error: 'missing_recipe_id' };
  }

  // For 'edit', the caller must be admin OR the recipe's original contributor.
  if (action === 'edit' && !isAdmin && draft.id) {
    const { data: existing } = await db
      .from('recipes')
      .select('contributor_id')
      .eq('id', draft.id)
      .maybeSingle();
    if (!existing || existing.contributor_id !== contributor.id) {
      return { ok: false, error: 'not_recipe_owner' };
    }
  }

  // Validation. Auto-save (draft) is permissive; publish/submit/admin-save/edit are strict.
  // Reject and unpublish don't need full validation — we're not displaying the recipe publicly.
  const strict = action !== 'draft' && action !== 'admin_reject' && action !== 'unpublish';
  const title = draft.title.trim();
  if (strict && title.length < 2) return { ok: false, error: 'missing_title' };
  if (strict && !draft.primary_family_line_id) return { ok: false, error: 'missing_family_line' };
  if (strict && !draft.section_id) return { ok: false, error: 'missing_section' };

  // Attribution: use whatever the form picked (may be a stub). Falls back to
  // the signed-in user when nothing's picked.
  const contributorId = draft.contributor_id || contributor.id;

  // Look up current row state for admin_save / edit / unpublish — we preserve
  // status (for admin_save and edit) and published_at (for edit).
  let existingStatus: 'draft' | 'pending_review' | 'published' | 'rejected' = 'draft';
  let existingPublishedAt: string | null = null;
  let existingSlug: string | null = null;
  if (draft.id && (action === 'admin_save' || action === 'edit' || action === 'unpublish')) {
    const { data: existing } = await db
      .from('recipes')
      .select('status, published_at, slug')
      .eq('id', draft.id)
      .maybeSingle();
    existingStatus      = (existing?.status as typeof existingStatus) ?? 'draft';
    existingPublishedAt = existing?.published_at ?? null;
    existingSlug        = existing?.slug ?? null;
  }

  // Trusted contributors (admin OR can_publish=true) skip the review queue:
  // their submit_for_review action publishes immediately instead of landing
  // in pending_review.
  const nextStatus: 'draft' | 'pending_review' | 'published' | 'rejected' =
    action === 'publish' ? 'published'
    : action === 'submit_for_review' ? (isTrustedToPublish ? 'published' : 'pending_review')
    : action === 'admin_save' ? existingStatus
    : action === 'admin_reject' ? 'rejected'
    : action === 'edit' ? existingStatus
    : action === 'unpublish' ? 'draft'
    : 'draft';

  const slug = title ? await ensureUniqueSlug(title, draft.id) : null;

  // published_at: set on first publish; preserve on edits of a published row;
  // clear when unpublishing or moving away from published.
  let nextPublishedAt: string | null;
  if (nextStatus !== 'published') {
    nextPublishedAt = null;
  } else if (action === 'edit') {
    nextPublishedAt = existingPublishedAt ?? new Date().toISOString();
  } else if (action === 'publish' && existingPublishedAt) {
    nextPublishedAt = existingPublishedAt;
  } else {
    nextPublishedAt = new Date().toISOString();
  }

  const baseRow: Record<string, unknown> = {
    title:                    title || 'Untitled recipe',
    slug,
    contributor_id:           contributorId,
    originally_from:          draft.originally_from?.trim() || null,
    primary_family_line_id:   draft.primary_family_line_id ?? null,
    secondary_family_line_id: draft.secondary_family_line_id || null,
    section_id:               draft.section_id ?? null,
    story:                    draft.story?.trim() || null,
    status:                   nextStatus,
    published_at:             nextPublishedAt,
    kitchen_notes:            (draft.kitchen_notes ?? []).map((n) => n.trim()).filter(Boolean),
  };

  // Track who last edited the recipe (only on mutations that touch content).
  if (action === 'edit' || action === 'admin_save' || action === 'publish' || action === 'unpublish') {
    baseRow.last_edited_by_id = contributor.id;
    baseRow.last_edited_at    = new Date().toISOString();
  }

  let recipeId = draft.id;
  if (recipeId) {
    const { error } = await db.from('recipes').update(baseRow as RecipeUpdate).eq('id', recipeId);
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
      .insert(baseRow as RecipeInsert)
      .select('id')
      .single();
    if (error || !inserted) {
      console.error('recipe insert failed:', error);
      return { ok: false, error: 'db_insert_failed' };
    }
    recipeId = inserted.id;
  }

  // Skip child-table churn on pure reject / unpublish — no content changes.
  if (action !== 'admin_reject' && action !== 'unpublish') {
    const failReason = await syncRecipeChildren(recipeId!, contributor.id, draft);
    if (failReason) return { ok: false, error: failReason };
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
      title:           (baseRow.title as string),
      contributorName: contributor.name || contributor.email,
    });
  }

  // Bust the cached pages that show this recipe so the edit lands immediately.
  if (slug) revalidatePath(`/recipes/${slug}`);
  if (existingSlug && existingSlug !== slug) revalidatePath(`/recipes/${existingSlug}`);
  if (action === 'edit' || action === 'publish' || action === 'unpublish') {
    revalidatePath('/');
    revalidatePath('/recipes');
  }

  return { ok: true, recipeId: recipeId!, slug: slug ?? '', status: nextStatus };
}
