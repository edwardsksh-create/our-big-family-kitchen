// Weighted full-text search over federated recipes.
//
// Phase 2 only federated recipes are indexed. The shape below
// (SearchableItem) is deliberately union-able with native recipes so a
// future iteration can mix native and federated results without changing
// the ranking code.

import type { FederatedRecipe } from '@/lib/federated';

export type SearchableItem = {
  kind: 'federated';
  id: string;
  title: string;
  contributor: string | null;
  sectionSlug: string | null;
  href: string;          // external (federated) or internal (native, future)
  external: boolean;
  tokens: string;        // already-lowercased blob
};

export type SearchResult = SearchableItem & { score: number };

const TITLE_WEIGHT = 10;
const CONTRIBUTOR_WEIGHT = 5;
const TOKEN_WEIGHT = 1;

// Phrases that match a lot of recipes via ingredient text but rarely reflect
// search intent. Demote to half-weight when they match a token blob.
const COMMON_INGREDIENT_DEMOTIONS = new Set(
  [
    'chicken broth',
    'chicken stock',
    'beef broth',
    'beef stock',
    'vegetable broth',
    'vegetable stock',
    'chicken bouillon',
    'beef bouillon',
  ].map((s) => s.toLowerCase()),
);

export function toSearchableItems(recipes: FederatedRecipe[]): SearchableItem[] {
  return recipes.map((r) => ({
    kind:         'federated' as const,
    id:           r.id,
    title:        r.title,
    contributor:  r.contributor_name,
    sectionSlug:  r.section_slug,
    href:         r.source_url,
    external:     true,
    tokens:       (r.search_tokens ?? '').toLowerCase(),
  }));
}

function normalize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function scoreOne(query: string, queryTerms: string[], item: SearchableItem): number {
  if (queryTerms.length === 0) return 0;

  const title       = item.title.toLowerCase();
  const contributor = (item.contributor ?? '').toLowerCase();
  const tokens      = item.tokens;
  const queryRaw    = query.trim().toLowerCase();

  let score = 0;

  // Phrase boost — full query appearing inside the title is a strong signal.
  if (queryRaw.length >= 3 && title.includes(queryRaw)) {
    score += TITLE_WEIGHT * 2;
  }

  for (const term of queryTerms) {
    if (title.includes(term)) score += TITLE_WEIGHT;
    if (contributor.includes(term)) score += CONTRIBUTOR_WEIGHT;
    if (tokens.includes(term)) score += TOKEN_WEIGHT;
  }

  // Demote when the only signal is a common-ingredient phrase in tokens.
  for (const phrase of COMMON_INGREDIENT_DEMOTIONS) {
    if (queryRaw === phrase && tokens.includes(phrase)
        && !title.includes(phrase) && !contributor.includes(phrase)) {
      score *= 0.5;
    }
  }

  return score;
}

export function rank(
  items: SearchableItem[],
  query: string,
  limit?: number,
): SearchResult[] {
  const terms = normalize(query);
  if (terms.length === 0) return [];

  const scored: SearchResult[] = [];
  for (const item of items) {
    const s = scoreOne(query, terms, item);
    if (s > 0) scored.push({ ...item, score: s });
  }
  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return typeof limit === 'number' ? scored.slice(0, limit) : scored;
}

export function groupResultsBySection(
  results: SearchResult[],
  sectionOrder: { slug: string; name: string }[],
): { slug: string | null; name: string; results: SearchResult[] }[] {
  const bySlug = new Map<string | null, SearchResult[]>();
  for (const r of results) {
    const key = r.sectionSlug ?? null;
    const arr = bySlug.get(key) ?? [];
    arr.push(r);
    bySlug.set(key, arr);
  }
  // Alphabetize within each group.
  for (const arr of bySlug.values()) {
    arr.sort((a, b) => a.title.localeCompare(b.title));
  }
  const out: { slug: string | null; name: string; results: SearchResult[] }[] = [];
  for (const s of sectionOrder) {
    if (bySlug.has(s.slug)) {
      out.push({ slug: s.slug, name: s.name, results: bySlug.get(s.slug)! });
    }
  }
  if (bySlug.has(null)) {
    out.push({ slug: null, name: 'Other', results: bySlug.get(null)! });
  }
  return out;
}
