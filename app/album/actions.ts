'use server';

import { revalidatePath } from 'next/cache';
import crypto from 'node:crypto';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

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
