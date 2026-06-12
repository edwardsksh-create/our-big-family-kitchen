'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import sharp from 'sharp';
import crypto from 'node:crypto';
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
  needsEditing:     boolean;
  editingNote:      string;
  /** Clockwise rotation in degrees to apply on Save. Only honored when
   *  intent === 'save_and_next'; other intents discard the rotation. */
  rotation?:        0 | 90 | 180 | 270;
  intent:           'save_and_next' | 'skip' | 'not_for_archive' | 'reject' | 'done';
  /** When set, the post-action redirect carries the queue filter forward
   *  so admin batch-processing family submissions stays on that filter. */
  filterSource?:    'family' | null;
};

const FAMILY_PHOTO_BUCKET = 'family-photos';

/**
 * Apply a clockwise rotation to a family photo non-destructively: download
 * the current bytes, rotate via sharp, write the result to a fresh path
 * under rotated/, then swap the row's storage_path. The first time a row
 * is rotated, the prior path is recorded in original_storage_path so the
 * truly-untouched original can be recovered. On subsequent rotations the
 * truly-original pointer is preserved (we rotate against the most-recent
 * rotated version so the admin's preview matches what they're saving).
 */
async function applyRotation(photoId: string, rotation: 90 | 180 | 270): Promise<void> {
  const db = supabaseAdmin();
  const { data: row, error: rowErr } = await db
    .from('family_photos')
    .select('storage_path, original_storage_path')
    .eq('id', photoId)
    .maybeSingle();
  if (rowErr || !row) throw new Error(`load photo for rotation: ${rowErr?.message ?? 'not found'}`);

  const dl = await db.storage.from(FAMILY_PHOTO_BUCKET).download(row.storage_path);
  if (dl.error || !dl.data) throw new Error(`download for rotation: ${dl.error?.message ?? 'no data'}`);
  const inputBytes = Buffer.from(await dl.data.arrayBuffer());

  const outputBytes = await sharp(inputBytes)
    .rotate(rotation)
    .jpeg({ quality: 92 })
    .toBuffer();

  const newPath = `rotated/${crypto.randomUUID()}.jpg`;
  const up = await db.storage.from(FAMILY_PHOTO_BUCKET).upload(newPath, outputBytes, {
    contentType: 'image/jpeg',
    upsert:      false,
  });
  if (up.error) throw new Error(`upload rotated: ${up.error.message}`);

  // Only set original_storage_path on the FIRST rotation, so it always
  // points at the truly untouched file. Subsequent rotations leave it.
  const update: { storage_path: string; original_storage_path?: string } = {
    storage_path: newPath,
  };
  if (!row.original_storage_path) {
    update.original_storage_path = row.storage_path;
  }
  const upd = await db.from('family_photos').update(update).eq('id', photoId);
  if (upd.error) throw new Error(`update storage_path: ${upd.error.message}`);
}

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
    needs_editing:     payload.needsEditing,
    // Clear the note when the flag is off, so we don't carry over stale text.
    editing_note:      payload.needsEditing ? trimmed(payload.editingNote) : null,
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
