-- Allow 'bulk_pdf' as a valid submissions.source value.
-- Used by scripts/process-import-queue.mjs to mark recipes ingested from
-- the BFK import-queue/ directory so the admin queue can show provenance.

alter table submissions drop constraint if exists submissions_source_check;
alter table submissions
  add constraint submissions_source_check
  check (source in ('form', 'email', 'photo_upload', 'bulk_pdf'));
