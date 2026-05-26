// Map admin tag slugs to warm, public-facing status notes shown on the
// recipe page. Internal-only tags (multi-recipe, possible-duplicate,
// bulk-photos) never surface to the public.

const PUBLIC_TAG_NOTES: Record<string, string> = {
  'low-confidence':
    "Still being checked. This recipe was transcribed from an original image and may need a second look. The original photo is included at the bottom of the page.",
  'needs-instructions':
    "Method needs filling in. The original recipe doesn't include full method instructions yet. Check the original photo below, or add notes if you know how this was usually made.",
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
 * Compute the public status notes for a recipe given its admin tag slugs.
 *
 * Returns an array (possibly empty). When low-confidence or needs-instructions
 * applies, the lucys-recipe-collection note is suppressed — the more specific
 * "still being checked" / "method needs filling in" carries the meaning.
 */
export function publicStatusNotes(tagSlugs: string[]): string[] {
  const notes: string[] = [];
  const has = (slug: string) => tagSlugs.includes(slug);

  if (has('low-confidence')) notes.push(PUBLIC_TAG_NOTES['low-confidence']);
  if (has('needs-instructions')) notes.push(PUBLIC_TAG_NOTES['needs-instructions']);

  // lucys-recipe-collection only stands alone when there's no other status
  if (has('lucys-recipe-collection') && notes.length === 0) {
    notes.push(PUBLIC_TAG_NOTES['lucys-recipe-collection']);
  }

  return notes;
}

export function needsInstructions(tagSlugs: string[]): boolean {
  return tagSlugs.includes('needs-instructions');
}
