-- Family photo archive: tables + storage bucket.
--
-- A small data model for a curated archive of family snapshots. Each photo
-- can be tagged with multiple people (across both contributors and
-- family_members), multiple occasions, and multiple recipes. Until a photo
-- is reviewed by an admin (reviewed=true), it is invisible to the public
-- /album gallery — only the admin photo-review screen sees unreviewed rows.

-- 1) Storage bucket -----------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'family-photos',
  'family-photos',
  true,
  15728640,
  array['image/jpeg', 'image/png', 'image/heic', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "family-photos public read" on storage.objects;
create policy "family-photos public read"
  on storage.objects for select
  to public
  using (bucket_id = 'family-photos');

-- The service-role key bypasses RLS, so we don't need an explicit write
-- policy. Uploads happen via the one-off bulk-import script and (future)
-- admin upload routes; never anonymous.

-- 2) family_photos ------------------------------------------------------------

create table if not exists family_photos (
  id              uuid primary key default gen_random_uuid(),
  storage_path    text not null,
  caption         text,
  year            text,                                     -- mixed precision: "1987-12-25", "1987", "around 1995", "early 90s"
  place           text,
  additional_people text,                                   -- freeform for non-contributor / non-family_member people
  pets            text,                                     -- freeform pet names
  ai_hints        jsonb,                                    -- structured AI vision output
  reviewed        boolean not null default false,
  not_for_archive boolean not null default false,           -- admin "not for archive" toggle
  uploaded_by_id  uuid references contributors(id) on delete set null,
  uploaded_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create unique index if not exists family_photos_storage_path_unique on family_photos (storage_path);
create        index if not exists family_photos_reviewed_idx        on family_photos (reviewed) where reviewed = false;
create        index if not exists family_photos_uploaded_at_idx     on family_photos (uploaded_at desc);

-- 3) family_photo_people ------------------------------------------------------
-- A row links a photo to either a contributor (linkable to /contributors/<slug>)
-- OR a family_member (display-only). Exactly one of the two id columns is set.

create table if not exists family_photo_people (
  family_photo_id  uuid not null references family_photos(id) on delete cascade,
  person_type      text not null check (person_type in ('contributor', 'family_member')),
  contributor_id   uuid references contributors(id) on delete cascade,
  family_member_id uuid references family_members(id) on delete cascade,
  -- xor: exactly one populated. NULLs are compared with `is null`, the
  -- expressions resolve to booleans; cast to int and require sum = 1.
  check ((contributor_id is not null)::int + (family_member_id is not null)::int = 1)
);

-- Composite uniqueness using coalesced ids so the natural (photo, contributor)
-- and (photo, family_member) pairs are both deduplicated.
create unique index if not exists family_photo_people_unique
  on family_photo_people (family_photo_id, coalesce(contributor_id, family_member_id));

create index if not exists family_photo_people_contrib_idx    on family_photo_people (contributor_id);
create index if not exists family_photo_people_family_idx     on family_photo_people (family_member_id);

-- 4) family_photo_occasion_types (seed list) ----------------------------------

create table if not exists family_photo_occasion_types (
  slug       text primary key,
  name       text not null,
  sort_order int  not null
);

insert into family_photo_occasion_types (slug, name, sort_order) values
  ('easter',             'Easter',              1),
  ('mothers-day',        'Mother''s Day',       2),
  ('fathers-day',        'Father''s Day',       3),
  ('first-communion',    'First Communion',     4),
  ('graduation',         'Graduation',          5),
  ('baby-shower',        'Baby Shower',         6),
  ('birthday',           'Birthday',            7),
  ('backyard-holidays',  'Backyard Holidays',   8),
  ('halloween',          'Halloween',           9),
  ('thanksgiving',       'Thanksgiving',       10),
  ('christmas',          'Christmas',          11),
  ('new-years',          'New Year''s',        12),
  ('wedding',            'Wedding',            13),
  ('anniversary',        'Anniversary',        14),
  ('vacation',           'Vacation',           15),
  ('memorial',           'Memorial',           16),
  ('sunday-dinner',      'Sunday Dinner',      17),
  ('casual-gathering',   'Casual Gathering',   18),
  ('cooking-lesson',     'Cooking Lesson',     19)
on conflict (slug) do update set
  name = excluded.name,
  sort_order = excluded.sort_order;

-- 5) family_photo_occasions ---------------------------------------------------

create table if not exists family_photo_occasions (
  family_photo_id uuid not null references family_photos(id) on delete cascade,
  occasion_slug   text not null references family_photo_occasion_types(slug) on delete restrict,
  primary key (family_photo_id, occasion_slug)
);

create index if not exists family_photo_occasions_occasion_idx on family_photo_occasions (occasion_slug);

-- 6) family_photo_recipes -----------------------------------------------------

create table if not exists family_photo_recipes (
  family_photo_id uuid not null references family_photos(id) on delete cascade,
  recipe_id       uuid not null references recipes(id) on delete cascade,
  primary key (family_photo_id, recipe_id)
);

create index if not exists family_photo_recipes_recipe_idx on family_photo_recipes (recipe_id);
