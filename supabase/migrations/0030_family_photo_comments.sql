-- Memories on photos — the same communal layer recipes have (0021),
-- mirrored for the album. Any signed-in contributor with can_sign_in can
-- post; delete by the author or admin; no edit in v1.

create table if not exists family_photo_comments (
  id                    uuid primary key default gen_random_uuid(),
  family_photo_id       uuid not null references family_photos(id) on delete cascade,
  -- ON DELETE RESTRICT mirrors recipe_comments: deleting a contributor
  -- doesn't silently erase their memories.
  author_contributor_id uuid not null references contributors(id) on delete restrict,
  body                  text not null,
  created_at            timestamptz not null default now()
);

create index if not exists family_photo_comments_photo_created_idx
  on family_photo_comments (family_photo_id, created_at desc);

create index if not exists family_photo_comments_author_idx
  on family_photo_comments (author_contributor_id);
