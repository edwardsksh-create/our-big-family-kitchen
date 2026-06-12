-- Private backups bucket. Daily DB exports from /api/cron/backup are stored
-- here instead of being emailed as attachments (the dump contains PII:
-- contributor emails, invitations, family memories).
--
-- public = false and NO read policy on storage.objects: anon/authenticated
-- clients get nothing; only the service-role key (which bypasses RLS) can
-- read or write. Humans download via the Supabase dashboard (Storage →
-- backups). See docs/backups.md.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'backups',
  'backups',
  false,
  104857600, -- 100 MB; the soft limit in the route warns at 50 MB
  array['application/json']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
