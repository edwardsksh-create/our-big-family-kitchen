import { describe, it, expect } from 'vitest';
import { publicStatusNotes, INTERNAL_TAG_SLUGS, needsInstructions } from '@/lib/recipes/status-notes';

describe('publicStatusNotes', () => {
  it('returns no notes for a recipe with no relevant tags', () => {
    expect(publicStatusNotes([])).toEqual([]);
    expect(publicStatusNotes(['some-other-tag'])).toEqual([]);
  });

  it('returns Lucy\'s-collection provenance note when the tag is present', () => {
    const notes = publicStatusNotes(['lucys-recipe-collection']);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/Lucy's recipe collection/);
  });

  it('does NOT surface low-confidence as public copy — handled by the actionable NeedsPrompt for admin/owner only', () => {
    expect(publicStatusNotes(['low-confidence'])).toEqual([]);
  });

  it('does NOT surface needs-instructions as public copy — handled by the actionable NeedsPrompt for admin/owner only', () => {
    expect(publicStatusNotes(['needs-instructions'])).toEqual([]);
  });

  it('keeps the Lucy\'s-collection note even when needs-class tags are also present (provenance is independent of needs)', () => {
    expect(publicStatusNotes(['lucys-recipe-collection', 'low-confidence']))
      .toEqual([expect.stringMatching(/Lucy's recipe collection/)]);
    expect(publicStatusNotes(['lucys-recipe-collection', 'needs-instructions']))
      .toEqual([expect.stringMatching(/Lucy's recipe collection/)]);
  });

  it('ignores internal-only tags', () => {
    expect(publicStatusNotes(['multi-recipe'])).toEqual([]);
    expect(publicStatusNotes(['possible-duplicate'])).toEqual([]);
    expect(publicStatusNotes(['bulk-photos'])).toEqual([]);
  });
});

describe('INTERNAL_TAG_SLUGS', () => {
  it('flags the documented internal-only tags', () => {
    expect(INTERNAL_TAG_SLUGS.has('multi-recipe')).toBe(true);
    expect(INTERNAL_TAG_SLUGS.has('possible-duplicate')).toBe(true);
    expect(INTERNAL_TAG_SLUGS.has('bulk-photos')).toBe(true);
    // public tags are not internal
    expect(INTERNAL_TAG_SLUGS.has('low-confidence')).toBe(false);
    expect(INTERNAL_TAG_SLUGS.has('needs-instructions')).toBe(false);
    expect(INTERNAL_TAG_SLUGS.has('lucys-recipe-collection')).toBe(false);
  });
});

describe('needsInstructions', () => {
  it('returns true when the tag is present', () => {
    expect(needsInstructions(['needs-instructions'])).toBe(true);
    expect(needsInstructions(['low-confidence', 'needs-instructions'])).toBe(true);
  });
  it('returns false otherwise', () => {
    expect(needsInstructions([])).toBe(false);
    expect(needsInstructions(['low-confidence'])).toBe(false);
  });
});
