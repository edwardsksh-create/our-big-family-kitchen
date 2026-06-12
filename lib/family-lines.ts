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
  color: FamilyColorToken;
  /** Public family photo (repo asset under public/families/). Cards show
   *  it above the name; the line page shows it under the heading. */
  photo?: string;
};

// Canonical order — must match the family_lines.sort_order column in the DB.
export const FAMILY_LINES: FamilyLine[] = [
  { slug: 'leusch',        name: 'Leusch',        type: 'primary',   color: 'burgundy', photo: '/families/leusch.jpg' },
  { slug: 'quinn',         name: 'Quinn',         type: 'secondary', color: 'olive', photo: '/families/quinn.jpg' },
  { slug: 'branion',       name: 'Branion',       type: 'secondary', color: 'slate', photo: '/families/branion.jpg' },
  { slug: 'sundy',         name: 'Sundy',         type: 'primary',   color: 'gold', photo: '/families/sundy.jpg' },
  { slug: 'richs-family',  name: "Rich's family", type: 'secondary', color: 'navy', photo: '/families/richs-family.jpg' },
  { slug: 'edwards',       name: 'Edwards',       type: 'primary',   color: 'rose' },
  { slug: 'hong',          name: 'Hong',          type: 'primary',   color: 'sky', photo: '/families/hong.jpg' },
  { slug: 'chosen-family', name: 'Chosen Family', type: 'secondary', color: 'mauve' },
];

export function familyLineBySlug(slug: string): FamilyLine | undefined {
  return FAMILY_LINES.find((f) => f.slug === slug);
}

export const PRIMARY_LINES   = FAMILY_LINES.filter((f) => f.type === 'primary');
export const SECONDARY_LINES = FAMILY_LINES.filter((f) => f.type === 'secondary');

// Tailwind background class per family color token. The line's color renders
// only as an ACCENT (swatch dot on cards, rule under the line-page h1) —
// never as text on paper: the light tokens (blush, sky, gold) fail contrast
// badly, and family members' names must be fully legible everywhere.
export const FAMILY_BG: Record<FamilyColorToken, string> = {
  burgundy: 'bg-card-burgundy',
  gold:     'bg-card-gold',
  rose:     'bg-card-rose',
  sky:      'bg-card-sky',
  olive:    'bg-card-olive',
  slate:    'bg-card-slate',
  navy:     'bg-card-navy',
  mauve:    'bg-card-mauve',
};
