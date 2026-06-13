// Visual status badges for recipe cards on /recipes.
//
// Derived from the same fields the recipe detail page uses, so a card and its
// detail page agree about state. Internal-only tags never surface here — they
// were filtered out upstream in fetchRecipeIndex.
//
// "needs"-class badges (Needs method, Needs story) and the "Needs family help"
// section are gated on viewer permission: only the recipe's contributor and
// site admins ever see them. Other family members and signed-out visitors see
// the card without the needs framing — affirmative badges still show.

import type { RecipeIndexItem } from '@/lib/queries/recipes';
import { FAMILY } from '@/config/family';

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

/** Identity of the current page viewer. Used to decide whether to show
 *  needs-class prompts/badges. Serializable so it can be passed across the
 *  server/client component boundary. */
export type Viewer = {
  isAdmin: boolean;
  /** The viewer's own contributor.id, or null when signed out / no record. */
  contributorId: string | null;
};

export const ANONYMOUS_VIEWER: Viewer = { isAdmin: false, contributorId: null };

// 30-day window is the same threshold used in copy throughout the site.
export const RECENTLY_ADDED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// Tags that indicate a recipe needs family help. `needs-story` isn't an
// active tag yet but is included so a future seed picks it up automatically.
export const NEEDS_HELP_TAGS = new Set(['low-confidence', 'needs-instructions', 'needs-story']);

function isFromFederatedArchive(originallyFrom: string | null): boolean {
  if (!originallyFrom || !FAMILY.federation) return false;
  return FAMILY.federation.provenancePattern.test(originallyFrom);
}

export function isRecentlyAdded(publishedAt: string, now = Date.now()): boolean {
  const t = new Date(publishedAt).getTime();
  if (!Number.isFinite(t)) return false;
  return now - t <= RECENTLY_ADDED_WINDOW_MS;
}

/**
 * Is this viewer entitled to see the needs-prompts for this recipe? True for
 * site admins (who can fix anything) and the recipe's own contributor (who
 * saved it and can fill it out). False for everyone else — signed-out, other
 * family members, etc.
 */
export function canSeeNeedsFor(viewer: Viewer, contributorId: string | null): boolean {
  if (viewer.isAdmin) return true;
  if (!viewer.contributorId || !contributorId) return false;
  return viewer.contributorId === contributorId;
}

/**
 * Compute the badges shown on a card. Affirmative badges (ready-to-cook,
 * family-note, original-page, from-aunt-laura, recently-added) render for
 * everyone. The two "needs" badges only render when the viewer is entitled
 * (admin or this recipe's contributor) — other family members see the card
 * without the needs framing.
 */
export function badgesFor(item: RecipeIndexItem, viewer: Viewer, now = Date.now()): Badge[] {
  const out: Badge[] = [];
  const showNeeds = canSeeNeedsFor(viewer, item.contributor_id);

  if (item.has_method && item.has_ingredients) {
    out.push({ key: 'ready-to-cook', label: 'ready to cook', kind: 'affirmative' });
  }
  // Driven SOLELY by whether the structured method field is empty — a
  // source-page scan doesn't satisfy the requirement, so a recipe can show
  // both "Original page" and "Needs method".
  if (!item.has_method && showNeeds) {
    out.push({ key: 'needs-method', label: 'needs the method', kind: 'needs' });
  }

  if (item.has_story) {
    out.push({ key: 'family-note', label: 'has a family note', kind: 'affirmative' });
  } else if (showNeeds) {
    out.push({ key: 'needs-story', label: 'needs its story', kind: 'needs' });
  }

  if (item.has_source_photo) {
    out.push({ key: 'original-page', label: 'has the original card', kind: 'affirmative' });
  }

  if (FAMILY.federation && isFromFederatedArchive(item.originally_from)) {
    // The key stays 'from-aunt-laura' — it predates the config extraction
    // and is matched by tests and styling.
    out.push({ key: 'from-aunt-laura', label: FAMILY.federation.badgeLabel, kind: 'affirmative' });
  }

  if (isRecentlyAdded(item.published_at, now)) {
    out.push({ key: 'recently-added', label: 'recently added', kind: 'affirmative' });
  }

  return out;
}

/** Does this recipe qualify for the "Needs family help" section in any
 *  viewer's context? Data-only — the page also filters by viewer permission
 *  before rendering. */
export function needsFamilyHelp(item: RecipeIndexItem): boolean {
  return item.tag_slugs.some((s) => NEEDS_HELP_TAGS.has(s));
}

/** Should this recipe show up in the "Needs family help" section *for this
 *  viewer*? Admins see every flagged recipe; contributors see only their own.
 *  Other viewers see none, so the section is hidden entirely. */
export function visibleInNeedsFamilyHelp(item: RecipeIndexItem, viewer: Viewer): boolean {
  if (!needsFamilyHelp(item)) return false;
  return canSeeNeedsFor(viewer, item.contributor_id);
}
