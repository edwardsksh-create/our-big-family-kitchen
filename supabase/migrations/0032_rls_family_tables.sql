-- Row-Level Security for the post-0004 tables.
--
-- 0004 enabled RLS on the original schema but every table added since
-- (family infrastructure 0016, the photo archive 0017, recipe/photo
-- memories 0021/0030, recipe occasions 0028) shipped with RLS OFF — meaning
-- the anon and authenticated roles have unrestricted access to them. Every
-- Next.js query runs with the service-role key (which bypasses RLS), so the
-- live site is unaffected; these policies are the same defense-in-depth
-- 0004 describes, so a leaked anon key or a future client-side query can't
-- read or write family data it shouldn't.
--
-- Reuses the helpers from 0004: public.current_contributor_id() and
-- public.is_admin(). Access model mirrors the app:
--   * reference/seed tables (family_members, occasion types): read by any
--     authenticated user, admin writes.
--   * family_photos: a photo is visible once reviewed; its uploader and
--     admins also see it before review. Only admins curate/edit.
--   * photo join tables: inherit their photo's visibility; admin writes
--     (tagging happens on the admin review screen).
--   * comments (recipe + photo): readable when the parent is; authored by
--     the signed-in contributor; deletable by author or admin (no edit, v1).
--   * recipe_occasions: inherit the recipe; the recipe's owner or an admin
--     writes (mirrors lib/recipes/save.ts).
--
-- Enabling RLS with no permissive policy is deny-all for anon/authenticated;
-- the policies below re-open exactly the spec's intended access. Service
-- role is unaffected throughout.

-- Enable RLS ---------------------------------------------------------------

alter table family_members              enable row level security;
alter table family_photos               enable row level security;
alter table family_photo_people         enable row level security;
alter table family_photo_occasion_types enable row level security;
alter table family_photo_occasions      enable row level security;
alter table family_photo_recipes        enable row level security;
alter table family_photo_comments       enable row level security;
alter table recipe_comments             enable row level security;
alter table recipe_occasions            enable row level security;

-- family_members: reference data ------------------------------------------

drop policy if exists family_members_read        on family_members;
drop policy if exists family_members_admin_write on family_members;

create policy family_members_read on family_members
  for select to authenticated using (true);

create policy family_members_admin_write on family_members
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- family_photo_occasion_types: seed vocabulary ----------------------------

drop policy if exists fp_occasion_types_read        on family_photo_occasion_types;
drop policy if exists fp_occasion_types_admin_write on family_photo_occasion_types;

create policy fp_occasion_types_read on family_photo_occasion_types
  for select to authenticated using (true);

create policy fp_occasion_types_admin_write on family_photo_occasion_types
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- family_photos ------------------------------------------------------------
-- Reviewed photos are visible to any signed-in family member (the /album is
-- sign-in-only). A photo's uploader and admins also see it before review.

drop policy if exists family_photos_read           on family_photos;
drop policy if exists family_photos_uploader_insert on family_photos;
drop policy if exists family_photos_admin_write     on family_photos;
drop policy if exists family_photos_admin_delete    on family_photos;

create policy family_photos_read on family_photos
  for select to authenticated
  using (
    reviewed = true
    or uploaded_by_id = public.current_contributor_id()
    or public.is_admin()
  );

create policy family_photos_uploader_insert on family_photos
  for insert to authenticated
  with check (
    public.current_contributor_id() is not null
    and uploaded_by_id = public.current_contributor_id()
  );

-- Curation (review toggle, captions, hero flag, crop) is admin-only.
create policy family_photos_admin_write on family_photos
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy family_photos_admin_delete on family_photos
  for delete to authenticated using (public.is_admin());

-- Photo join tables: inherit the photo's visibility ------------------------
-- Helper-free inline EXISTS keeps these consistent with 0004's recipe-child
-- pattern. Read follows the photo; writes are admin (tagging lives on the
-- review screen).

drop policy if exists fp_people_inherit_read on family_photo_people;
drop policy if exists fp_people_admin_write  on family_photo_people;

create policy fp_people_inherit_read on family_photo_people
  for select to authenticated
  using (
    exists (
      select 1 from family_photos p
      where p.id = family_photo_people.family_photo_id
        and (p.reviewed = true
             or p.uploaded_by_id = public.current_contributor_id()
             or public.is_admin())
    )
  );

create policy fp_people_admin_write on family_photo_people
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists fp_occasions_inherit_read on family_photo_occasions;
drop policy if exists fp_occasions_admin_write  on family_photo_occasions;

create policy fp_occasions_inherit_read on family_photo_occasions
  for select to authenticated
  using (
    exists (
      select 1 from family_photos p
      where p.id = family_photo_occasions.family_photo_id
        and (p.reviewed = true
             or p.uploaded_by_id = public.current_contributor_id()
             or public.is_admin())
    )
  );

create policy fp_occasions_admin_write on family_photo_occasions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists fp_recipes_inherit_read on family_photo_recipes;
drop policy if exists fp_recipes_admin_write  on family_photo_recipes;

create policy fp_recipes_inherit_read on family_photo_recipes
  for select to authenticated
  using (
    exists (
      select 1 from family_photos p
      where p.id = family_photo_recipes.family_photo_id
        and (p.reviewed = true
             or p.uploaded_by_id = public.current_contributor_id()
             or public.is_admin())
    )
  );

create policy fp_recipes_admin_write on family_photo_recipes
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- family_photo_comments ----------------------------------------------------
-- Readable when the photo is; authored by the signed-in contributor;
-- deletable by author or admin. No edit (v1).

drop policy if exists fp_comments_read           on family_photo_comments;
drop policy if exists fp_comments_insert          on family_photo_comments;
drop policy if exists fp_comments_delete_own_admin on family_photo_comments;

create policy fp_comments_read on family_photo_comments
  for select to authenticated
  using (
    exists (
      select 1 from family_photos p
      where p.id = family_photo_comments.family_photo_id
        and (p.reviewed = true
             or p.uploaded_by_id = public.current_contributor_id()
             or public.is_admin())
    )
  );

create policy fp_comments_insert on family_photo_comments
  for insert to authenticated
  with check (
    public.current_contributor_id() is not null
    and author_contributor_id = public.current_contributor_id()
  );

create policy fp_comments_delete_own_admin on family_photo_comments
  for delete to authenticated
  using (author_contributor_id = public.current_contributor_id() or public.is_admin());

-- recipe_comments ----------------------------------------------------------
-- Readable when the recipe is (published, own, or admin); authored by the
-- signed-in contributor; deletable by author or admin. No edit (v1).

drop policy if exists recipe_comments_read            on recipe_comments;
drop policy if exists recipe_comments_insert           on recipe_comments;
drop policy if exists recipe_comments_delete_own_admin on recipe_comments;

create policy recipe_comments_read on recipe_comments
  for select to authenticated
  using (
    exists (
      select 1 from recipes r
      where r.id = recipe_comments.recipe_id
        and (r.status = 'published'
             or r.contributor_id = public.current_contributor_id()
             or public.is_admin())
    )
  );

create policy recipe_comments_insert on recipe_comments
  for insert to authenticated
  with check (
    public.current_contributor_id() is not null
    and author_contributor_id = public.current_contributor_id()
  );

create policy recipe_comments_delete_own_admin on recipe_comments
  for delete to authenticated
  using (author_contributor_id = public.current_contributor_id() or public.is_admin());

-- recipe_occasions: inherit the recipe ------------------------------------
-- Read follows recipe visibility; the recipe's owner or an admin writes
-- (mirrors how lib/recipes/save.ts syncs occasions).

drop policy if exists recipe_occasions_inherit_read  on recipe_occasions;
drop policy if exists recipe_occasions_owner_write    on recipe_occasions;

create policy recipe_occasions_inherit_read on recipe_occasions
  for select to authenticated
  using (
    exists (
      select 1 from recipes r
      where r.id = recipe_occasions.recipe_id
        and (r.status = 'published'
             or r.contributor_id = public.current_contributor_id()
             or public.is_admin())
    )
  );

create policy recipe_occasions_owner_write on recipe_occasions
  for all to authenticated
  using (
    exists (
      select 1 from recipes r
      where r.id = recipe_occasions.recipe_id
        and (r.contributor_id = public.current_contributor_id() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from recipes r
      where r.id = recipe_occasions.recipe_id
        and (r.contributor_id = public.current_contributor_id() or public.is_admin())
    )
  );
