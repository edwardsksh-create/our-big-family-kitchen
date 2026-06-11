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

  describe('Aunt Laura provenance — parity with Lucy', () => {
    it('emits an Aunt Laura provenance note when originally_from mentions her', () => {
      const notes = publicStatusNotes([], "Aunt Laura's 2003 cookbook");
      expect(notes).toHaveLength(1);
      expect(notes[0]).toMatch(/Aunt Laura's 2003 cookbook/);
    });

    it('matches Aunt Laura case-insensitively and inside longer strings', () => {
      expect(publicStatusNotes([], 'aunt laura'))
        .toEqual([expect.stringMatching(/Aunt Laura/)]);
      expect(publicStatusNotes([], "Discovered in Toledo (via Aunt Laura's 2003 cookbook)"))
        .toEqual([expect.stringMatching(/Aunt Laura/)]);
    });

    it('returns no note when originally_from is null / empty / unrelated', () => {
      expect(publicStatusNotes([], null)).toEqual([]);
      expect(publicStatusNotes([], '')).toEqual([]);
      expect(publicStatusNotes([], 'Bon Appétit')).toEqual([]);
    });

    it('does not stack — Lucy wins when both apply (more specific signal)', () => {
      const notes = publicStatusNotes(['lucys-recipe-collection'], "Aunt Laura's 2003 cookbook");
      expect(notes).toHaveLength(1);
      expect(notes[0]).toMatch(/Lucy's recipe collection/);
      expect(notes[0]).not.toMatch(/Aunt Laura/);
    });
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
