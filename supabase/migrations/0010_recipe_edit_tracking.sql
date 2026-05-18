-- Track who last edited a recipe and when. Used by /recipes/[slug] to show
-- a "Last edited by X on Y" line and by the edit flow at /recipes/[slug]/edit.

alter table recipes
  add column if not exists last_edited_by_id uuid references contributors(id) on delete set null,
  add column if not exists last_edited_at    timestamptz;

-- Backfill: assume the original contributor was the last editor, and that
-- the last edit happened at publish (or row creation, for unpublished rows).
update recipes
set last_edited_by_id = contributor_id,
    last_edited_at    = coalesce(published_at, created_at)
where last_edited_at is null;
