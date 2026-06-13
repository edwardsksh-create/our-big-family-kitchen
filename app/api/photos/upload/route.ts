import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { auth } from '@/auth';
import {
  uploadPhoto,
  type UploadKind,
  type StoredPhoto,
  ALLOWED_MIME_TYPES,
  MAX_PHOTO_BYTES,
  UnsupportedImageError,
} from '@/lib/storage/photos';

export const maxDuration = 60;
export const dynamic     = 'force-dynamic';

// Receives a multipart form with one or more files under the field "photos"
// and a "kind" of 'source' or 'dish'. For 'dish' uploads, a "recipe_id" must
// be present (we organise dish photos by recipe). For 'source' uploads we
// generate a session id so multiple photos for the same intake land in one
// folder before a recipe row exists.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'bad_form' }, { status: 400 });
  }

  const kindRaw = (form.get('kind') ?? 'source').toString();
  if (kindRaw !== 'source' && kindRaw !== 'dish') {
    return NextResponse.json({ error: 'bad_kind' }, { status: 400 });
  }
  const kind: UploadKind = kindRaw;

  let recipeId: string | undefined;
  if (kind === 'dish') {
    recipeId = (form.get('recipe_id') ?? '').toString();
    if (!recipeId) {
      return NextResponse.json({ error: 'missing_recipe_id' }, { status: 400 });
    }
  }

  const sessionId = (form.get('session_id') ?? '').toString() || crypto.randomUUID();

  const files = form.getAll('photos').filter((v): v is File => v instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: 'no_photos' }, { status: 400 });
  }
  if (files.length > 10) {
    return NextResponse.json({ error: 'too_many' }, { status: 400 });
  }

  const uploaded: StoredPhoto[] = [];
  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'unsupported_type', message: `Type ${file.type} not allowed.` },
        { status: 415 },
      );
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return NextResponse.json(
        { error: 'too_large', message: `${file.name} exceeds ${MAX_PHOTO_BYTES} bytes.` },
        { status: 413 },
      );
    }
    const bytes = await file.arrayBuffer();
    const target =
      kind === 'source'
        ? ({ kind: 'source' as const, sessionId })
        : ({ kind: 'dish'   as const, recipeId: recipeId! });
    try {
      const stored = await uploadPhoto(bytes, file.type, target);
      uploaded.push(stored);
    } catch (err) {
      // uploadPhoto byte-sniffs the file; a forged or corrupt "image" is the
      // sender's fault, not a server error.
      if (err instanceof UnsupportedImageError) {
        return NextResponse.json(
          { error: 'unsupported_type', message: `${file.name} isn't a readable image.` },
          { status: 415 },
        );
      }
      console.error('photo upload failed', err);
      return NextResponse.json(
        { error: 'upload_failed', message: (err as Error).message },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true, session_id: sessionId, photos: uploaded });
}
