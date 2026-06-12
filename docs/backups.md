# Database backups

## How it works

A Vercel cron job runs **every night at 07:00 UTC** (≈ 2–3 AM US Eastern
depending on DST) and hits `/api/cron/backup`. The endpoint:

1. Authenticates via an `Authorization: Bearer ${CRON_SECRET}` header that
   Vercel injects automatically.
2. Exports every backed-up table (paged at 1000 rows so large tables can't
   silently truncate) using the service-role Supabase client.
3. Builds a JSON document with `exported_at`, `schema_version`, per-table
   `row_counts`, and a `data` map of `table → row[]`.
4. **Uploads the JSON to the private `backups` Storage bucket** as
   `backup-YYYY-MM-DD.json` (same-day re-runs overwrite).
5. Emails a **notification** (row counts + storage path) to `ADMIN_EMAIL`
   via Resend. The email never contains the data itself — the dump holds
   PII (contributor emails, invitations, family memories).

Schedule is declared in [`vercel.json`](../vercel.json).

## Where backups go

The **private `backups` bucket** in Supabase Storage (migration 0025:
`public = false`, no read policy — only the service-role key can access it).
Download via the Supabase dashboard → Storage → `backups`. One file per day;
old files accumulate (they're small) — prune by hand if the bucket ever
matters for quota.

## Which tables are covered

The single source of truth is **`lib/backup/tables.ts`** (`BACKUP_TABLES`).
It covers all 20 live tables, including `recipe_comments` and the six
family-photo tables. The dormant `comments` table (superseded by
`recipe_comments` in migration 0021) is deliberately excluded via
`EXCLUDED_TABLES`.

**This list cannot silently drift:** `tests/unit/backup-tables.test.ts`
asserts that `BACKUP_TABLES + EXCLUDED_TABLES` exactly matches the table
list in `types/supabase.ts`, that the restore script's `INSERT_ORDER` and
key map match, and that `SCHEMA_VERSION` matches the newest migration file.
A migration that adds a table (or that lands without bumping the version)
fails CI until the backup list is updated.

## What's NOT in a backup

- **Uploaded photo files in Supabase Storage** (`recipe-photos`,
  `family-photos`, `contributor-photos` buckets). The DB backup covers the
  *metadata*; the image bytes themselves are not duplicated anywhere yet.
  This is a known gap — a Storage-bucket backup is a separate follow-up.
- The `next_auth` schema (session/verification tokens). Disposable —
  users re-sign-in via magic link; `contributors` is the identity source.
- Anything Vercel-side (env vars, deploy history, build artifacts).

## How to restore from a backup

1. Download the latest `backup-*.json` from the `backups` bucket
   (Supabase dashboard → Storage → backups).
2. From the project root:

   ```bash
   node --env-file=.env.local scripts/restore-from-backup.mjs path/to/backup-2026-06-11.json
   ```

3. The script's safety rails, in order — **nothing is deleted until all
   pre-flight checks pass**:
   - Refuses if the backup's `schema_version` doesn't match the script's
     `EXPECTED_SCHEMA_VERSION` (`--force` to override).
   - Pre-flight validation: every table the script restores must exist in
     the backup (refuses old incomplete backups), every table in the backup
     must be known to the script, and every table must have a delete key.
     A mid-truncate abort on an unhandled table is impossible by
     construction.
   - Refuses if any table has rows newer than the backup's `exported_at`
     (`--force` to override).
   - Interactive prompt: type `RESTORE` to continue.
   - Truncates child tables before parents, then re-inserts parent → child,
     preserving IDs. Self-referential FKs (`contributors.invited_by_id`)
     are handled with a two-pass insert.

The restore path was last exercised end-to-end (full drill into a scratch
Supabase project, all row counts verified) on **2026-06-11**.

## Manually trigger a backup

```bash
curl -X GET https://bigfamilykitchen.com/api/cron/backup \
  -H "Authorization: Bearer $CRON_SECRET"
```

Response on success:

```json
{
  "ok": true,
  "exported_at": "2026-06-11T12:34:56Z",
  "path": "backup-2026-06-11.json",
  "size_bytes": 245678,
  "row_counts": { "contributors": 12, "recipes": 155, ... }
}
```

## Bumping `SCHEMA_VERSION`

When a new migration lands, bump **both**:

- `SCHEMA_VERSION` in [`lib/backup/tables.ts`](../lib/backup/tables.ts)
- `EXPECTED_SCHEMA_VERSION` in
  [`scripts/restore-from-backup.mjs`](../scripts/restore-from-backup.mjs)

The unit test fails until both match each other and the newest migration
file, so CI will remind you.
