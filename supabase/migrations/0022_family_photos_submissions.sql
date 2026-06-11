-- Family-submitted photos: signed-in members can upload to /album, the
-- photos land in the existing review queue with reviewed=false until Kate
-- approves them. Adds two columns to family_photos:
--
--   submitter_note  — free-text context the uploader leaves with the photo
--                     ("the cousins at the lake, summer ~1992" etc.)
--   source          — distinguishes 'import' (bulk archive) from 'family'
--                     (community submission). Defaults 'import' so the
--                     existing 136 rows are correctly labeled.

alter table family_photos
  add column if not exists submitter_note text,
  add column if not exists source         text not null default 'import'
    check (source in ('import', 'family'));

create index if not exists family_photos_source_idx
  on family_photos (source) where source = 'family';
