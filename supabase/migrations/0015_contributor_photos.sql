-- Hero photos for contributors.
--
-- Adds:
--   1. a 'contributor-photos' Supabase Storage bucket (public read,
--      image-only, 10 MB cap — same model as 'recipe-photos').
--   2. contributors.hero_photo_path: the storage path of the hero photo
--      shown at the top of /contributors/[slug]. NULL when no hero photo
--      has been uploaded for this contributor.

-- 1) Storage bucket -----------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contributor-photos',
  'contributor-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "contributor-photos public read" on storage.objects;
create policy "contributor-photos public read"
  on storage.objects for select
  to public
  using (bucket_id = 'contributor-photos');

-- The service-role key (used by Next.js API routes / one-off scripts) bypasses
-- RLS, so we don't need an explicit write policy here. Family-photo uploads
-- happen via signed-in admin flows or one-off scripts, never anonymous.

-- 2) Hero photo path on contributors ------------------------------------------

alter table contributors
  add column if not exists hero_photo_path text;
