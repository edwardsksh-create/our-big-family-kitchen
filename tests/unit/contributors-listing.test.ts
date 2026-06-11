import { describe, it, expect } from 'vitest';
import { filterToListedContributors } from '@/lib/queries/contributors';
import type { ContributorSummary } from '@/lib/queries/contributors';

function c(id: string, name = id): ContributorSummary {
  return {
    id,
    name,
    email:               `${id}@example.com`,
    bio:                 null,
    role:                'contributor',
    slug:                name.toLowerCase().replace(/\s+/g, '-'),
    joined_at:           null,
    can_sign_in:         true,
    can_publish:         false,
    deceased:            false,
    nickname:            null,
    birth_name:          null,
    hero_photo_path:     null,
    primary_family_line:   null,
    secondary_family_line: null,
  };
}

describe('filterToListedContributors', () => {
  const all = [
    c('lucy',    'Lucy Leusch'),
    c('kate',    'Kate Edwards'),
    c('annie',   'Annie Sundy'),
    c('regina',  'Regina Quinn'),
    c('megan',   'Megan Sundy'),
  ];

  it('keeps contributors who have at least one published authored recipe', () => {
    const ids = new Set(['lucy', 'kate', 'annie']);
    const out = filterToListedContributors(all, ids);
    expect(out.map((c) => c.id)).toEqual(['lucy', 'kate', 'annie']);
  });

  it('drops contributors with no published authored recipe', () => {
    // Regina and Megan exist in the family structure but have nothing
    // attributed to them — they should not pad the public index.
    const ids = new Set(['lucy', 'kate', 'annie']);
    const out = filterToListedContributors(all, ids);
    expect(out.find((c) => c.id === 'regina')).toBeUndefined();
    expect(out.find((c) => c.id === 'megan')).toBeUndefined();
  });

  it('returns nothing when no one has authored a published recipe', () => {
    expect(filterToListedContributors(all, new Set())).toEqual([]);
  });

  it('preserves input order when filtering (no resort)', () => {
    const ordered = [
      c('zeb',  'Zebedee Williams'),
      c('amy',  'Amy Allen'),
      c('matt', 'Matt Allen'),
    ];
    const out = filterToListedContributors(ordered, new Set(['amy', 'matt', 'zeb']));
    expect(out.map((c) => c.id)).toEqual(['zeb', 'amy', 'matt']);
  });

  it('ignores ids in the authored set that aren\'t actually contributors', () => {
    // Defense: a stale contributor_id in the set (e.g. a deleted contributor
    // referenced by an orphan recipe) should not cause a phantom listing.
    const ids = new Set(['lucy', 'someone-not-in-table']);
    const out = filterToListedContributors(all, ids);
    expect(out.map((c) => c.id)).toEqual(['lucy']);
  });
});
