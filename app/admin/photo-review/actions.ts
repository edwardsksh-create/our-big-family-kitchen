'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dedupeOccasion } from '@/lib/photos/occasions';

type SubmitPayload = {
  photoId:          string;
  caption:          string;
  year:             string;
  place:            string;
  additionalPeople: string;
  pets:             string;
  occasionSlugs:    string[];
  // person rows: format 'contributor:<id>' or 'family_member:<id>'
  personRefs:       string[];
  recipeIds:        string[];
  intent:           'save_and_next' | 'skip' | 'not_for_archive' | 'reject' | 'delete' | 'done';
  /** When set, the post-action redirect carries the queue filter forward
   *  so admin batch-processing family submissions stays on that filter. */
  filterSource?:    'family' | null;
};

const FAMILY_PHOTO_BUCKET = 'family-photos';

export async function submitPhotoReview(payload: SubmitPayload): Promise<void> {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    throw new Error('Not authorized.');
  }

  const db = supabaseAdmin();
  const trimmed = (s: string) => s.trim() || null;

  // Preserve any active queue filter through redirects so admin can keep
  // batch-processing one source.
  const filterQuery = payload.filterSource === 'family' ? '?source=family' : '';
  const nextUrl = `/admin/photo-review${filterQuery}`;

  if (payload.intent === 'done') {
    redirect('/admin');
  }

  if (payload.intent === 'not_for_archive') {
    await db
      .from('family_photos')
      .update({ not_for_archive: true })
      .eq('id', payload.photoId);
    revalidatePath('/admin/photo-review');
    redirect(nextUrl);
  }

  if (payload.intent === 'delete') {
    // Hard delete for a photo that shouldn't have been imported at all.
    // Unlike 'reject' (which keeps the row as an audit trail of a declined
    // submission), this removes the file bytes AND the row — the child
    // rows (people, occasions, recipe links, comments) all cascade. Both
    // storage paths go: storage_path may be an edited copy, with the
    // pre-edit original at original_storage_path.
    const { data: existing } = await db
      .from('family_photos')
      .select('storage_path, original_storage_path')
      .eq('id', payload.photoId)
      .maybeSingle();
    const doomedPaths = [existing?.storage_path, existing?.original_storage_path]
      .filter((p): p is string => !!p);
    if (doomedPaths.length > 0) {
      const { error: rmErr } = await db.storage.from(FAMILY_PHOTO_BUCKET).remove(doomedPaths);
      if (rmErr) throw new Error(`delete: removing photo files failed: ${rmErr.message}`);
    }
    const { error: delErr } = await db.from('family_photos').delete().eq('id', payload.photoId);
    if (delErr) throw new Error(`delete: removing photo row failed: ${delErr.message}`);
    revalidatePath('/admin/photo-review');
    redirect(nextUrl);
  }

  if (payload.intent === 'reject') {
    // Rejection on a family submission: delete the stored file(s), then mark
    // not_for_archive so the row is excluded from both the queue and /album.
    // BOTH paths must go — if the photo was rotated before rejection,
    // storage_path points at the rotated copy and original_storage_path
    // still holds the pre-rotation original. The bucket is private now
    // (migration 0026), but a rejected photo's bytes shouldn't linger at
    // all. We keep the row (audit trail) rather than hard-deleting it.
    // The uploader is never notified — quiet decline by design.
    const { data: existing } = await db
      .from('family_photos')
      .select('storage_path, original_storage_path')
      .eq('id', payload.photoId)
      .maybeSingle();
    const doomedPaths = [existing?.storage_path, existing?.original_storage_path]
      .filter((p): p is string => !!p);
    if (doomedPaths.length > 0) {
      const { error: rmErr } = await db.storage.from(FAMILY_PHOTO_BUCKET).remove(doomedPaths);
      if (rmErr) throw new Error(`reject: deleting photo files failed: ${rmErr.message}`);
    }
    await db
      .from('family_photos')
      .update({ not_for_archive: true })
      .eq('id', payload.photoId);
    revalidatePath('/admin/photo-review');
    redirect(nextUrl);
  }

  if (payload.intent === 'skip') {
    // Just navigate forward — leave reviewed=false. Skipping a single photo
    // wouldn't normally need a write, but we bump uploaded_at to push it to
    // the end of the queue so the reviewer doesn't see it next.
    await db
      .from('family_photos')
      .update({ uploaded_at: new Date().toISOString() })
      .eq('id', payload.photoId);
    revalidatePath('/admin/photo-review');
    redirect(nextUrl);
  }

  // intent === 'save_and_next'
  const update = {
    caption:           trimmed(payload.caption),
    year:              trimmed(payload.year),
    place:             trimmed(payload.place),
    additional_people: trimmed(payload.additionalPeople),
    pets:              trimmed(payload.pets),
    reviewed:          true,
  };
  await db.from('family_photos').update(update).eq('id', payload.photoId);

  // Replace people / occasions / recipes (idempotent re-saves).
  await db.from('family_photo_people').delete().eq('family_photo_id', payload.photoId);
  if (payload.personRefs.length > 0) {
    const peopleRows = payload.personRefs.map((ref) => {
      const [type, id] = ref.split(':');
      if (type === 'contributor')   return { family_photo_id: payload.photoId, person_type: 'contributor', contributor_id: id, family_member_id: null };
      if (type === 'family_member') return { family_photo_id: payload.photoId, person_type: 'family_member', contributor_id: null, family_member_id: id };
      throw new Error(`Bad person ref: ${ref}`);
    });
    const { error } = await db.from('family_photo_people').insert(peopleRows);
    if (error) throw new Error(`save people: ${error.message}`);
  }

  await db.from('family_photo_occasions').delete().eq('family_photo_id', payload.photoId);
  if (payload.occasionSlugs.length > 0) {
    const rows = payload.occasionSlugs.map((slug) => ({ family_photo_id: payload.photoId, occasion_slug: slug }));
    const { error } = await db.from('family_photo_occasions').insert(rows);
    if (error) throw new Error(`save occasions: ${error.message}`);
  }

  await db.from('family_photo_recipes').delete().eq('family_photo_id', payload.photoId);
  if (payload.recipeIds.length > 0) {
    const rows = payload.recipeIds.map((id) => ({ family_photo_id: payload.photoId, recipe_id: id }));
    const { error } = await db.from('family_photo_recipes').insert(rows);
    if (error) throw new Error(`save recipes: ${error.message}`);
  }

  revalidatePath('/admin/photo-review');
  redirect(nextUrl);
}

export type CreateOccasionResult =
  | { ok: true;  slug: string; name: string; created: boolean }
  | { ok: false; reason: 'unauthorized' | 'invalid' };

/**
 * Add a new reusable occasion type from the photo-review form. Trims, slugifies,
 * and case-insensitively dedupes against existing occasions; returns the
 * existing entry rather than inserting a duplicate when a match is found.
 * Admin-only.
 */
export async function createOccasionType(rawName: string): Promise<CreateOccasionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    return { ok: false, reason: 'unauthorized' };
  }

  const db = supabaseAdmin();
  const { data: existing } = await db
    .from('family_photo_occasion_types')
    .select('slug, name, sort_order');

  const outcome = dedupeOccasion(rawName, (existing ?? []).map((e) => ({ slug: e.slug, name: e.name })));
  if (outcome.kind === 'invalid') return { ok: false, reason: 'invalid' };
  if (outcome.kind === 'existing') {
    return { ok: true, slug: outcome.slug, name: outcome.name, created: false };
  }

  // Brand new — sort it to the end of the list.
  const maxSort = (existing ?? []).reduce((m, e) => Math.max(m, e.sort_order ?? 0), 0);
  const { error } = await db.from('family_photo_occasion_types').insert({
    slug:       outcome.slug,
    name:       outcome.name,
    sort_order: maxSort + 1,
  });
  if (error) {
    // Unique-violation race (someone else inserted concurrently) is benign —
    // fall back to the existing row.
    if (error.code === '23505') {
      return { ok: true, slug: outcome.slug, name: outcome.name, created: false };
    }
    throw new Error(`create occasion: ${error.message}`);
  }
  revalidatePath('/admin/photo-review');
  revalidatePath('/album');
  return { ok: true, slug: outcome.slug, name: outcome.name, created: true };
}
