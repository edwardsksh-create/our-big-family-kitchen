-- Rename the "Casual Gathering" occasion to "Family Dinner" without losing
-- any photo tags. family_photo_occasions.occasion_slug references the parent
-- slug with ON DELETE RESTRICT and no ON UPDATE CASCADE, so we can't just
-- mutate the parent slug in place. Three-step dance: insert the new parent,
-- re-point every child reference, then drop the old parent.
--
-- Idempotent: every step uses `on conflict do nothing` / a slug filter, so
-- a re-apply after a partial run still ends in the right state.

insert into family_photo_occasion_types (slug, name, sort_order)
values ('family-dinner', 'Family Dinner', 19)
on conflict (slug) do update set
  name       = excluded.name,
  sort_order = excluded.sort_order;

update family_photo_occasions
set occasion_slug = 'family-dinner'
where occasion_slug = 'casual-gathering';

delete from family_photo_occasion_types
where slug = 'casual-gathering';
