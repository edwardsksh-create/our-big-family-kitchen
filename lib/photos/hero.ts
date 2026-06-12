// Pure helper for the home-page "photo of the day".
//
// Day-seeded rather than random-per-request: everyone sees the same hero
// on a given day (it reads as an editorial choice, not a slot machine),
// the page is cache-friendly, and the photo still changes daily — a
// living archive, calmly. No carousel: one priority-loaded image keeps
// LCP fast and avoids the auto-slider accessibility tarpit.

/** Deterministic index into the hero pool for a given UTC date.
 *  `dateISO` is a YYYY-MM-DD string; returns 0 for an empty pool guard
 *  at the call site (poolSize must be > 0 here). */
export function dailyHeroIndex(dateISO: string, poolSize: number): number {
  if (poolSize <= 0) throw new Error('dailyHeroIndex: pool must be non-empty');
  const dayNumber = Math.floor(Date.parse(`${dateISO}T00:00:00Z`) / 86_400_000);
  return ((dayNumber % poolSize) + poolSize) % poolSize;
}
