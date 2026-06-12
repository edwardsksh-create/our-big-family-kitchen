// Recipe ↔ occasion tagging helpers. The occasion vocabulary is the same
// seed list photos use (family_photo_occasion_types); recipes only select
// from it — no new occasion creation from the recipe flow.

/**
 * Pure: clean a client-submitted occasion-slug list against the canonical
 * vocabulary — trim, drop unknowns, dedupe, preserve first-seen order.
 * The save action runs every submitted list through this so a tampered
 * payload can't write slugs that aren't real occasion types (the FK would
 * reject them anyway; this keeps the failure graceful and the data clean).
 */
export function normalizeOccasionSlugs(
  input: readonly string[] | null | undefined,
  validSlugs: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input ?? []) {
    const slug = raw.trim();
    if (!slug || seen.has(slug) || !validSlugs.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}
