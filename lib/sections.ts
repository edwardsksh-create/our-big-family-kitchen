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
  { slug: 'breakfast-and-brunch',       name: 'Breakfast and Brunch',         color: 'burgundy' },
  { slug: 'drinks',                     name: 'Drinks',                       color: 'blush'    },
  { slug: 'appetizers-and-snacks',      name: 'Appetizers and Snacks',        color: 'rose'     },
  { slug: 'soups-and-stews',            name: 'Soups and Stews',              color: 'gold'     },
  { slug: 'chili',                      name: 'Chili',                        color: 'olive'    },
  { slug: 'salads-and-dressings',       name: 'Salads and Dressings',         color: 'sky'      },
  { slug: 'sandwiches',                 name: 'Sandwiches',                   color: 'navy'     },
  { slug: 'pasta-and-noodles',          name: 'Pasta and Noodles',            color: 'slate'    },
  { slug: 'mains-chicken-turkey',       name: 'Mains: Chicken and Turkey',    color: 'mauve'    },
  { slug: 'mains-beef-pork-lamb',       name: 'Mains: Beef, Pork and Lamb',   color: 'burgundy' },
  { slug: 'mains-fish-seafood',         name: 'Mains: Fish and Seafood',      color: 'blush'    },
  { slug: 'mains-vegetarian',           name: 'Mains: Vegetarian',            color: 'rose'     },
  { slug: 'sides-vegetables',           name: 'Sides: Vegetables',            color: 'gold'     },
  { slug: 'sides-potatoes-rice-grains', name: 'Sides: Potatoes, Rice and Grains', color: 'olive' },
  { slug: 'breads',                     name: 'Breads',                       color: 'sky'      },
  { slug: 'desserts',                   name: 'Desserts',                     color: 'navy'     },
];

// Old → new slug mapping used for /sections/[old-slug] redirects and the
// deterministic part of the 13→16 section migration. Recipes in
// `meat-entrees`, `soups`, `starches`, and `breakfast` were recategorized
// per-recipe by AI rather than by this table.
export const LEGACY_SECTION_REDIRECTS: Record<string, string> = {
  'breakfast':         'breakfast-and-brunch',
  'appetizers':        'appetizers-and-snacks',
  'soups':             'soups-and-stews',
  'salad-dressings':   'salads-and-dressings',
  'salads':            'salads-and-dressings',
  'vegetables':        'sides-vegetables',
  'starches':          'sides-potatoes-rice-grains',
  'fish-entrees':      'mains-fish-seafood',
  'meat-entrees':      'mains-beef-pork-lamb',
  'cookies-and-candy': 'desserts',
};

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

// Body copy shown under each section heading. Missing slugs render no body.
export const SECTION_BLURBS: Record<string, string> = {
  'breakfast-and-brunch':
    'For holiday mornings, slow weekends, overnight guests, and the family recipes that somehow count as both breakfast and dinner.',
  'desserts':
    'Cakes, cookies, pies, holiday sweets, and the recipes people ask for before they leave the party.',
  'soups-and-stews':
    'Big pots, cold nights, sick days, Sunday simmering, and the soups that taste even better tomorrow.',
  'appetizers-and-snacks':
    'The things that disappear first: party bites, porch snacks, holiday nibbles, and recipes made for passing around.',
  'chili':
    'Family chili recipes, game-day pots, freezer favorites, and the versions everyone quietly thinks are the best.',
  'sides-potatoes-rice-grains':
    'The supporting players that sometimes steal the whole meal.',
};
