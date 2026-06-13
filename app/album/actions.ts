'use server';

import { revalidatePath } from 'next/cache';
import crypto from 'node:crypto';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { canDeleteComment, canPostComment, type CommentViewer } from '@/lib/recipes/comment-permissions';
import { fetchReviewedPhotosPage, type FamilyPhotoFull } from '@/lib/queries/family-photos';

const FAMILY_PHOTO_BUCKET = 'family-photos';

export type HeroToggleResult = { ok: true; heroEligible: boolean } | { ok: false; error: string };

/** Admin-only: opt a photo in or out of the PUBLIC home-page hero rotation.
 *  Explicit per-photo consent is the privacy boundary — the album is
 *  sign-in-only, the home page is not. */
export async function setHeroEligible(photoId: string, eligible: boolean): Promise<HeroToggleResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    return { ok: false, error: 'not_authorized' };
  }

  const db = supabaseAdmin();
  const { error } = await db
    .from('family_photos')
    .update({ hero_eligible: eligible })
    .eq('id', photoId);
  if (error) {
    console.error('setHeroEligible failed:', error);
    return { ok: false, error: 'update_failed' };
  }

  revalidatePath('/');
  revalidatePath('/album');
  return { ok: true, heroEligible: eligible };
}

export type PhotoEditResult = { ok: true } | { ok: false; error: string };

/** Admin-only: crop and/or rotate an album photo, non-destructively.
 *  The edited pixels go to a fresh file under edited/; storage_path swaps
 *  to it and the FIRST edit records the prior path in original_storage_path
 *  so the untouched original can always be recovered.
 *
 *  `cropPixels` comes from the client cropper in the coordinates of the
 *  ROTATED image (react-easy-crop applies its rotation prop before
 *  reporting the area), so the server applies rotate first, then extract —
 *  matching what the admin saw. autoOrient() runs first so EXIF-oriented
 *  phone uploads behave: the pixels are normalized to how browsers display
 *  them before any math happens. */
export async function applyPhotoEdits(
  photoId: string,
  edits: {
    rotation: 0 | 90 | 180 | 270;
    cropPixels: { x: number; y: number; width: number; height: number } | null;
  },
): Promise<PhotoEditResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    return { ok: false, error: 'not_authorized' };
  }
  if (edits.rotation === 0 && !edits.cropPixels) {
    return { ok: false, error: 'nothing_to_apply' };
  }

  const db = supabaseAdmin();
  const { data: row, error: rowErr } = await db
    .from('family_photos')
    .select('storage_path, original_storage_path')
    .eq('id', photoId)
    .maybeSingle();
  if (rowErr || !row) return { ok: false, error: 'photo_not_found' };

  const dl = await db.storage.from(FAMILY_PHOTO_BUCKET).download(row.storage_path);
  if (dl.error || !dl.data) return { ok: false, error: 'download_failed' };
  const input = Buffer.from(await dl.data.arrayBuffer());

  let output: Buffer;
  try {
    const { default: sharp } = await import('sharp');
    let pipeline = sharp(input).autoOrient();
    if (edits.rotation !== 0) pipeline = pipeline.rotate(edits.rotation);
    if (edits.cropPixels) {
      const c = edits.cropPixels;
      const rect = {
        left:   Math.max(0, Math.round(c.x)),
        top:    Math.max(0, Math.round(c.y)),
        width:  Math.round(c.width),
        height: Math.round(c.height),
      };
      if (rect.width < 20 || rect.height < 20) {
        return { ok: false, error: 'crop_too_small' };
      }
      pipeline = pipeline.extract(rect);
    }
    output = await pipeline.jpeg({ quality: 92 }).toBuffer();
  } catch (err) {
    // HEIC originals can't be decoded by sharp's prebuilt binaries; bad
    // crop rects land here too. Surface it instead of silently failing.
    console.error('applyPhotoEdits: processing failed', err);
    return { ok: false, error: 'processing_failed' };
  }

  const newPath = `edited/${crypto.randomUUID()}.jpg`;
  const up = await db.storage.from(FAMILY_PHOTO_BUCKET).upload(newPath, output, {
    contentType: 'image/jpeg',
    upsert:      false,
  });
  if (up.error) return { ok: false, error: 'upload_failed' };

  // Only set original_storage_path on the FIRST edit so it always points
  // at the truly untouched file (same rule as the review-queue rotation).
  const update: { storage_path: string; original_storage_path?: string } = {
    storage_path: newPath,
  };
  if (!row.original_storage_path) {
    update.original_storage_path = row.storage_path;
  }
  const upd = await db.from('family_photos').update(update).eq('id', photoId);
  if (upd.error) {
    await db.storage.from(FAMILY_PHOTO_BUCKET).remove([newPath]);
    return { ok: false, error: 'update_failed' };
  }

  revalidatePath('/');
  revalidatePath('/album');
  return { ok: true };
}


const MAX_COMMENT_LENGTH = 2000;

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

export type PhotoDetailsResult = { ok: true } | { ok: false; error: string };

/** Admin-only: fix a photo's caption / year / place after review. */
export async function updatePhotoDetails(
  photoId: string,
  details: {
    caption: string;
    year: string;
    place: string;
    /** 'contributor:<id>' | 'family_member:<id>' — replaces the photo's people tags. */
    personRefs: string[];
    occasionSlugs: string[];
  },
): Promise<PhotoDetailsResult> {
  // Admin, or a contributor with the photo-editor capability (re-read from
  // the DB — never trusted from the client).
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return { ok: false, error: 'not_authorized' };
  const isAdmin = session?.user?.role === 'admin';
  if (!isAdmin) {
    const { data: row } = await supabaseAdmin()
      .from('contributors')
      .select('can_edit_photos')
      .ilike('email', email)
      .maybeSingle();
    if (!row?.can_edit_photos) return { ok: false, error: 'not_authorized' };
  }
  const db = supabaseAdmin();
  const trimmed = (v: string) => v.trim() || null;
  const { error } = await db
    .from('family_photos')
    .update({ caption: trimmed(details.caption), year: trimmed(details.year), place: trimmed(details.place) })
    .eq('id', photoId);
  if (error) {
    console.error('updatePhotoDetails failed:', error);
    return { ok: false, error: 'update_failed' };
  }

  // Replace people tags (same shape the review queue writes).
  await db.from('family_photo_people').delete().eq('family_photo_id', photoId);
  const peopleRows = details.personRefs
    .map((ref) => {
      const [type, id] = ref.split(':');
      if (type === 'contributor')   return { family_photo_id: photoId, person_type: 'contributor', contributor_id: id, family_member_id: null };
      if (type === 'family_member') return { family_photo_id: photoId, person_type: 'family_member', contributor_id: null, family_member_id: id };
      return null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (peopleRows.length > 0) {
    const { error: pErr } = await db.from('family_photo_people').insert(peopleRows);
    if (pErr) { console.error('updatePhotoDetails people failed:', pErr); return { ok: false, error: 'people_failed' }; }
  }

  // Replace occasions (FK to the canonical types guards unknown slugs).
  await db.from('family_photo_occasions').delete().eq('family_photo_id', photoId);
  if (details.occasionSlugs.length > 0) {
    const rows = [...new Set(details.occasionSlugs)].map((occasion_slug) => ({ family_photo_id: photoId, occasion_slug }));
    const { error: oErr } = await db.from('family_photo_occasions').insert(rows);
    if (oErr) { console.error('updatePhotoDetails occasions failed:', oErr); return { ok: false, error: 'occasions_failed' }; }
  }

  revalidatePath('/album');
  revalidatePath('/');
  return { ok: true };
}

export type AddPhotoCommentResult =
  | { ok: true; commentId: string }
  | { ok: false; error: 'unauthorized' | 'cannot_post' | 'invalid_body' | 'photo_not_found' | 'insert_failed' };

/** Post a memory on a photo — same rules as recipe memories: any signed-in
 *  contributor with can_sign_in can post; only the commenter's permission
 *  matters. */
export async function addPhotoComment(input: { photoId: string; body: string }): Promise<AddPhotoCommentResult> {
  const viewer = await resolveViewer();
  if (!viewer) return { ok: false, error: 'unauthorized' };
  if (!canPostComment(viewer)) return { ok: false, error: 'cannot_post' };
  const body = (input.body ?? '').trim();
  if (body.length === 0 || body.length > MAX_COMMENT_LENGTH) return { ok: false, error: 'invalid_body' };

  const db = supabaseAdmin();
  const { data: photo } = await db.from('family_photos').select('id').eq('id', input.photoId).maybeSingle();
  if (!photo) return { ok: false, error: 'photo_not_found' };

  const { data: inserted, error } = await db
    .from('family_photo_comments')
    .insert({ family_photo_id: input.photoId, author_contributor_id: viewer.contributorId!, body })
    .select('id')
    .single();
  if (error || !inserted) return { ok: false, error: 'insert_failed' };
  revalidatePath('/album');
  return { ok: true, commentId: inserted.id };
}

export type DeletePhotoCommentResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'forbidden' | 'comment_not_found' | 'delete_failed' };

export async function deletePhotoComment(commentId: string): Promise<DeletePhotoCommentResult> {
  const viewer = await resolveViewer();
  if (!viewer) return { ok: false, error: 'unauthorized' };

  const db = supabaseAdmin();
  const { data: comment } = await db
    .from('family_photo_comments')
    .select('id, author_contributor_id')
    .eq('id', commentId)
    .maybeSingle();
  if (!comment) return { ok: false, error: 'comment_not_found' };
  if (!canDeleteComment(viewer, { authorContributorId: comment.author_contributor_id })) {
    return { ok: false, error: 'forbidden' };
  }
  const { error } = await db.from('family_photo_comments').delete().eq('id', commentId);
  if (error) return { ok: false, error: 'delete_failed' };
  revalidatePath('/album');
  return { ok: true };
}

export type LoadAlbumPhotosResult =
  | { ok: true; photos: FamilyPhotoFull[] }
  | { ok: false; error: 'unauthorized' };

/** Background pages for the album grid. The album is sign-in-only, so the
 *  action re-checks the session — the page-level redirect doesn't protect
 *  a directly invoked server action. */
export async function loadAlbumPhotos(offset: number): Promise<LoadAlbumPhotosResult> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, error: 'unauthorized' };
  const photos = await fetchReviewedPhotosPage(Math.max(0, Math.floor(offset)));
  return { ok: true, photos };
}
