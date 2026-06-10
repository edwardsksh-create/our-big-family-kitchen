-- Family memories on recipes. A signed-in family member can post a short
-- note on any recipe — including recipes attributed to deceased or stub
-- contributors (Aunt Laura, Aunt Sue) where the memory is most valuable.
-- Delete is allowed by the author or admin; no edit / no moderation in v1.
--
-- Separate from the unused `comments` table introduced in 0001 — that
-- table had a different shape (status, type) that this feature doesn't
-- want. Leaving it dormant rather than repurposing avoids data-mixing
-- surprises if something later starts using it.

create table if not exists recipe_comments (
  id                    uuid primary key default gen_random_uuid(),
  recipe_id             uuid not null references recipes(id) on delete cascade,
  -- ON DELETE RESTRICT on the author so deleting a contributor doesn't
  -- silently erase their memories; admin can clean those up explicitly.
  author_contributor_id uuid not null references contributors(id) on delete restrict,
  body                  text not null,
  created_at            timestamptz not null default now()
);

create index if not exists recipe_comments_recipe_created_idx
  on recipe_comments (recipe_id, created_at desc);

create index if not exists recipe_comments_author_idx
  on recipe_comments (author_contributor_id);
