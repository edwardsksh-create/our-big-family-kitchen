// Single canonical name-formatting helper. Used everywhere a contributor or
// family member name appears: family-line pages, contributor pages, recipe
// bylines, search results.
//
// Output forms:
//   "Annie Sundy"                          (no extras)
//   "Annie 'Nannie' Sundy"                 (nickname)
//   "Annie (Leusch) Sundy"                 (birth name)
//   "Annie 'Nannie' (Leusch) Sundy"        (both)
//
// Single-word names (e.g., the seed lists pass full names like "Lucy Leusch")
// are split on the last whitespace so a multi-word first name still groups
// correctly: "Mary Ann Hogan" → first="Mary Ann", last="Hogan".
//
// Callers can also pass an already-split `firstName` + `lastName` if they
// have them.

export type NameParts = {
  /** Full name, e.g. "Annie Sundy". Either pass this OR firstName + lastName. */
  fullName?: string;
  firstName?: string;
  lastName?: string;
  nickname?: string | null;
  birth_name?: string | null;
};

export function formatDisplayName(parts: NameParts): string {
  const { firstName, lastName } = splitName(parts);
  const nick  = (parts.nickname  ?? '').trim();
  const birth = (parts.birth_name ?? '').trim();

  const segments: string[] = [];
  if (firstName) segments.push(firstName);
  if (nick) segments.push(`'${nick}'`);
  if (birth && lastName) segments.push(`(${birth})`);
  if (lastName) segments.push(lastName);

  // If we have birth_name but no last name, fall back to "(Birth)" alone next
  // to first name — uncommon but possible.
  if (birth && !lastName && firstName) {
    return `${firstName} (${birth})`;
  }
  return segments.join(' ').trim();
}

function splitName(parts: NameParts): { firstName: string; lastName: string } {
  if (parts.firstName !== undefined || parts.lastName !== undefined) {
    return { firstName: (parts.firstName ?? '').trim(), lastName: (parts.lastName ?? '').trim() };
  }
  const full = (parts.fullName ?? '').trim();
  if (!full) return { firstName: '', lastName: '' };
  const i = full.lastIndexOf(' ');
  if (i === -1) return { firstName: full, lastName: '' };
  return { firstName: full.slice(0, i), lastName: full.slice(i + 1) };
}
