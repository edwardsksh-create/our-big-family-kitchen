// Visual status badges for recipe cards on /recipes.
//
// Derived from the same fields the recipe detail page uses, so a card and its
// detail page agree about state. Internal-only tags never surface here — they
// were filtered out upstream in fetchRecipeIndex.

import type { RecipeIndexItem } from '@/lib/queries/recipes';

export type BadgeKey =
  | 'ready-to-cook'
  | 'needs-method'
  | 'family-note'
  | 'needs-story'
  | 'original-page'
  | 'from-aunt-laura'
  | 'recently-added';

export type Badge = {
  key:  BadgeKey;
  label: string;
  /** affirmative = positive state; needs = awaiting family input. */
  kind: 'affirmative' | 'needs';
};

// 30-day window is the same threshold used in copy throughout the site.
export const RECENTLY_ADDED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// Tags that indicate a recipe needs family help. `needs-story` isn't an
// active tag yet but is included so a future seed picks it up automatically.
export const NEEDS_HELP_TAGS = new Set(['low-confidence', 'needs-instructions', 'needs-story']);

function isFromAuntLaura(originallyFrom: string | null): boolean {
  if (!originallyFrom) return false;
  return /aunt laura/i.test(originallyFrom);
}

export function isRecentlyAdded(publishedAt: string, now = Date.now()): boolean {
  const t = new Date(publishedAt).getTime();
  if (!Number.isFinite(t)) return false;
  return now - t <= RECENTLY_ADDED_WINDOW_MS;
}

/**
 * Compute the badges shown on a card. Order matters — affirmative badges
 * first, then awaiting-help, then provenance, then recency. Mutually-exclusive
 * pairs (ready-to-cook ↔ needs-method, family-note ↔ needs-story) are
 * enforced by construction.
 */
export function badgesFor(item: RecipeIndexItem, now = Date.now()): Badge[] {
  const out: Badge[] = [];

  if (item.has_method && item.has_ingredients) {
    out.push({ key: 'ready-to-cook', label: 'Ready to cook', kind: 'affirmative' });
  }
  // Driven SOLELY by whether the structured method field is empty — a
  // source-page scan doesn't satisfy the requirement, so a recipe can show
  // both "Original page" and "Needs method".
  if (!item.has_method) {
    out.push({ key: 'needs-method', label: 'Needs method', kind: 'needs' });
  }

  if (item.has_story) {
    out.push({ key: 'family-note', label: 'Family note', kind: 'affirmative' });
  } else {
    out.push({ key: 'needs-story', label: 'Needs story', kind: 'needs' });
  }

  if (item.has_source_photo) {
    out.push({ key: 'original-page', label: 'Original page', kind: 'affirmative' });
  }

  if (isFromAuntLaura(item.originally_from)) {
    out.push({ key: 'from-aunt-laura', label: "From Aunt Laura's archive", kind: 'affirmative' });
  }

  if (isRecentlyAdded(item.published_at, now)) {
    out.push({ key: 'recently-added', label: 'Recently added', kind: 'affirmative' });
  }

  return out;
}

/** Does this recipe belong in the "Needs family help" section? */
export function needsFamilyHelp(item: RecipeIndexItem): boolean {
  return item.tag_slugs.some((s) => NEEDS_HELP_TAGS.has(s));
}
