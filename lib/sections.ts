export type SectionColorToken =
  | 'blush'
  | 'olive'
  | 'sky'
  | 'gold'
  | 'mauve'
  | 'slate'
  | 'rose'
  | 'burgundy'
  | 'navy';

export type Section = {
  slug: string;
  name: string;
  color: SectionColorToken;
};

export const SECTIONS: Section[] = [
  { slug: 'breakfast',         name: 'Breakfast',          color: 'blush'    },
  { slug: 'drinks',            name: 'Drinks',             color: 'gold'     },
  { slug: 'appetizers',        name: 'Appetizers',         color: 'rose'     },
  { slug: 'soups',             name: 'Soups',              color: 'burgundy' },
  { slug: 'salad-dressings',   name: 'Salad Dressings',    color: 'olive'    },
  { slug: 'salads',            name: 'Salads',             color: 'mauve'    },
  { slug: 'sandwiches',        name: 'Sandwiches',         color: 'sky'      },
  { slug: 'starches',          name: 'Starches',           color: 'slate'    },
  { slug: 'vegetables',        name: 'Vegetables',         color: 'navy'     },
  { slug: 'fish-entrees',      name: 'Fish Entrées',       color: 'slate'    },
  { slug: 'meat-entrees',      name: 'Meat Entrées',       color: 'burgundy' },
  { slug: 'cookies-and-candy', name: 'Cookies and Candy',  color: 'rose'     },
  { slug: 'desserts',          name: 'Desserts',           color: 'gold'     },
];

export const SECTION_BG: Record<SectionColorToken, string> = {
  blush:    'bg-card-blush',
  olive:    'bg-card-olive',
  sky:      'bg-card-sky',
  gold:     'bg-card-gold',
  mauve:    'bg-card-mauve',
  slate:    'bg-card-slate',
  rose:     'bg-card-rose',
  burgundy: 'bg-card-burgundy',
  navy:     'bg-card-navy',
};

// Light text reads better on every section color in this palette.
export const SECTION_TEXT: Record<SectionColorToken, string> = {
  blush:    'text-ink',
  olive:    'text-paper',
  sky:      'text-ink',
  gold:     'text-ink',
  mauve:    'text-paper',
  slate:    'text-paper',
  rose:     'text-paper',
  burgundy: 'text-paper',
  navy:     'text-paper',
};

export function sectionBySlug(slug: string): Section | undefined {
  return SECTIONS.find((s) => s.slug === slug);
}
