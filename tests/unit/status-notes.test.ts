import { describe, it, expect } from 'vitest';
import { publicStatusNotes, INTERNAL_TAG_SLUGS, needsInstructions } from '@/lib/recipes/status-notes';

describe('publicStatusNotes', () => {
  it('returns no notes for a recipe with no relevant tags', () => {
    expect(publicStatusNotes([])).toEqual([]);
    expect(publicStatusNotes(['some-other-tag'])).toEqual([]);
  });

  it('returns the "still being checked" note for low-confidence', () => {
    const notes = publicStatusNotes(['low-confidence']);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/Still being checked/);
  });

  it('returns the "method needs filling in" note for needs-instructions', () => {
    const notes = publicStatusNotes(['needs-instructions']);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/Method needs filling in/);
  });

  it("returns Lucy's collection note when it's the only status tag", () => {
    const notes = publicStatusNotes(['lucys-recipe-collection']);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/Lucy's recipe collection/);
  });

  it("suppresses Lucy's note when a more specific status applies", () => {
    expect(publicStatusNotes(['lucys-recipe-collection', 'low-confidence'])).toEqual([
      expect.stringMatching(/Still being checked/),
    ]);
    expect(publicStatusNotes(['lucys-recipe-collection', 'needs-instructions'])).toEqual([
      expect.stringMatching(/Method needs filling in/),
    ]);
  });

  it('combines low-confidence and needs-instructions when both apply', () => {
    const notes = publicStatusNotes(['low-confidence', 'needs-instructions']);
    expect(notes).toHaveLength(2);
    expect(notes[0]).toMatch(/Still being checked/);
    expect(notes[1]).toMatch(/Method needs filling in/);
  });

  it('ignores internal-only tags', () => {
    expect(publicStatusNotes(['multi-recipe'])).toEqual([]);
    expect(publicStatusNotes(['possible-duplicate'])).toEqual([]);
    expect(publicStatusNotes(['bulk-photos'])).toEqual([]);
    // even mixed in: only the public-status tag surfaces
    expect(publicStatusNotes(['multi-recipe', 'low-confidence'])).toEqual([
      expect.stringMatching(/Still being checked/),
    ]);
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
