import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  canUploadToAlbum,
  FAMILY_PHOTO_ALLOWED_MIME,
  MAX_FAMILY_PHOTO_BYTES,
  MAX_FAMILY_PHOTOS_PER_SUBMIT,
} from '@/lib/photos/album-submit';
import { generateFamilyPhotoHints, type FamilyPhotoHints } from '@/lib/photos/family-photo-hints';
import { sniffImage } from '@/lib/photos/sniff-image';
import { slugify } from '@/lib/utils';

// Family submissions go through the same review queue as the bulk archive.
// 90s budget covers a handful of AI-hint calls in a single submission;
// the route is dynamic per request since it mutates storage + DB.
export const maxDuration = 90;
export const dynamic     = 'force-dynamic';

const FAMILY_PHOTO_BUCKET = 'family-photos';

function extensionFor(mime: string): string {
  switch (mime) {
    case 'image/jpeg': return 'jpg';
    case 'image/png':  return 'png';
    case 'image/webp': return 'webp';
    case 'image/heic': return 'heic';
    default:           return 'bin';
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { data: viewerRow } = await db
    .from('contributors')
    .select('id, name, can_sign_in')
    .ilike('email', session.user.email)
    .maybeSingle();

  if (!viewerRow) {
    return NextResponse.json({ error: 'not_a_contributor' }, { status: 403 });
  }
  const viewer = {
    isSignedIn:    true,
    contributorId: viewerRow.id,
    canSignIn:     !!viewerRow.can_sign_in,
  };
  if (!canUploadToAlbum(viewer)) {
    return NextResponse.json({ error: 'cannot_upload' }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'bad_form' }, { status: 400 });
  }

  const note = ((form.get('note') ?? '').toString().trim() || null);
  const files = form.getAll('photos').filter((v): v is File => v instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: 'no_photos' }, { status: 400 });
  }
  if (files.length > MAX_FAMILY_PHOTOS_PER_SUBMIT) {
    return NextResponse.json(
      { error: 'too_many', message: `Up to ${MAX_FAMILY_PHOTOS_PER_SUBMIT} photos per submission.` },
      { status: 400 },
    );
  }

  // Validate every file before we start storing anything — fail fast and we
  // don't end up with a half-uploaded batch.
  for (const f of files) {
    if (!FAMILY_PHOTO_ALLOWED_MIME.has(f.type)) {
      return NextResponse.json(
        { error: 'unsupported_type', message: `${f.name}: ${f.type} isn't an accepted image type.` },
        { status: 415 },
      );
    }
    if (f.size > MAX_FAMILY_PHOTO_BYTES) {
      return NextResponse.json(
        { error: 'too_large', message: `${f.name} is over the 15 MB limit.` },
        { status: 413 },
      );
    }
  }

  const uploaderSlug = slugify(viewerRow.name || session.user.email.split('@')[0] || 'contributor');
  const created: { id: string; storage_path: string }[] = [];

  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());

    // The client's MIME type was only a hint — the bytes decide what this
    // is, and the sniffed type drives the extension and stored contentType.
    const sniff = await sniffImage(buf);
    if (!sniff.ok || !FAMILY_PHOTO_ALLOWED_MIME.has(sniff.mime)) {
      return NextResponse.json(
        { error: 'unsupported_type', message: `${file.name} isn't a readable image.` },
        { status: 415 },
      );
    }

    const uuid = crypto.randomUUID();
    const ext  = extensionFor(sniff.mime);
    const storagePath = `submissions/${uploaderSlug}/${uuid}.${ext}`;

    // 1) Upload to storage.
    const { error: upErr } = await db.storage
      .from(FAMILY_PHOTO_BUCKET)
      .upload(storagePath, buf, { contentType: sniff.mime, upsert: false });
    if (upErr) {
      console.error('family upload — storage failed:', upErr);
      return NextResponse.json(
        { error: 'upload_failed', message: upErr.message },
        { status: 500 },
      );
    }

    // AI vision hints are OFF — Kate reviews without them, and they were
    // the largest unmetered AI spend (one Sonnet vision call per uploaded
    // photo). Re-enable here if they ever earn their keep.
    const aiHints: FamilyPhotoHints | null = null;

    // 3) Insert family_photos row. reviewed=false keeps it out of /album
    //    until Kate approves; source='family' distinguishes from imports.
    const { data: inserted, error: insErr } = await db
      .from('family_photos')
      .insert({
        storage_path:   storagePath,
        uploaded_by_id: viewer.contributorId!,
        submitter_note: note,
        source:         'family',
        reviewed:       false,
        ai_hints:       aiHints,
      })
      .select('id')
      .single();

    if (insErr || !inserted) {
      console.error('family upload — insert failed:', insErr);
      // Roll back the storage object so we don't leak orphan files.
      await db.storage.from(FAMILY_PHOTO_BUCKET).remove([storagePath]);
      return NextResponse.json(
        { error: 'db_insert_failed', message: insErr?.message ?? 'insert failed' },
        { status: 500 },
      );
    }
    created.push({ id: inserted.id, storage_path: storagePath });
  }

  return NextResponse.json({ ok: true, count: created.length, photos: created });
}
