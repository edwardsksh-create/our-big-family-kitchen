import { describe, it, expect } from 'vitest';
import {
  toSearchableItems,
  nativeRecipeToSearchableItem,
  rank,
  groupResultsBySection,
  type SearchableItem,
} from '@/lib/search';
import type { FederatedRecipe } from '@/lib/federated';
import type { NativeRecipeSummary } from '@/lib/queries/recipes';

const fed = (over: Partial<FederatedRecipe> = {}): FederatedRecipe => ({
  id:               over.id ?? 'f1',
  source_url:       'https://leuschfamilyrecipes.com/recipes/x',
  title:            over.title ?? 'Kuchen Dough',
  contributor_name: over.contributor_name ?? 'Bertha Leusch',
  section_slug:     over.section_slug ?? 'breakfast',
  search_tokens:    over.search_tokens ?? 'kuchen dough bertha leusch flour butter',
  fetched_at:       new Date().toISOString(),
  ...over,
});

const native = (over: Partial<NativeRecipeSummary> = {}): NativeRecipeSummary => ({
  id:               over.id ?? 'n1',
  slug:             over.slug ?? 'oriental-cole-slaw',
  title:            over.title ?? 'Oriental Cole Slaw',
  published_at:     new Date().toISOString(),
  contributor_name: over.contributor_name ?? 'Annie Sundy',
  section_slug:     over.section_slug ?? 'salads',
  section_name:     over.section_name ?? 'Salads',
  primary_family_line_slug: 'leusch',
  ...over,
});

describe('rank()', () => {
  it('returns an empty list for a query under the 2-char floor', () => {
    const items = toSearchableItems([fed()]);
    expect(rank(items, 'a')).toEqual([]);
    expect(rank(items, '')).toEqual([]);
  });

  it('title matches outrank token-only matches', () => {
    const items = toSearchableItems([
      fed({ id: 'a', title: 'Kuchen', search_tokens: 'apple pie' }),
      fed({ id: 'b', title: 'Apple Pie', search_tokens: 'flour butter sugar kuchen' }),
    ]);
    const out = rank(items, 'kuchen');
    expect(out[0].id).toBe('a'); // title match wins
  });

  it('phrase boost: full query inside the title scores extra', () => {
    const items = toSearchableItems([
      fed({ id: 'a', title: 'Cream Cheese Pastries', search_tokens: 'cream cheese pastries x' }),
      fed({ id: 'b', title: 'Pastry Cream Dough',     search_tokens: 'cream pastry dough y' }),
    ]);
    const out = rank(items, 'cream cheese');
    expect(out[0].id).toBe('a');
  });

  it('common-ingredient demotion kicks in for a single common phrase query', () => {
    // Item where the query phrase only appears in tokens, not title/contributor.
    const items: SearchableItem[] = [
      {
        kind:        'federated',
        id:          'a',
        title:       'Stew',
        contributor: 'Cook',
        sectionSlug: 'soups',
        href:        'x',
        external:    true,
        tokens:      'beef broth onions celery',
      },
    ];
    const normal = rank(items, 'broth')[0]; // not in demotion list
    const demoted = rank(items, 'beef broth')[0]; // demoted
    expect(demoted.score).toBeLessThan(normal.score * 2);
  });

  it('mixes native and federated; native items keep their kind', () => {
    const items: SearchableItem[] = [
      ...toSearchableItems([fed({ title: 'Oriental Apple Slaw' })]),
      nativeRecipeToSearchableItem(native({ title: 'Oriental Cole Slaw' })),
    ];
    const out = rank(items, 'oriental');
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.kind).sort()).toEqual(['federated', 'native']);
  });

  it('contributor name matches', () => {
    const items: SearchableItem[] = [
      ...toSearchableItems([fed({ id: 'a', contributor_name: 'Bertha Leusch', search_tokens: 'x' })]),
      ...toSearchableItems([fed({ id: 'b', contributor_name: 'Annie Sundy',  search_tokens: 'x' })]),
    ];
    const out = rank(items, 'annie');
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('b');
  });

  it('respects the limit arg', () => {
    const items = toSearchableItems(
      Array.from({ length: 20 }, (_, i) => fed({ id: `f${i}`, title: `Kuchen ${i}` })),
    );
    expect(rank(items, 'kuchen', 5)).toHaveLength(5);
  });
});

describe('nativeRecipeToSearchableItem()', () => {
  it('builds a SearchableItem from a NativeRecipeSummary', () => {
    const item = nativeRecipeToSearchableItem(native());
    expect(item.kind).toBe('native');
    expect(item.external).toBe(false);
    expect(item.href).toBe('/recipes/oriental-cole-slaw');
    expect(item.tokens.toLowerCase()).toContain('annie sundy');
    expect(item.tokens.toLowerCase()).toContain('oriental cole slaw');
  });
});

describe('groupResultsBySection()', () => {
  const sectionOrder = [
    { slug: 'breakfast', name: 'Breakfast' },
    { slug: 'salads',    name: 'Salads' },
  ];

  it('groups by section in order; alphabetizes within group', () => {
    const items: SearchableItem[] = [
      ...toSearchableItems([fed({ id: 'a', title: 'Banana Cake', section_slug: 'salads' })]),
      ...toSearchableItems([fed({ id: 'b', title: 'Apple Cake',  section_slug: 'salads' })]),
      ...toSearchableItems([fed({ id: 'c', title: 'Kuchen',      section_slug: 'breakfast' })]),
    ];
    const results = rank(items, 'cake');
    const grouped = groupResultsBySection(results, sectionOrder);
    // Breakfast group came first in the sectionOrder; salads after.
    expect(grouped.map((g) => g.slug)).toEqual(['salads']);
    // 'Apple Cake' before 'Banana Cake' alphabetically.
    expect(grouped[0].results.map((r) => r.title)).toEqual(['Apple Cake', 'Banana Cake']);
  });

  it('appends "Other" group for items without a section', () => {
    const items: SearchableItem[] = [
      ...toSearchableItems([fed({ id: 'a', title: 'Mystery', section_slug: null })]),
    ];
    const results = rank(items, 'mystery');
    const grouped = groupResultsBySection(results, sectionOrder);
    expect(grouped[grouped.length - 1].slug).toBeNull();
    expect(grouped[grouped.length - 1].name).toBe('Other');
  });
});
