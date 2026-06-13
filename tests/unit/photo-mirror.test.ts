import { describe, it, expect } from 'vitest';
import {
  listAllPaths,
  mirrorBucket,
  isAlreadyExistsError,
  type StorageApi,
  type StorageEntry,
} from '@/lib/backup/photo-mirror';

// A fake storage client over an in-memory nested tree. Keys are full paths;
// folders are inferred from path segments, mirroring how Supabase .list()
// returns one level at a time (folders as entries with id === null).
function fakeStorage(treeByBucket: Record<string, string[]>, existingInBackup: Set<string> = new Set()) {
  const copied: { from: string; to: string; bucket: string }[] = [];

  const api = (bucket: string) => ({
    async list(prefix: string, { limit, offset }: { limit: number; offset: number }) {
      const paths = treeByBucket[bucket] ?? [];
      const base = prefix ? `${prefix}/` : '';
      const names = new Map<string, boolean>(); // name -> isFolder
      for (const p of paths) {
        if (!p.startsWith(base)) continue;
        const rest = p.slice(base.length);
        if (!rest) continue;
        const slash = rest.indexOf('/');
        if (slash === -1) names.set(rest, false);
        else names.set(rest.slice(0, slash), true);
      }
      const all: StorageEntry[] = [...names.entries()].map(([name, isFolder]) => ({
        name,
        id: isFolder ? null : `id-${base}${name}`,
      }));
      return { data: all.slice(offset, offset + limit), error: null };
    },
    async copy(from: string, to: string, opts: { destinationBucket: string }) {
      if (existingInBackup.has(to)) {
        return { error: { message: 'The resource already exists' } };
      }
      existingInBackup.add(to);
      copied.push({ from, to, bucket });
      return { error: null };
    },
  });

  return { storage: { from: api } as StorageApi, copied };
}

describe('listAllPaths', () => {
  it('recursively lists every nested object path', async () => {
    const { storage } = fakeStorage({
      'recipe-photos': [
        'dishes/abc/1.jpg',
        'dishes/abc/2.jpg',
        'sources/_inbox/sess/3.jpg',
        'thumbs/dishes/abc/1.jpg.jpg',
        'top-level.jpg',
      ],
    });
    const paths = await listAllPaths(storage, 'recipe-photos');
    expect(paths.sort()).toEqual([
      'dishes/abc/1.jpg',
      'dishes/abc/2.jpg',
      'sources/_inbox/sess/3.jpg',
      'thumbs/dishes/abc/1.jpg.jpg',
      'top-level.jpg',
    ]);
  });
});

describe('mirrorBucket', () => {
  it('copies every object, namespaced by source bucket', async () => {
    const { storage, copied } = fakeStorage({
      'recipe-photos': ['dishes/abc/1.jpg', 'sources/x/2.jpg'],
    });
    const r = await mirrorBucket(storage, 'recipe-photos');
    expect(r).toMatchObject({ bucket: 'recipe-photos', total: 2, copied: 2, skipped: 0 });
    expect(r.failed).toEqual([]);
    expect(copied.map((c) => c.to).sort()).toEqual([
      'recipe-photos/dishes/abc/1.jpg',
      'recipe-photos/sources/x/2.jpg',
    ]);
  });

  it('is incremental — already-mirrored objects are skipped, not re-copied', async () => {
    const existing = new Set(['recipe-photos/dishes/abc/1.jpg']);
    const { storage, copied } = fakeStorage({
      'recipe-photos': ['dishes/abc/1.jpg', 'dishes/abc/2.jpg'],
    }, existing);
    const r = await mirrorBucket(storage, 'recipe-photos');
    expect(r).toMatchObject({ total: 2, copied: 1, skipped: 1 });
    expect(copied.map((c) => c.to)).toEqual(['recipe-photos/dishes/abc/2.jpg']);
  });

  it('records genuine copy failures without aborting the rest', async () => {
    const tree = { 'recipe-photos': ['a.jpg', 'b.jpg', 'c.jpg'] };
    const { storage } = (() => {
      const base = fakeStorage(tree);
      // Wrap copy so 'b.jpg' fails with a non-duplicate error.
      const origFrom = base.storage.from;
      base.storage.from = (bucket: string) => {
        const api = origFrom(bucket);
        const origCopy = api.copy.bind(api);
        api.copy = async (from, to, opts) =>
          from === 'b.jpg' ? { error: { message: 'network blip' } } : origCopy(from, to, opts);
        return api;
      };
      return base;
    })();
    const r = await mirrorBucket(storage, 'recipe-photos');
    expect(r.copied).toBe(2);
    expect(r.failed).toEqual([{ path: 'b.jpg', error: 'network blip' }]);
  });
});

describe('isAlreadyExistsError', () => {
  it('recognizes duplicate/exists/conflict messages as already-mirrored', () => {
    expect(isAlreadyExistsError('The resource already exists')).toBe(true);
    expect(isAlreadyExistsError('Duplicate object')).toBe(true);
    expect(isAlreadyExistsError('409 Conflict')).toBe(true);
    expect(isAlreadyExistsError('network timeout')).toBe(false);
  });
});
