export type FamilyType = 'primary' | 'secondary';

export type FamilyLine = {
  slug: string;
  name: string;
  type: FamilyType;
  blurb: string;
};

export const FAMILY_LINES: FamilyLine[] = [
  { slug: 'leusch',  name: 'Leusch',  type: 'primary',   blurb: 'The archive — recipes preserved from generations past.' },
  { slug: 'sundy',   name: 'Sundy',   type: 'primary',   blurb: 'Sunday tables, casseroles, garden-grown plenty.' },
  { slug: 'edwards', name: 'Edwards', type: 'primary',   blurb: 'Quick weeknight know-how and a fondness for spice.' },
  { slug: 'hong',    name: 'Hong',    type: 'primary',   blurb: 'Soups, dumplings, and the things that taste like home.' },
  { slug: 'quinn',   name: 'Quinn',   type: 'secondary', blurb: 'New traditions, brought in by marriage and love.' },
  { slug: 'branion', name: 'Branion', type: 'secondary', blurb: 'New traditions, brought in by marriage and love.' },
];

export function familyLineBySlug(slug: string): FamilyLine | undefined {
  return FAMILY_LINES.find((f) => f.slug === slug);
}

export const PRIMARY_LINES   = FAMILY_LINES.filter((f) => f.type === 'primary');
export const SECONDARY_LINES = FAMILY_LINES.filter((f) => f.type === 'secondary');
