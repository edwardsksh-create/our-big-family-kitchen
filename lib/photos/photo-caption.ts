// Pure composition helpers for the album lightbox caption — structured
// metadata reads as a photo-book line ("Thanksgiving 1987, at Grandma's —
// Nancy, Laura, and Annie") rather than labeled database fields.

/** "Thanksgiving 1987, at Grandma's" — occasions, then the year text
 *  verbatim (it's curated prose: "1987", "around 1995", "early 90s"),
 *  then the place. Null when there's nothing to say. */
export function captionLead(args: {
  occasionNames: string[];
  year:          string | null;
  place:         string | null;
}): string | null {
  const occ = args.occasionNames.join(' & ');
  const year = args.year?.trim() || null;
  const place = args.place?.trim() || null;

  let lead = '';
  if (occ && year) {
    // "Thanksgiving 1987" when the year text starts with a digit;
    // "Thanksgiving, around 1995" when it's prose.
    lead = /^\d/.test(year) ? `${occ} ${year}` : `${occ}, ${year}`;
  } else {
    lead = occ || year || '';
  }

  if (place) {
    lead = lead ? `${lead}, at ${place}` : `At ${place}`;
  }
  return lead || null;
}

/** "Nancy", "Nancy and Laura", "Nancy, Laura, and Annie". */
export function joinNames(names: string[]): string {
  const clean = names.filter((n) => n.trim().length > 0);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')}, and ${clean[clean.length - 1]}`;
}
