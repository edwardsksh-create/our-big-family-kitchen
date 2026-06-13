-- Private second-copy bucket for the image archive (security gate item 6).
--
-- The DB is backed up nightly (0025 + /api/cron/backup), but the photo bytes
-- in recipe-photos / family-photos / contributor-photos had no second copy
-- anywhere — an accidental delete or a bad migration against storage would
-- be unrecoverable. /api/cron/photo-backup mirrors those buckets here,
-- filing each object under `<source-bucket>/<original-path>`.
--
-- Private (public = false) with no read policy: like the `backups` bucket,
-- only the service-role key (which bypasses storage RLS) can read or write.
-- Humans restore via the Supabase dashboard. This guards against accidental
-- deletion within the project; it is NOT off-site (a whole-project loss
-- would take it too) — see docs for the external-copy follow-up.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photo-backups',
  'photo-backups',
  false,
  15728640, -- 15 MB, matches the largest source bucket (family-photos)
  array['image/jpeg', 'image/png', 'image/heic', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
