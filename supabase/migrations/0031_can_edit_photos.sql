-- Photo-editor tier: a per-contributor capability (like can_publish for
-- recipes) letting a trusted family member fix photo details — caption,
-- year, place — in the album lightbox. First grantee: Aunt Lucy 'Gal',
-- who knows the archive better than anyone. Admin always has the
-- capability regardless of this flag. Crop/rotate, the hero pool, and
-- the review queue stay admin-only.

alter table contributors
  add column if not exists can_edit_photos boolean not null default false;
