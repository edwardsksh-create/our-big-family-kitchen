-- Photo intake + finished-dish photos + Supabase Storage bucket.
--
-- Adds:
--   1. a public 'recipe-photos' storage bucket with a 10MB / image-only policy
--   2. photos.photo_type ('source' | 'dish'), photos.storage_path, photos.uploaded_at
--   3. recipes.kitchen_notes text[] for AI-extracted margin notes / annotations

-- 1) Storage bucket -----------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-photos',
  'recipe-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/heic', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read on objects in this bucket (recipe photos are visible to anyone
-- who can see the recipe — same trust model as the recipe text).
drop policy if exists "recipe-photos public read" on storage.objects;
create policy "recipe-photos public read"
  on storage.objects for select
  to public
  using (bucket_id = 'recipe-photos');

-- The service-role key (used by Next.js API routes) bypasses RLS, so we don't
-- need an explicit write policy here. Authenticated client uploads can be
-- added later if we move uploads to the browser.

-- 2) Extend the photos table --------------------------------------------------

alter table photos
  add column if not exists photo_type   text not null default 'dish'
    check (photo_type in ('source', 'dish')),
  add column if not exists storage_path text,
  add column if not exists uploaded_at  timestamptz not null default now();

create index if not exists photos_recipe_type_idx on photos (recipe_id, photo_type, sort_order);

-- 3) Kitchen notes on recipes -------------------------------------------------
-- AI vision intake extracts margin notes / annotations into this array.

alter table recipes
  add column if not exists kitchen_notes text[] not null default '{}';
