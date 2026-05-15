-- Pre-population of family_lines, sections, tags.
-- Kate is seeded as the first admin via a separate script that reads ADMIN_EMAIL.

insert into family_lines (slug, name, family_type, sort_order) values
  ('leusch',   'Leusch',   'primary',   1),
  ('sundy',    'Sundy',    'primary',   2),
  ('edwards',  'Edwards',  'primary',   3),
  ('hong',     'Hong',     'primary',   4),
  ('quinn',    'Quinn',    'secondary', 5),
  ('branion',  'Branion',  'secondary', 6)
on conflict (slug) do nothing;

insert into sections (slug, name, sort_order, color_token) values
  ('breakfast',         'Breakfast',          1,  'blush'),
  ('drinks',            'Drinks',             2,  'gold'),
  ('appetizers',        'Appetizers',         3,  'rose'),
  ('soups',             'Soups',              4,  'burgundy'),
  ('salad-dressings',   'Salad Dressings',    5,  'olive'),
  ('salads',            'Salads',             6,  'mauve'),
  ('sandwiches',        'Sandwiches',         7,  'sky'),
  ('starches',          'Starches',           8,  'slate'),
  ('vegetables',        'Vegetables',         9,  'navy'),
  ('fish-entrees',      'Fish Entrées',       10, 'slate'),
  ('meat-entrees',      'Meat Entrées',       11, 'burgundy'),
  ('cookies-and-candy', 'Cookies and Candy',  12, 'rose'),
  ('desserts',          'Desserts',           13, 'gold')
on conflict (slug) do nothing;
