// Mirror the image buckets into the private photo-backups bucket
// (security gate item 6). Pure-ish logic over a minimal storage interface so
// it's unit-testable without real Supabase storage; the cron route injects
// the real client.
//
// Design notes:
//   * Recursive listing — the photo buckets nest (dishes/<id>/…, sources/…,
//     thumbs/…, submissions/…), and .list() only returns one level.
//   * Copy is server-side (destinationBucket) — no bytes flow through the
//     function. An object that already exists at the destination is skipped
//     (copy() errors with a duplicate; we treat that as "already mirrored").
//   * Idempotent + incremental: safe to re-run, and a run that times out
//     mid-way is simply continued by the next one. Source object paths are
//     effectively immutable (edits write new paths), so copy-if-absent is
//     sufficient for the irreplaceable originals.

export const PHOTO_SOURCE_BUCKETS = [
  'recipe-photos',
  'family-photos',
  'contributor-photos',
] as const;

export const PHOTO_BACKUP_BUCKET = 'photo-backups';

// .list() page size. Supabase caps a single list call; we paginate.
const LIST_PAGE = 100;

// The minimal slice of the Supabase storage client this module needs —
// lets tests pass a fake.
export type StorageEntry = { name: string; id: string | null };
export type StorageBucketApi = {
  list(
    path: string,
    opts: { limit: number; offset: number },
  ): Promise<{ data: StorageEntry[] | null; error: { message: string } | null }>;
  copy(
    from: string,
    to: string,
    opts: { destinationBucket: string },
  ): Promise<{ error: { message: string } | null }>;
};
export type StorageApi = { from(bucket: string): StorageBucketApi };

/** Recursively list every object path in a bucket. Folders (entries with a
 *  null id) are descended into; files are collected with their full path. */
export async function listAllPaths(storage: StorageApi, bucket: string): Promise<string[]> {
  const api = storage.from(bucket);
  const out: string[] = [];

  async function walk(prefix: string): Promise<void> {
    let offset = 0;
    for (;;) {
      const { data, error } = await api.list(prefix, { limit: LIST_PAGE, offset });
      if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
      const entries = data ?? [];
      for (const e of entries) {
        const path = prefix ? `${prefix}/${e.name}` : e.name;
        if (e.id === null) {
          await walk(path); // a folder
        } else {
          out.push(path);
        }
      }
      if (entries.length < LIST_PAGE) break;
      offset += LIST_PAGE;
    }
  }

  await walk('');
  return out;
}

/** A copy() error that means the destination object already exists — i.e.
 *  it's already mirrored, which is success, not failure. */
export function isAlreadyExistsError(message: string): boolean {
  return /exist|duplicate|conflict/i.test(message);
}

export type MirrorResult = {
  bucket:  string;
  total:   number;
  copied:  number;
  skipped: number;
  failed:  { path: string; error: string }[];
};

/** Mirror one source bucket into the backup bucket, namespacing destination
 *  paths by source bucket so the three never collide. */
export async function mirrorBucket(
  storage: StorageApi,
  bucket: string,
  backupBucket: string = PHOTO_BACKUP_BUCKET,
): Promise<MirrorResult> {
  const paths = await listAllPaths(storage, bucket);
  const api = storage.from(bucket);
  const result: MirrorResult = { bucket, total: paths.length, copied: 0, skipped: 0, failed: [] };

  for (const path of paths) {
    const dest = `${bucket}/${path}`;
    const { error } = await api.copy(path, dest, { destinationBucket: backupBucket });
    if (!error) {
      result.copied += 1;
    } else if (isAlreadyExistsError(error.message)) {
      result.skipped += 1;
    } else {
      result.failed.push({ path, error: error.message });
    }
  }
  return result;
}

/** Mirror every photo source bucket. */
export async function mirrorAllPhotoBuckets(storage: StorageApi): Promise<MirrorResult[]> {
  const results: MirrorResult[] = [];
  for (const bucket of PHOTO_SOURCE_BUCKETS) {
    results.push(await mirrorBucket(storage, bucket));
  }
  return results;
}
