import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

export const PHOTO_BUCKET             = 'recipe-photos';
export const CONTRIBUTOR_PHOTO_BUCKET = 'contributor-photos';
export const FAMILY_PHOTO_BUCKET      = 'family-photos';

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
  | { kind: 'dish';   recipeId:  string }    // dishes/<recipeId>/<uuid>.ext
  // Bulk-imported originals, grouped under a named collection (e.g.
  // 'bulk_lucy' for the Aunt Lucy binder). Photos live alongside a recipe
  // they were attributed to, but they're filed in `sources/_<collection>/`
  // rather than the dishes/ tree so we can sweep them like other intake.
  | { kind: 'bulk';   collection: string; recipeId: string };

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
      : target.kind === 'bulk'
      ? `sources/_${target.collection}/${target.recipeId}/${uuid}.${ext}`
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

export function contributorPhotoUrl(storagePath: string): string {
  return client().storage.from(CONTRIBUTOR_PHOTO_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

// The family-photos bucket is PRIVATE (migration 0026) — the gallery it
// backs is sign-in-only, so the storage layer must not hand out permanent
// public URLs. Serving uses short-lived signed URLs instead of an
// auth-checked proxy because next/image's optimizer fetches sources
// server-side without the viewer's cookies: a cookie-gated proxy would 401
// those fetches, while a signed URL carries its own auth.
const SIGNED_URL_TTL_SECONDS = 4 * 60 * 60;
// Reuse a token for most of its life, refreshing well before expiry so a
// page cached moments before refresh still has a long-valid URL.
const SIGNED_URL_REUSE_MS = 3 * 60 * 60 * 1000;

const signedUrlCache = new Map<string, { url: string; createdAt: number }>();

/**
 * Batch-sign family-photo paths: ONE storage API call for all cache misses,
 * regardless of how many photos a page renders (the /album grid passes every
 * photo at once). The module-level cache keeps tokens stable across renders
 * within a warm server instance, so next/image's optimizer cache isn't
 * churned by a fresh token on every request.
 *
 * Paths whose object is missing (e.g. a rejected photo's deleted file) are
 * simply absent from the returned map.
 */
export async function familyPhotoSignedUrls(paths: string[]): Promise<Map<string, string>> {
  const now = Date.now();
  const out = new Map<string, string>();
  const missing: string[] = [];

  for (const p of new Set(paths)) {
    const hit = signedUrlCache.get(p);
    if (hit && now - hit.createdAt < SIGNED_URL_REUSE_MS) {
      out.set(p, hit.url);
    } else {
      missing.push(p);
    }
  }

  if (missing.length > 0) {
    const { data, error } = await client()
      .storage
      .from(FAMILY_PHOTO_BUCKET)
      .createSignedUrls(missing, SIGNED_URL_TTL_SECONDS);
    if (error) throw new Error(`Signing family photo URLs failed: ${error.message}`);
    for (const item of data ?? []) {
      if (item.error || !item.path || !item.signedUrl) continue;
      signedUrlCache.set(item.path, { url: item.signedUrl, createdAt: now });
      out.set(item.path, item.signedUrl);
    }
  }

  return out;
}

// List every object under sources/_inbox/. Storage's list API is shallow per
// folder, so we walk the per-session subfolders.
export async function listInboxObjects(): Promise<{ path: string; created_at: string }[]> {
  const c = client();
  const out: { path: string; created_at: string }[] = [];
  // First, list the per-session folders under sources/_inbox/.
  const { data: sessions, error: sessErr } = await c
    .storage
    .from(PHOTO_BUCKET)
    .list('sources/_inbox', { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (sessErr) throw new Error(`list sessions failed: ${sessErr.message}`);
  for (const folder of sessions ?? []) {
    // Each folder shows up as a row with id === null (Supabase folder convention).
    if (folder.id) continue;
    const { data: files, error: fileErr } = await c
      .storage
      .from(PHOTO_BUCKET)
      .list(`sources/_inbox/${folder.name}`, { limit: 1000 });
    if (fileErr) continue;
    for (const f of files ?? []) {
      if (!f.id) continue; // skip nested folders if any
      out.push({
        path:       `sources/_inbox/${folder.name}/${f.name}`,
        created_at: f.created_at ?? new Date(0).toISOString(),
      });
    }
  }
  return out;
}

export async function deletePhotoPaths(paths: string[]): Promise<{ deleted: number; failed: string[] }> {
  if (paths.length === 0) return { deleted: 0, failed: [] };
  const c = client();
  // Supabase's remove() accepts a batch.
  const { data, error } = await c.storage.from(PHOTO_BUCKET).remove(paths);
  if (error) return { deleted: 0, failed: paths };
  const deleted = (data ?? []).length;
  return { deleted, failed: [] };
}
