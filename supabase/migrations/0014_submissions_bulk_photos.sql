-- Allow 'bulk_photos' as a valid submissions.source value.
-- Used by scripts/process-lucy-binder.mjs to mark recipes ingested from
-- the import-queue/lucy-binder/ photo set so the admin queue can show
-- provenance separately from the BFK PDF path.

alter table submissions drop constraint if exists submissions_source_check;
alter table submissions
  add constraint submissions_source_check
  check (source in ('form', 'email', 'photo_upload', 'bulk_pdf', 'bulk_photos'));
