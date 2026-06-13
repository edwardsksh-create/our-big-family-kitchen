// Public-facing status notes shown on the recipe page. These are intentionally
// positive/provenance-only — the previous "Still being checked" /
// "Method needs filling in" copy was a public surfacing of needs-class
// prompts and now lives exclusively in the actionable NeedsPrompt block,
// which is gated to admin + the recipe's contributor (see lib/recipes/badges).
// Internal-only tags (multi-recipe, possible-duplicate, bulk-photos) still
// never surface to the public.

import { FAMILY } from '@/config/family';

const LUCY_COLLECTION_NOTE =
  "From Lucy's recipe collection. Photographed from her binder of favorites curated over 30+ years.";

// Tags that are admin-internal: never appear in public copy.
export const INTERNAL_TAG_SLUGS = new Set([
  'multi-recipe',
  'possible-duplicate',
  'bulk-photos',
]);

function isFromFederatedArchive(originallyFrom: string | null | undefined): boolean {
  if (!originallyFrom || !FAMILY.federation) return false;
  return FAMILY.federation.provenancePattern.test(originallyFrom);
}

/**
 * Public-facing status/provenance notes for a recipe. Returns positive
 * provenance only — currently the Lucy's-collection note (when tagged) and
 * the Aunt Laura's-2003-cookbook note (when `originally_from` mentions her,
 * detected the same way the /recipes index "From Aunt Laura's archive"
 * badge does in lib/recipes/badges.ts). At most one provenance note is
 * returned; if a recipe qualifies for both, Lucy's wins as the more
 * specific signal (the curated binder she kept), so we don't stack two
 * redundant notes.
 *
 * Needs-class tags (low-confidence, needs-instructions) deliberately return
 * nothing here — actionable versions live in NeedsPrompt for admin + the
 * contributor; they should never appear as cold system text for the public.
 */
export function publicStatusNotes(
  tagSlugs:       string[],
  originallyFrom: string | null = null,
): string[] {
  if (tagSlugs.includes('lucys-recipe-collection')) {
    return [LUCY_COLLECTION_NOTE];
  }
  if (FAMILY.federation && isFromFederatedArchive(originallyFrom)) {
    return [FAMILY.federation.provenanceNote];
  }
  return [];
}

export function needsInstructions(tagSlugs: string[]): boolean {
  return tagSlugs.includes('needs-instructions');
}
