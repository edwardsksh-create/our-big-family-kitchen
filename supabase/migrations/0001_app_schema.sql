-- Our Big Family Kitchen — application schema
-- Run order: 0001_app_schema.sql → 0002_next_auth.sql → 0003_seeds.sql → 0004_rls.sql

create extension if not exists "pgcrypto";

-- Family lines -------------------------------------------------------------

create table family_lines (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  family_type text not null check (family_type in ('primary', 'secondary')),
  sort_order  int  not null default 0,
  description text
);

-- Sections -----------------------------------------------------------------

create table sections (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  sort_order  int  not null default 0,
  color_token text not null
);

-- Contributors -------------------------------------------------------------

create table contributors (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  name          text,
  photo_url     text,
  bio           text,
  role          text not null default 'viewer' check (role in ('admin', 'contributor', 'viewer')),
  joined_at     timestamptz,
  invited_at    timestamptz,
  invited_by_id uuid references contributors(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index contributors_email_idx on contributors (lower(email));

-- Contributor ↔ family line ------------------------------------------------

create table contributor_family_lines (
  contributor_id uuid not null references contributors(id) on delete cascade,
  family_line_id uuid not null references family_lines(id) on delete cascade,
  primary key (contributor_id, family_line_id)
);

-- Tags ---------------------------------------------------------------------

create table tags (
  id   uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null
);

-- Recipes ------------------------------------------------------------------

create table recipes (
  id                       uuid primary key default gen_random_uuid(),
  title                    text not null,
  slug                     text,
  contributor_id           uuid not null references contributors(id) on delete restrict,
  originally_from          text,
  primary_family_line_id   uuid not null references family_lines(id) on delete restrict,
  secondary_family_line_id uuid references family_lines(id) on delete set null,
  section_id               uuid not null references sections(id) on delete restrict,
  story                    text,
  status                   text not null default 'draft'
                             check (status in ('draft', 'pending_review', 'published', 'rejected')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  published_at             timestamptz
);

create unique index recipes_slug_unique on recipes (slug) where slug is not null;
create index recipes_status_idx          on recipes (status);
create index recipes_contributor_idx     on recipes (contributor_id);
create index recipes_primary_family_idx  on recipes (primary_family_line_id);
create index recipes_section_idx         on recipes (section_id);

-- Recipe components --------------------------------------------------------

create table ingredients (
  id         uuid primary key default gen_random_uuid(),
  recipe_id  uuid not null references recipes(id) on delete cascade,
  sub_header text,
  item_text  text not null,
  sort_order int  not null
);

create index ingredients_recipe_idx on ingredients (recipe_id, sort_order);

create table instructions (
  id         uuid primary key default gen_random_uuid(),
  recipe_id  uuid not null references recipes(id) on delete cascade,
  sub_header text,
  body       text not null,
  sort_order int  not null
);

create index instructions_recipe_idx on instructions (recipe_id, sort_order);

create table recipe_tags (
  recipe_id uuid not null references recipes(id) on delete cascade,
  tag_id    uuid not null references tags(id)    on delete cascade,
  primary key (recipe_id, tag_id)
);

create table photos (
  id             uuid primary key default gen_random_uuid(),
  recipe_id      uuid not null references recipes(id) on delete cascade,
  contributor_id uuid references contributors(id) on delete set null,
  url            text not null,
  caption        text,
  sort_order     int  not null default 0
);

create index photos_recipe_idx on photos (recipe_id, sort_order);

-- Comments -----------------------------------------------------------------

create table comments (
  id             uuid primary key default gen_random_uuid(),
  recipe_id      uuid not null references recipes(id) on delete cascade,
  contributor_id uuid references contributors(id) on delete set null,
  type           text not null default 'tip'       check (type   in ('tip', 'story', 'question')),
  body           text not null,
  status         text not null default 'published' check (status in ('pending', 'published', 'hidden')),
  created_at     timestamptz not null default now()
);

create index comments_recipe_idx on comments (recipe_id, created_at);

-- Invitations --------------------------------------------------------------

create table invitations (
  id              uuid primary key default gen_random_uuid(),
  email           text unique not null,
  family_line_ids uuid[] not null default '{}',
  invited_by_id   uuid references contributors(id) on delete set null,
  sent_at         timestamptz not null default now(),
  accepted_at     timestamptz,
  token           text unique not null
);

create index invitations_email_idx on invitations (lower(email));

-- Submissions --------------------------------------------------------------

create table submissions (
  id                      uuid primary key default gen_random_uuid(),
  source                  text not null check (source in ('form', 'email', 'photo_upload')),
  raw_payload             jsonb not null,
  contributor_id          uuid references contributors(id) on delete set null,
  status                  text not null default 'queued' check (status in ('queued', 'approved', 'rejected')),
  reviewed_by_id          uuid references contributors(id) on delete set null,
  reviewed_at             timestamptz,
  recipe_id_if_published  uuid references recipes(id) on delete set null,
  created_at              timestamptz not null default now()
);

-- Federated recipes (read-only mirror of leusch-family-recipes for search) -

create table federated_recipes (
  id               uuid primary key default gen_random_uuid(),
  source_url       text not null,
  title            text not null,
  contributor_name text,
  section_slug     text,
  search_tokens    text,
  fetched_at       timestamptz not null default now()
);

create index federated_recipes_source_idx on federated_recipes (source_url);

-- Updated-at trigger -------------------------------------------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger recipes_set_updated_at
  before update on recipes
  for each row execute function set_updated_at();
