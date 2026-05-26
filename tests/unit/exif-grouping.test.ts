import { describe, it, expect } from 'vitest';
import { groupByTimeWindow, type PhotoMeta } from '@/lib/photos/exif-grouping';

const at = (path: string, ms: number): PhotoMeta => ({
  path, capturedAtMs: ms, capturedAtRaw: '',
});

describe('groupByTimeWindow', () => {
  it('groups adjacent photos within the window', () => {
    const photos = [at('a', 0), at('b', 5000), at('c', 10000)];
    const groups = groupByTimeWindow(photos, 15000);
    expect(groups).toHaveLength(1);
    expect(groups[0].photos.map((p) => p.path)).toEqual(['a', 'b', 'c']);
  });

  it('starts a new group when the gap exceeds the window', () => {
    const photos = [at('a', 0), at('b', 5000), at('c', 30000)];
    const groups = groupByTimeWindow(photos, 15000);
    expect(groups).toHaveLength(2);
    expect(groups[0].photos.map((p) => p.path)).toEqual(['a', 'b']);
    expect(groups[1].photos.map((p) => p.path)).toEqual(['c']);
  });

  it('sorts by timestamp before grouping', () => {
    const photos = [at('b', 5000), at('a', 0), at('c', 10000)];
    const groups = groupByTimeWindow(photos, 15000);
    expect(groups).toHaveLength(1);
    expect(groups[0].photos.map((p) => p.path)).toEqual(['a', 'b', 'c']);
  });

  it('treats the window edge as inclusive', () => {
    const photos = [at('a', 0), at('b', 15000)];
    const groups = groupByTimeWindow(photos, 15000);
    expect(groups).toHaveLength(1);
  });

  it('honors a chain (each adjacent pair within window) even if first-to-last exceeds it', () => {
    const photos = [at('a', 0), at('b', 10000), at('c', 20000), at('d', 30000)];
    const groups = groupByTimeWindow(photos, 15000);
    expect(groups).toHaveLength(1);
    expect(groups[0].photos).toHaveLength(4);
  });

  it('returns an empty array for empty input', () => {
    expect(groupByTimeWindow([], 15000)).toEqual([]);
  });
});
