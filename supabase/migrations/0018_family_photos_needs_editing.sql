-- Admin-only flag for photos that need cropping/rotation/etc. outside this
-- tool. Independent of `reviewed` — a photo can be reviewed (tagged) AND
-- flagged for later editing at the same time. The flag never surfaces on
-- public pages (/album, contributor pages, recipe pages); only the admin
-- review screens read it.

alter table family_photos
  add column if not exists needs_editing boolean not null default false,
  add column if not exists editing_note  text;

create index if not exists family_photos_needs_editing_idx
  on family_photos (needs_editing) where needs_editing = true;
