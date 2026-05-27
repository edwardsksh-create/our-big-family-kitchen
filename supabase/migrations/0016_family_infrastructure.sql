-- Family infrastructure: separate "who can sign in" from "who is family",
-- add deceased / nickname / birth_name to contributors, track who saved each
-- recipe separately from who the recipe is attributed to, and add a
-- family_members table that holds the full family universe (including people
-- who don't author recipes and people who appear in multiple branches).

-- 1) contributors ----------------------------------------------------------

alter table contributors
  add column if not exists can_sign_in boolean not null default false,
  add column if not exists deceased    boolean not null default false,
  add column if not exists nickname    text,
  add column if not exists birth_name  text;

-- Migrate role → can_sign_in. The role column stays for backwards-compat;
-- can_sign_in is the canonical signal going forward.
update contributors
  set can_sign_in = true
  where role in ('admin', 'contributor');

-- 2) recipes.added_by_id ---------------------------------------------------

alter table recipes
  add column if not exists added_by_id uuid references contributors(id) on delete set null;

-- Backfill: for every existing recipe, the original contributor is also the
-- person who saved it to the site.
update recipes set added_by_id = contributor_id where added_by_id is null;

create index if not exists recipes_added_by_idx on recipes (added_by_id);

-- 3) family_members table --------------------------------------------------

create table if not exists family_members (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  family_line_id  uuid not null references family_lines(id) on delete cascade,
  deceased        boolean not null default false,
  nickname        text,
  birth_name      text,
  contributor_slug text,                                   -- optional link to a contributor row
  notes           text,
  sort_order      int  not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists family_members_line_sort_idx on family_members (family_line_id, sort_order);
create index if not exists family_members_contrib_idx   on family_members (contributor_slug);
