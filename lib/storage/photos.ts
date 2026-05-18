import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

export const PHOTO_BUCKET = 'recipe-photos';

// Cap matches the bucket's file_size_limit (10 MB). Enforced server-side.
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
]);

type ServiceClient = ReturnType<typeof createClient>;

let _client: ServiceClient | undefined;
function client(): ServiceClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env for storage upload.');
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

function publicUrlFor(storagePath: string): string {
  return client().storage.from(PHOTO_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

export type StoredPhoto = {
  storage_path: string;
  public_url:   string;
  size_bytes:   number;
  mime_type:    string;
};

export type UploadKind = 'source' | 'dish';

export type UploadTarget =
  | { kind: 'source'; sessionId: string }    // sources/_inbox/<session>/<uuid>.ext
  | { kind: 'dish';   recipeId:  string };   // dishes/<recipeId>/<uuid>.ext

function extensionFor(mime: string): string {
  switch (mime) {
    case 'image/jpeg': return 'jpg';
    case 'image/png':  return 'png';
    case 'image/heic': return 'heic';
    case 'image/webp': return 'webp';
    default:           return 'bin';
  }
}

export async function uploadPhoto(
  file: ArrayBuffer | Buffer,
  mimeType: string,
  target: UploadTarget,
): Promise<StoredPhoto> {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Unsupported image type: ${mimeType}`);
  }
  const bytes = file instanceof Buffer ? file : Buffer.from(file);
  if (bytes.byteLength > MAX_PHOTO_BYTES) {
    throw new Error(`Photo too large (${bytes.byteLength} bytes; max ${MAX_PHOTO_BYTES}).`);
  }

  const uuid = crypto.randomUUID();
  const ext  = extensionFor(mimeType);
  const storagePath =
    target.kind === 'source'
      ? `sources/_inbox/${target.sessionId}/${uuid}.${ext}`
      : `dishes/${target.recipeId}/${uuid}.${ext}`;

  const { error } = await client()
    .storage
    .from(PHOTO_BUCKET)
    .upload(storagePath, bytes, {
      contentType: mimeType,
      upsert:      false,
    });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  return {
    storage_path: storagePath,
    public_url:   publicUrlFor(storagePath),
    size_bytes:   bytes.byteLength,
    mime_type:    mimeType,
  };
}

export async function deletePhotoByPath(storagePath: string): Promise<void> {
  await client().storage.from(PHOTO_BUCKET).remove([storagePath]);
}

export function publicUrl(storagePath: string): string {
  return publicUrlFor(storagePath);
}
