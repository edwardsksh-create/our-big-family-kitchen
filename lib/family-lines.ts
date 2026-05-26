export type FamilyType = 'primary' | 'secondary';

export type FamilyColorToken =
  | 'burgundy'
  | 'gold'
  | 'rose'
  | 'sky'
  | 'olive'
  | 'slate';

export type FamilyLine = {
  slug: string;
  name: string;
  type: FamilyType;
  blurb: string;
  color: FamilyColorToken;
};

export const FAMILY_LINES: FamilyLine[] = [
  { slug: 'leusch',  name: 'Leusch',  type: 'primary',   color: 'burgundy', blurb: 'The archive — recipes preserved from generations past.' },
  { slug: 'sundy',   name: 'Sundy',   type: 'primary',   color: 'gold',     blurb: 'Sunday tables, casseroles, garden-grown plenty.' },
  { slug: 'edwards', name: 'Edwards', type: 'primary',   color: 'rose',     blurb: 'Quick weeknight know-how and a fondness for spice.' },
  { slug: 'hong',    name: 'Hong',    type: 'primary',   color: 'sky',      blurb: 'Soups, dumplings, and the things that taste like home.' },
  { slug: 'quinn',   name: 'Quinn',   type: 'secondary', color: 'olive',    blurb: 'New traditions, brought in by marriage and love.' },
  { slug: 'branion', name: 'Branion', type: 'secondary', color: 'slate',    blurb: 'New traditions, brought in by marriage and love.' },
];

export function familyLineBySlug(slug: string): FamilyLine | undefined {
  return FAMILY_LINES.find((f) => f.slug === slug);
}

export const PRIMARY_LINES   = FAMILY_LINES.filter((f) => f.type === 'primary');
export const SECONDARY_LINES = FAMILY_LINES.filter((f) => f.type === 'secondary');

// Tailwind text-color class per family color token. Used to render the family
// name and members list in the family's brand color on cards and headers.
export const FAMILY_TEXT: Record<FamilyColorToken, string> = {
  burgundy: 'text-card-burgundy',
  gold:     'text-card-gold',
  rose:     'text-card-rose',
  sky:      'text-card-sky',
  olive:    'text-card-olive',
  slate:    'text-card-slate',
};
