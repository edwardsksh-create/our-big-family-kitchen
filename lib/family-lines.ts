export type FamilyType = 'primary' | 'secondary';

export type FamilyColorToken =
  | 'burgundy'
  | 'gold'
  | 'rose'
  | 'sky'
  | 'olive'
  | 'slate'
  | 'navy'
  | 'mauve';

export type FamilyLine = {
  slug: string;
  name: string;
  type: FamilyType;
  blurb: string;
  color: FamilyColorToken;
};

// Canonical order — must match the family_lines.sort_order column in the DB.
export const FAMILY_LINES: FamilyLine[] = [
  { slug: 'leusch',        name: 'Leusch',        type: 'primary',   color: 'burgundy', blurb: 'The archive — recipes preserved from generations past.' },
  { slug: 'quinn',         name: 'Quinn',         type: 'secondary', color: 'olive',    blurb: 'New traditions, brought in by marriage and love.' },
  { slug: 'branion',       name: 'Branion',       type: 'secondary', color: 'slate',    blurb: 'New traditions, brought in by marriage and love.' },
  { slug: 'sundy',         name: 'Sundy',         type: 'primary',   color: 'gold',     blurb: 'Sunday tables, casseroles, garden-grown plenty.' },
  { slug: 'richs-family',  name: "Rich's family", type: 'secondary', color: 'navy',     blurb: 'Rich and his extended branch — kids, grandkids, and more.' },
  { slug: 'edwards',       name: 'Edwards',       type: 'primary',   color: 'rose',     blurb: 'Quick weeknight know-how and a fondness for spice.' },
  { slug: 'hong',          name: 'Hong',          type: 'primary',   color: 'sky',      blurb: 'Soups, dumplings, and the things that taste like home.' },
  { slug: 'chosen-family', name: 'Chosen Family', type: 'secondary', color: 'mauve',    blurb: 'Family by choice — the people who became family along the way.' },
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
  navy:     'text-card-navy',
  mauve:    'text-card-mauve',
};
