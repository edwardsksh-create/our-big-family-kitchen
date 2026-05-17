-- Our Big Family Kitchen — application schema
-- Run order: 0001_app_schema.sql → 0002_next_auth.sql → 0003_seeds.sql → 0004_rls.sql → 0005_seed_admin.sql

create extension if not exists "pgcrypto";

-- Family lines -------------------------------------------------------------

create table if not exists family_lines (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  family_type text not null check (family_type in ('primary', 'secondary')),
  sort_order  int  not null default 0,
  description text
);

-- Sections -----------------------------------------------------------------

create table if not exists sections (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  sort_order  int  not null default 0,
  color_token text not null
);

-- Contributors -------------------------------------------------------------

create table if not exists contributors (
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

create index if not exists contributors_email_idx on contributors (lower(email));

-- Contributor ↔ family line ------------------------------------------------

create table if not exists contributor_family_lines (
  contributor_id uuid not null references contributors(id) on delete cascade,
  family_line_id uuid not null references family_lines(id) on delete cascade,
  primary key (contributor_id, family_line_id)
);

-- Tags ---------------------------------------------------------------------

create table if not exists tags (
  id   uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null
);

-- Recipes ------------------------------------------------------------------

create table if not exists recipes (
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

create unique index if not exists recipes_slug_unique     on recipes (slug) where slug is not null;
create        index if not exists recipes_status_idx          on recipes (status);
create        index if not exists recipes_contributor_idx     on recipes (contributor_id);
create        index if not exists recipes_primary_family_idx  on recipes (primary_family_line_id);
create        index if not exists recipes_section_idx         on recipes (section_id);

-- Recipe components --------------------------------------------------------

create table if not exists ingredients (
  id         uuid primary key default gen_random_uuid(),
  recipe_id  uuid not null references recipes(id) on delete cascade,
  sub_header text,
  item_text  text not null,
  sort_order int  not null
);

create index if not exists ingredients_recipe_idx on ingredients (recipe_id, sort_order);

create table if not exists instructions (
  id         uuid primary key default gen_random_uuid(),
  recipe_id  uuid not null references recipes(id) on delete cascade,
  sub_header text,
  body       text not null,
  sort_order int  not null
);

create index if not exists instructions_recipe_idx on instructions (recipe_id, sort_order);

create table if not exists recipe_tags (
  recipe_id uuid not null references recipes(id) on delete cascade,
  tag_id    uuid not null references tags(id)    on delete cascade,
  primary key (recipe_id, tag_id)
);

create table if not exists photos (
  id             uuid primary key default gen_random_uuid(),
  recipe_id      uuid not null references recipes(id) on delete cascade,
  contributor_id uuid references contributors(id) on delete set null,
  url            text not null,
  caption        text,
  sort_order     int  not null default 0
);

create index if not exists photos_recipe_idx on photos (recipe_id, sort_order);

-- Comments -----------------------------------------------------------------

create table if not exists comments (
  id             uuid primary key default gen_random_uuid(),
  recipe_id      uuid not null references recipes(id) on delete cascade,
  contributor_id uuid references contributors(id) on delete set null,
  type           text not null default 'tip'       check (type   in ('tip', 'story', 'question')),
  body           text not null,
  status         text not null default 'published' check (status in ('pending', 'published', 'hidden')),
  created_at     timestamptz not null default now()
);

create index if not exists comments_recipe_idx on comments (recipe_id, created_at);

-- Invitations --------------------------------------------------------------

create table if not exists invitations (
  id              uuid primary key default gen_random_uuid(),
  email           text unique not null,
  family_line_ids uuid[] not null default '{}',
  invited_by_id   uuid references contributors(id) on delete set null,
  sent_at         timestamptz not null default now(),
  accepted_at     timestamptz,
  token           text unique not null
);

create index if not exists invitations_email_idx on invitations (lower(email));

-- Submissions --------------------------------------------------------------

create table if not exists submissions (
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

create table if not exists federated_recipes (
  id               uuid primary key default gen_random_uuid(),
  source_url       text not null,
  title            text not null,
  contributor_name text,
  section_slug     text,
  search_tokens    text,
  fetched_at       timestamptz not null default now()
);

create index if not exists federated_recipes_source_idx on federated_recipes (source_url);

-- Updated-at trigger -------------------------------------------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists recipes_set_updated_at on recipes;
create trigger recipes_set_updated_at
  before update on recipes
  for each row execute function set_updated_at();
-- next_auth schema for the @auth/supabase-adapter
-- Mirrors https://authjs.dev/getting-started/adapters/supabase

create schema if not exists next_auth;

grant usage on schema next_auth to service_role;
grant all  on schema next_auth to postgres;

create table if not exists next_auth.users (
  id              uuid primary key default gen_random_uuid(),
  name            text,
  email           text,
  "emailVerified" timestamptz,
  image           text
);

create unique index if not exists email_unique on next_auth.users (email);

create table if not exists next_auth.sessions (
  id             uuid primary key default gen_random_uuid(),
  expires        timestamptz not null,
  "sessionToken" text not null,
  "userId"       uuid references next_auth.users(id) on delete cascade
);

create unique index if not exists sessions_session_token_unique on next_auth.sessions ("sessionToken");

create table if not exists next_auth.accounts (
  id                  uuid primary key default gen_random_uuid(),
  type                text not null,
  provider            text not null,
  "providerAccountId" text not null,
  refresh_token       text,
  access_token        text,
  expires_at          bigint,
  token_type          text,
  scope               text,
  id_token            text,
  session_state       text,
  oauth_token_secret  text,
  oauth_token         text,
  "userId"            uuid references next_auth.users(id) on delete cascade
);

create unique index if not exists accounts_provider_account_unique
  on next_auth.accounts (provider, "providerAccountId");

create table if not exists next_auth.verification_tokens (
  identifier text not null,
  token      text not null,
  expires    timestamptz not null,
  primary key (identifier, token)
);

-- The adapter is invoked from the Next.js server using the service-role key,
-- so it bypasses RLS. We still enable it to be safe.
alter table next_auth.users               enable row level security;
alter table next_auth.sessions            enable row level security;
alter table next_auth.accounts            enable row level security;
alter table next_auth.verification_tokens enable row level security;
-- Pre-population of family_lines, sections, tags.
-- Kate is seeded as the first admin via a separate script that reads ADMIN_EMAIL.

insert into family_lines (slug, name, family_type, sort_order) values
  ('leusch',   'Leusch',   'primary',   1),
  ('sundy',    'Sundy',    'primary',   2),
  ('edwards',  'Edwards',  'primary',   3),
  ('hong',     'Hong',     'primary',   4),
  ('quinn',    'Quinn',    'secondary', 5),
  ('branion',  'Branion',  'secondary', 6)
on conflict (slug) do nothing;

insert into sections (slug, name, sort_order, color_token) values
  ('breakfast',         'Breakfast',          1,  'blush'),
  ('drinks',            'Drinks',             2,  'gold'),
  ('appetizers',        'Appetizers',         3,  'rose'),
  ('soups',             'Soups',              4,  'burgundy'),
  ('salad-dressings',   'Salad Dressings',    5,  'olive'),
  ('salads',            'Salads',             6,  'mauve'),
  ('sandwiches',        'Sandwiches',         7,  'sky'),
  ('starches',          'Starches',           8,  'slate'),
  ('vegetables',        'Vegetables',         9,  'navy'),
  ('fish-entrees',      'Fish Entrées',       10, 'slate'),
  ('meat-entrees',      'Meat Entrées',       11, 'burgundy'),
  ('cookies-and-candy', 'Cookies and Candy',  12, 'rose'),
  ('desserts',          'Desserts',           13, 'gold')
on conflict (slug) do nothing;
-- Row-Level Security policies
--
-- Phase 1 note: all Next.js server queries run with the service-role key, which
-- bypasses RLS. These policies are defined as defense-in-depth so that any
-- future client-side query (Phase 2+) is constrained as the spec requires.
--
-- The "current user" is resolved via auth.jwt() -> 'email', which is what the
-- NextAuth → Supabase JWT bridge will populate once we wire it. Until then,
-- RLS effectively denies all non-service-role traffic.
--
-- Helpers live in the `public` schema (not `auth`) because the dashboard SQL
-- editor user cannot create functions in the `auth` schema.

-- Helpers ------------------------------------------------------------------

create or replace function public.current_contributor_id()
returns uuid
language sql stable
security definer
set search_path = public as $$
  select c.id from public.contributors c
  where lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql stable
security definer
set search_path = public as $$
  select exists (
    select 1 from public.contributors c
    where lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and c.role = 'admin'
  )
$$;

grant execute on function public.current_contributor_id() to authenticated, anon;
grant execute on function public.is_admin()                to authenticated, anon;

-- Enable RLS on every public table -----------------------------------------

alter table family_lines             enable row level security;
alter table sections                 enable row level security;
alter table contributors             enable row level security;
alter table contributor_family_lines enable row level security;
alter table tags                     enable row level security;
alter table recipes                  enable row level security;
alter table ingredients              enable row level security;
alter table instructions             enable row level security;
alter table recipe_tags              enable row level security;
alter table photos                   enable row level security;
alter table comments                 enable row level security;
alter table invitations              enable row level security;
alter table submissions              enable row level security;
alter table federated_recipes        enable row level security;

-- family_lines & sections --------------------------------------------------

drop policy if exists family_lines_read         on family_lines;
drop policy if exists family_lines_admin_write  on family_lines;

create policy family_lines_read on family_lines
  for select to authenticated using (true);

create policy family_lines_admin_write on family_lines
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists sections_read         on sections;
drop policy if exists sections_admin_write  on sections;

create policy sections_read on sections
  for select to authenticated using (true);

create policy sections_admin_write on sections
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Contributors -------------------------------------------------------------

drop policy if exists contributors_read_all      on contributors;
drop policy if exists contributors_update_self   on contributors;
drop policy if exists contributors_admin_insert  on contributors;
drop policy if exists contributors_admin_delete  on contributors;

create policy contributors_read_all on contributors
  for select to authenticated using (true);

create policy contributors_update_self on contributors
  for update to authenticated
  using (id = public.current_contributor_id())
  with check (id = public.current_contributor_id());

create policy contributors_admin_insert on contributors
  for insert to authenticated
  with check (public.is_admin());

create policy contributors_admin_delete on contributors
  for delete to authenticated using (public.is_admin());

-- Contributor ↔ family line ------------------------------------------------

drop policy if exists cfl_read                  on contributor_family_lines;
drop policy if exists cfl_self_or_admin_write   on contributor_family_lines;

create policy cfl_read on contributor_family_lines
  for select to authenticated using (true);

create policy cfl_self_or_admin_write on contributor_family_lines
  for all to authenticated
  using (contributor_id = public.current_contributor_id() or public.is_admin())
  with check (contributor_id = public.current_contributor_id() or public.is_admin());

-- Tags ---------------------------------------------------------------------

drop policy if exists tags_read                on tags;
drop policy if exists tags_contributor_write   on tags;
drop policy if exists tags_admin_mutate        on tags;
drop policy if exists tags_admin_delete        on tags;

create policy tags_read on tags
  for select to authenticated using (true);

create policy tags_contributor_write on tags
  for insert to authenticated with check (public.current_contributor_id() is not null);

create policy tags_admin_mutate on tags
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy tags_admin_delete on tags
  for delete to authenticated using (public.is_admin());

-- Recipes ------------------------------------------------------------------

drop policy if exists recipes_published_read       on recipes;
drop policy if exists recipes_own_or_admin_read    on recipes;
drop policy if exists recipes_own_or_admin_update  on recipes;
drop policy if exists recipes_contributor_insert   on recipes;
drop policy if exists recipes_admin_delete         on recipes;

create policy recipes_published_read on recipes
  for select to authenticated using (status = 'published');

create policy recipes_own_or_admin_read on recipes
  for select to authenticated
  using (contributor_id = public.current_contributor_id() or public.is_admin());

create policy recipes_own_or_admin_update on recipes
  for update to authenticated
  using (contributor_id = public.current_contributor_id() or public.is_admin())
  with check (contributor_id = public.current_contributor_id() or public.is_admin());

create policy recipes_contributor_insert on recipes
  for insert to authenticated
  with check (
    public.current_contributor_id() is not null
    and contributor_id = public.current_contributor_id()
  );

create policy recipes_admin_delete on recipes
  for delete to authenticated using (public.is_admin());

-- Ingredients / instructions / recipe_tags / photos: inherit recipe access --

drop policy if exists ingredients_inherit_read   on ingredients;
drop policy if exists ingredients_inherit_write  on ingredients;

create policy ingredients_inherit_read on ingredients
  for select to authenticated
  using (
    exists (
      select 1 from recipes r
      where r.id = ingredients.recipe_id
        and (r.status = 'published'
             or r.contributor_id = public.current_contributor_id()
             or public.is_admin())
    )
  );

create policy ingredients_inherit_write on ingredients
  for all to authenticated
  using (
    exists (
      select 1 from recipes r
      where r.id = ingredients.recipe_id
        and (r.contributor_id = public.current_contributor_id() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from recipes r
      where r.id = ingredients.recipe_id
        and (r.contributor_id = public.current_contributor_id() or public.is_admin())
    )
  );

drop policy if exists instructions_inherit_read   on instructions;
drop policy if exists instructions_inherit_write  on instructions;

create policy instructions_inherit_read on instructions
  for select to authenticated
  using (
    exists (
      select 1 from recipes r
      where r.id = instructions.recipe_id
        and (r.status = 'published'
             or r.contributor_id = public.current_contributor_id()
             or public.is_admin())
    )
  );

create policy instructions_inherit_write on instructions
  for all to authenticated
  using (
    exists (
      select 1 from recipes r
      where r.id = instructions.recipe_id
        and (r.contributor_id = public.current_contributor_id() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from recipes r
      where r.id = instructions.recipe_id
        and (r.contributor_id = public.current_contributor_id() or public.is_admin())
    )
  );

drop policy if exists recipe_tags_inherit_read   on recipe_tags;
drop policy if exists recipe_tags_inherit_write  on recipe_tags;

create policy recipe_tags_inherit_read on recipe_tags
  for select to authenticated
  using (
    exists (
      select 1 from recipes r
      where r.id = recipe_tags.recipe_id
        and (r.status = 'published'
             or r.contributor_id = public.current_contributor_id()
             or public.is_admin())
    )
  );

create policy recipe_tags_inherit_write on recipe_tags
  for all to authenticated
  using (
    exists (
      select 1 from recipes r
      where r.id = recipe_tags.recipe_id
        and (r.contributor_id = public.current_contributor_id() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from recipes r
      where r.id = recipe_tags.recipe_id
        and (r.contributor_id = public.current_contributor_id() or public.is_admin())
    )
  );

drop policy if exists photos_inherit_read   on photos;
drop policy if exists photos_inherit_write  on photos;

create policy photos_inherit_read on photos
  for select to authenticated
  using (
    exists (
      select 1 from recipes r
      where r.id = photos.recipe_id
        and (r.status = 'published'
             or r.contributor_id = public.current_contributor_id()
             or public.is_admin())
    )
  );

create policy photos_inherit_write on photos
  for all to authenticated
  using (
    exists (
      select 1 from recipes r
      where r.id = photos.recipe_id
        and (r.contributor_id = public.current_contributor_id() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from recipes r
      where r.id = photos.recipe_id
        and (r.contributor_id = public.current_contributor_id() or public.is_admin())
    )
  );

-- Comments -----------------------------------------------------------------

drop policy if exists comments_published_read         on comments;
drop policy if exists comments_own_or_admin_read      on comments;
drop policy if exists comments_insert                 on comments;
drop policy if exists comments_update_own             on comments;
drop policy if exists comments_delete_own_or_admin    on comments;

create policy comments_published_read on comments
  for select to authenticated using (status = 'published');

create policy comments_own_or_admin_read on comments
  for select to authenticated
  using (contributor_id = public.current_contributor_id() or public.is_admin());

create policy comments_insert on comments
  for insert to authenticated
  with check (
    public.current_contributor_id() is not null
    and contributor_id = public.current_contributor_id()
  );

create policy comments_update_own on comments
  for update to authenticated
  using (contributor_id = public.current_contributor_id())
  with check (contributor_id = public.current_contributor_id());

create policy comments_delete_own_or_admin on comments
  for delete to authenticated
  using (contributor_id = public.current_contributor_id() or public.is_admin());

-- Admin-only tables --------------------------------------------------------

drop policy if exists submissions_admin_all         on submissions;
drop policy if exists invitations_admin_all         on invitations;
drop policy if exists federated_recipes_admin_all   on federated_recipes;
drop policy if exists federated_recipes_read        on federated_recipes;

create policy submissions_admin_all on submissions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy invitations_admin_all on invitations
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy federated_recipes_admin_all on federated_recipes
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy federated_recipes_read on federated_recipes
  for select to authenticated using (true);
-- Seed the bootstrap admin contributor.
-- The email is parameterized via :admin_email; for one-shot dashboard runs
-- we inline it below. Update if Kate ever changes her primary email.

insert into contributors (email, name, role, joined_at)
values ('edwards.ksh@gmail.com', 'Kate', 'admin', now())
on conflict (email) do update set role = 'admin';
-- Grant service_role access to all application tables.
--
-- When tables are created via the dashboard SQL editor (instead of through
-- the Supabase CLI's auto-grants), the service_role does not get table
-- privileges by default. The Data API then returns 42501 permission denied.
--
-- We grant only to service_role for Phase 1 (server-side access only).
-- anon/authenticated grants will be added in Phase 2 along with client-side
-- access via the @supabase/ssr bridge.

grant usage on schema public to service_role;

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- Future tables created in this schema automatically get grants for service_role.
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;

-- next_auth schema: the @auth/supabase-adapter reads/writes here via service_role.
grant usage on schema next_auth to service_role;
grant all on all tables    in schema next_auth to service_role;
grant all on all sequences in schema next_auth to service_role;
alter default privileges in schema next_auth grant all on tables    to service_role;
alter default privileges in schema next_auth grant all on sequences to service_role;
