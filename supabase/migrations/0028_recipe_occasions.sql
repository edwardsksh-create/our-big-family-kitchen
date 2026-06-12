-- Recipes ↔ occasions.
--
-- Photos have had occasions since 0017 (family_photo_occasion_types /
-- family_photo_occasions); recipes now join the SAME vocabulary, so
-- "Thanksgiving" means one thing across the whole archive and an occasion
-- page can interleave the holiday's recipes, photos, and memories.
--
-- ON DELETE RESTRICT on the type mirrors family_photo_occasions: an
-- occasion type can't vanish while anything references it. Occasion
-- vocabulary stays managed from photo review for now — recipe tagging
-- only selects from existing types.

create table if not exists recipe_occasions (
  recipe_id     uuid not null references recipes(id) on delete cascade,
  occasion_slug text not null references family_photo_occasion_types(slug) on delete restrict,
  primary key (recipe_id, occasion_slug)
);

create index if not exists recipe_occasions_occasion_idx on recipe_occasions (occasion_slug);
