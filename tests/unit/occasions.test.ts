import { describe, it, expect } from 'vitest';
import { dedupeOccasion, suggestExistingOccasions } from '@/lib/photos/occasions';

const EXISTING = [
  { slug: 'christmas',          name: 'Christmas' },
  { slug: 'st-patricks-day',    name: "St. Patrick's Day" },
  { slug: 'easter',             name: 'Easter' },
  { slug: 'sunday-dinner',      name: 'Sunday Dinner' },
];

describe('dedupeOccasion', () => {
  it('rejects empty/blank input', () => {
    expect(dedupeOccasion('', EXISTING)).toMatchObject({ kind: 'invalid', reason: 'empty' });
    expect(dedupeOccasion('   ', EXISTING)).toMatchObject({ kind: 'invalid', reason: 'empty' });
  });

  it('rejects too-short input', () => {
    expect(dedupeOccasion('a', EXISTING)).toMatchObject({ kind: 'invalid', reason: 'too_short' });
  });

  it('matches an existing slug case-insensitively', () => {
    expect(dedupeOccasion('Christmas', EXISTING))
      .toMatchObject({ kind: 'existing', slug: 'christmas', matchedOn: 'slug' });
    expect(dedupeOccasion('christmas', EXISTING))
      .toMatchObject({ kind: 'existing', slug: 'christmas', matchedOn: 'slug' });
    expect(dedupeOccasion('  CHRISTMAS  ', EXISTING))
      .toMatchObject({ kind: 'existing', slug: 'christmas', matchedOn: 'slug' });
  });

  it('matches existing names with punctuation differences (slugified)', () => {
    expect(dedupeOccasion("St Patrick's Day", EXISTING))
      .toMatchObject({ kind: 'existing', slug: 'st-patricks-day' });
    expect(dedupeOccasion('st patricks day', EXISTING))
      .toMatchObject({ kind: 'existing', slug: 'st-patricks-day' });
  });

  it('returns a new entry when nothing matches', () => {
    expect(dedupeOccasion('Crawfish Boil', EXISTING))
      .toEqual({ kind: 'new', slug: 'crawfish-boil', name: 'Crawfish Boil' });
  });

  it('preserves the typed casing on a new entry', () => {
    expect(dedupeOccasion('crawfish boil', EXISTING))
      .toEqual({ kind: 'new', slug: 'crawfish-boil', name: 'crawfish boil' });
  });

  it('collapses internal whitespace before slugifying', () => {
    expect(dedupeOccasion('Crawfish    Boil', EXISTING))
      .toEqual({ kind: 'new', slug: 'crawfish-boil', name: 'Crawfish Boil' });
  });
});

describe('suggestExistingOccasions', () => {
  it('returns no suggestions for inputs shorter than 2 chars', () => {
    expect(suggestExistingOccasions('', EXISTING)).toEqual([]);
    expect(suggestExistingOccasions('c', EXISTING)).toEqual([]);
  });

  it('prefers slug-prefix matches', () => {
    const out = suggestExistingOccasions('chr', EXISTING);
    expect(out[0]?.slug).toBe('christmas');
  });

  it('falls back to name-substring matches', () => {
    const out = suggestExistingOccasions('patrick', EXISTING);
    expect(out.some((o) => o.slug === 'st-patricks-day')).toBe(true);
  });

  it('caps results at the given limit', () => {
    const lots = Array.from({ length: 20 }, (_, i) => ({ slug: `birthday-${i}`, name: `Birthday ${i}` }));
    const out = suggestExistingOccasions('birthday', lots, 5);
    expect(out).toHaveLength(5);
  });
});
