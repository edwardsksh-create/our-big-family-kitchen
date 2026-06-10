// Public-facing status notes shown on the recipe page. These are intentionally
// positive/provenance-only — the previous "Still being checked" /
// "Method needs filling in" copy was a public surfacing of needs-class
// prompts and now lives exclusively in the actionable NeedsPrompt block,
// which is gated to admin + the recipe's contributor (see lib/recipes/badges).
// Internal-only tags (multi-recipe, possible-duplicate, bulk-photos) still
// never surface to the public.

const PUBLIC_TAG_NOTES: Record<string, string> = {
  'lucys-recipe-collection':
    "From Lucy's recipe collection. Photographed from her binder of favorites curated over 30+ years.",
};

// Tags that are admin-internal: never appear in public copy.
export const INTERNAL_TAG_SLUGS = new Set([
  'multi-recipe',
  'possible-duplicate',
  'bulk-photos',
]);

/**
 * Public-facing status/provenance notes for a recipe. Returns positive
 * provenance only (currently just the Lucy's-collection note). Needs-class
 * tags (low-confidence, needs-instructions) deliberately return nothing
 * here — actionable versions of those prompts live on the recipe page for
 * admin + the contributor via NeedsPrompt; they should never appear as cold
 * system text for the general public.
 */
export function publicStatusNotes(tagSlugs: string[]): string[] {
  const notes: string[] = [];
  if (tagSlugs.includes('lucys-recipe-collection')) {
    notes.push(PUBLIC_TAG_NOTES['lucys-recipe-collection']);
  }
  return notes;
}

export function needsInstructions(tagSlugs: string[]): boolean {
  return tagSlugs.includes('needs-instructions');
}
