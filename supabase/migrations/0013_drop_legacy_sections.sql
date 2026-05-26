-- Delete the legacy 13-section rows that are no longer referenced.
-- Run only after scripts/recategorize-sections.mjs --apply has finished and
-- the orphan check (in that script) reported 0 native and 0 federated rows
-- pointing at any of these slugs.

do $$
declare
  legacy_slugs text[] := array[
    'breakfast', 'appetizers', 'soups', 'salad-dressings', 'salads',
    'starches', 'vegetables', 'fish-entrees', 'meat-entrees',
    'cookies-and-candy'
  ];
  orphan_recipes int;
  orphan_fed     int;
begin
  select count(*) into orphan_recipes
    from recipes r
    join sections s on s.id = r.section_id
   where s.slug = any(legacy_slugs);
  if orphan_recipes > 0 then
    raise exception 'Refusing to delete legacy sections: % native recipes still reference them', orphan_recipes;
  end if;

  select count(*) into orphan_fed
    from federated_recipes
   where section_slug = any(legacy_slugs);
  if orphan_fed > 0 then
    raise exception 'Refusing to delete legacy sections: % federated recipes still reference them', orphan_fed;
  end if;
end $$;

delete from sections where slug in (
  'breakfast', 'appetizers', 'soups', 'salad-dressings', 'salads',
  'starches', 'vegetables', 'fish-entrees', 'meat-entrees',
  'cookies-and-candy'
);
