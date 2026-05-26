-- Restructure to 16 sections (up from 13).
-- New scheme separates mains by protein, splits Soups/Chili,
-- and adds Pasta & Noodles, Breads, and Mains: Vegetarian.
--
-- This migration is the *deterministic* portion of the remap:
--   1. Insert the 13 truly-new sections (drinks, sandwiches, desserts carry over).
--   2. Update display metadata (sort_order, name, color) for all 16.
--   3. For native recipes whose old section has a 1:1 new home,
--      point them at the new section_id.
--   4. For federated_recipes (which carry section_slug, not section_id),
--      update those with a deterministic mapping.
--
-- Old sections that still have recipes after this migration are the four
-- "ambiguous" sources (meat-entrees, soups, starches, breakfast). A separate
-- AI-driven script (scripts/recategorize-sections.mjs) finishes those, and
-- migration 0013 deletes the now-empty old rows once orphans are gone.

-- 1) Insert the new sections (idempotent) ------------------------------------
-- drinks, sandwiches, and desserts already exist from migration 0003.

insert into sections (slug, name, sort_order, color_token) values
  ('breakfast-and-brunch',       'Breakfast & Brunch',              1,  'blush'),
  ('appetizers-and-snacks',      'Appetizers & Snacks',             3,  'rose'),
  ('soups-and-stews',            'Soups & Stews',                   4,  'burgundy'),
  ('chili',                      'Chili',                           5,  'mauve'),
  ('salads-and-dressings',       'Salads & Dressings',              6,  'olive'),
  ('pasta-and-noodles',          'Pasta & Noodles',                 8,  'gold'),
  ('mains-chicken-turkey',       'Mains: Chicken & Turkey',         9,  'rose'),
  ('mains-beef-pork-lamb',       'Mains: Beef, Pork & Lamb',        10, 'burgundy'),
  ('mains-fish-seafood',         'Mains: Fish & Seafood',           11, 'slate'),
  ('mains-vegetarian',           'Mains: Vegetarian',               12, 'olive'),
  ('sides-vegetables',           'Sides: Vegetables',               13, 'navy'),
  ('sides-potatoes-rice-grains', 'Sides: Potatoes, Rice & Grains',  14, 'slate'),
  ('breads',                     'Breads',                          15, 'gold')
on conflict (slug) do nothing;

-- 2) Fix metadata for sections that carry over from the old scheme -----------

update sections set sort_order =  2, color_token = 'gold' where slug = 'drinks';
update sections set sort_order =  7, color_token = 'sky'  where slug = 'sandwiches';
update sections set sort_order = 16, color_token = 'rose' where slug = 'desserts';

-- 3) Deterministic native-recipe remap ---------------------------------------
-- The four ambiguous sources (meat-entrees, soups, starches, breakfast) are
-- handled by the AI pass.

with mapping(old_slug, new_slug) as (values
  ('appetizers',        'appetizers-and-snacks'),
  ('salad-dressings',   'salads-and-dressings'),
  ('salads',            'salads-and-dressings'),
  ('vegetables',        'sides-vegetables'),
  ('fish-entrees',      'mains-fish-seafood'),
  ('cookies-and-candy', 'desserts')
)
update recipes r
   set section_id = ns.id
  from sections os
  join mapping m on m.old_slug  = os.slug
  join sections ns on ns.slug   = m.new_slug
 where r.section_id = os.id;

-- 4) Deterministic federated-recipe remap ------------------------------------

update federated_recipes set section_slug = 'appetizers-and-snacks'  where section_slug = 'appetizers';
update federated_recipes set section_slug = 'salads-and-dressings'   where section_slug in ('salads', 'salad-dressings');
update federated_recipes set section_slug = 'sides-vegetables'       where section_slug = 'vegetables';
update federated_recipes set section_slug = 'mains-fish-seafood'     where section_slug = 'fish-entrees';
update federated_recipes set section_slug = 'desserts'               where section_slug = 'cookies-and-candy';
