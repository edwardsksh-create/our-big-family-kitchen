// Pure helpers for adding new occasion types from the photo-review form.
// The DB writes live in the server action; this module is purely about
// normalization and dedupe so it's unit-testable without touching the DB.

import { slugify } from '@/lib/utils';

export type OccasionCandidate = {
  /** Slug normalized via slugify(). Empty when the name has no usable chars. */
  slug: string;
  /** Trimmed display name. */
  name: string;
};

export type ExistingOccasion = {
  slug: string;
  name: string;
};

export type DedupeOutcome =
  | { kind: 'invalid';                                  reason: 'empty' | 'too_short' }
  | { kind: 'existing';   slug: string; name: string;  matchedOn: 'slug' | 'name' }
  | { kind: 'new';        slug: string; name: string };

/**
 * Decide whether a typed name maps to an existing occasion or warrants a
 * new row. Match precedence is slug (case-insensitive) first, then name
 * (case-insensitive, whitespace-collapsed). Inputs are trimmed before any
 * comparison so "  christmas " matches "Christmas".
 */
export function dedupeOccasion(
  raw: string,
  existing: ExistingOccasion[],
): DedupeOutcome {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length === 0) return { kind: 'invalid', reason: 'empty' };
  if (name.length < 2)   return { kind: 'invalid', reason: 'too_short' };

  const slug = slugify(name);
  if (!slug) return { kind: 'invalid', reason: 'empty' };

  // 1) Exact slug match (case-insensitive — slugify already lowercases).
  const bySlug = existing.find((e) => e.slug === slug);
  if (bySlug) return { kind: 'existing', slug: bySlug.slug, name: bySlug.name, matchedOn: 'slug' };

  // 2) Name match (case-insensitive, whitespace-collapsed).
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const byName = existing.find((e) => norm(e.name) === norm(name));
  if (byName) return { kind: 'existing', slug: byName.slug, name: byName.name, matchedOn: 'name' };

  return { kind: 'new', slug, name };
}

/**
 * Live "did you mean…" matches as the user types in the add-occasion field.
 * Surface up to 5 entries whose slug or name shares a substring with the
 * typed text. Order: slug-prefix matches first, then name-substring matches.
 */
export function suggestExistingOccasions(
  raw: string,
  existing: ExistingOccasion[],
  limit = 5,
): ExistingOccasion[] {
  const t = raw.trim().toLowerCase();
  if (t.length < 2) return [];
  const slugCandidate = slugify(t);

  const prefix:    ExistingOccasion[] = [];
  const substring: ExistingOccasion[] = [];
  for (const e of existing) {
    if (e.slug.startsWith(slugCandidate) || e.slug === slugCandidate) prefix.push(e);
    else if (e.name.toLowerCase().includes(t)) substring.push(e);
  }
  return [...prefix, ...substring].slice(0, limit);
}
