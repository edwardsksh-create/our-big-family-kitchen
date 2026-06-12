-- Home-page hero pool.
--
-- The home hero rotates as a "photo of the day" drawn from photos an admin
-- has explicitly opted in. Opt-in matters: the home page is PUBLIC while
-- the album is sign-in-only, so nothing appears in the hero without a
-- deliberate per-photo decision (the toggle lives in the album lightbox,
-- admin only). Default false: the archive stays private by default.

alter table family_photos
  add column if not exists hero_eligible boolean not null default false;

create index if not exists family_photos_hero_idx
  on family_photos (hero_eligible) where hero_eligible = true;
