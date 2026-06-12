import { describe, it, expect } from 'vitest';
import { normalizeOccasionSlugs } from '@/lib/recipes/occasions';

const VALID = new Set(['thanksgiving', 'christmas', 'sunday-dinner', 'easter']);

describe('normalizeOccasionSlugs', () => {
  it('keeps known slugs in first-seen order', () => {
    expect(normalizeOccasionSlugs(['christmas', 'thanksgiving'], VALID))
      .toEqual(['christmas', 'thanksgiving']);
  });

  it('drops unknown slugs (tampered payloads, retired types)', () => {
    expect(normalizeOccasionSlugs(['thanksgiving', 'made-up', 'drop-table'], VALID))
      .toEqual(['thanksgiving']);
  });

  it('dedupes and trims', () => {
    expect(normalizeOccasionSlugs([' thanksgiving ', 'thanksgiving', ''], VALID))
      .toEqual(['thanksgiving']);
  });

  it('handles null/undefined/empty input', () => {
    expect(normalizeOccasionSlugs(null, VALID)).toEqual([]);
    expect(normalizeOccasionSlugs(undefined, VALID)).toEqual([]);
    expect(normalizeOccasionSlugs([], VALID)).toEqual([]);
  });
});
