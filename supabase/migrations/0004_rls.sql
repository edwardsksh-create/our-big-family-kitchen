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
