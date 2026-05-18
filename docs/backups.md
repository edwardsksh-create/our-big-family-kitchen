# Database backups

## How it works

A Vercel cron job runs **every night at 07:00 UTC** (≈ 2–3 AM US Eastern
depending on DST) and hits `/api/cron/backup`. The endpoint:

1. Authenticates via an `Authorization: Bearer ${CRON_SECRET}` header that
   Vercel injects automatically.
2. Queries every public table (alphabetical order, no joins) using the
   service-role Supabase client.
3. Builds a JSON document with `exported_at`, `schema_version`, per-table
   `row_counts`, and a `data` map of `table → row[]`.
4. Emails the JSON to `ADMIN_EMAIL` via Resend, with the file as a
   `backup-YYYY-MM-DD.json` attachment.

Schedule is declared in [`vercel.json`](../vercel.json). The Cron Jobs
page in the Vercel dashboard will list it under the deployed project.

## Where backups go

Kate's inbox, the address set in the Vercel env var `ADMIN_EMAIL`.
The "from" address is `EMAIL_FROM` (currently `onboarding@resend.dev`
while the project domain is unverified — switch when the Resend domain
is set up).

## What's in a backup

| Field | Notes |
|---|---|
| `exported_at` | ISO timestamp from the server. |
| `schema_version` | Hard-coded constant in the route. Bump on every new migration. |
| `row_counts` | One entry per table. |
| `data` | Map of `table → [row, row, ...]` for every public table: `comments`, `contributor_family_lines`, `contributors`, `family_lines`, `federated_recipes`, `ingredients`, `instructions`, `invitations`, `photos`, `recipe_tags`, `recipes`, `sections`, `submissions`, `tags`. |

## What's NOT in a backup

- Uploaded photo files in Supabase Storage. Phase 2 doesn't have photo
  uploads yet; if/when we add them, back up the Storage bucket too.
- The `next_auth` schema (session tokens, verification tokens). These are
  user-session state — they're disposable; users would re-sign-in if we
  restored.
- Anything Vercel-side (env vars, deploy history, build artifacts). Keep
  the Vercel project settings in version control or a notes file.

## File size

For a family-sized cookbook with a few hundred recipes, the JSON should
stay well under 1 MB. The route logs a warning above 10 MB but still
sends. If it ever crosses 20 MB it'll start hitting Resend's attachment
limit — at that point we should switch to uploading to a private bucket
and emailing a link.

## How to restore from a backup

1. Save the latest `backup-*.json` from Kate's inbox somewhere local.
2. From the project root, run:

   ```bash
   node --env-file=.env.local scripts/restore-from-backup.mjs path/to/backup-2026-05-18.json
   ```

3. The script will:
   - Print the row counts in the backup.
   - **Refuse to run** if any table has rows newer than the backup's
     `exported_at` (default safety against overwriting recent data with
     a stale backup). Pass `--force` to override.
   - Prompt: `Type RESTORE to continue`. Anything else aborts.
   - Truncate the database (child tables first to avoid FK violations).
   - Re-insert every row, preserving IDs.

   Self-referential FKs (`contributors.invited_by_id`) are handled with
   a two-pass strategy: insert all contributors with `invited_by_id=null`,
   then patch the references back in. Safe regardless of insert order.

## Manually trigger a backup

Useful for testing or for a pre-deploy snapshot:

```bash
curl -X GET https://bigfamilykitchen.com/api/cron/backup \
  -H "Authorization: Bearer $CRON_SECRET"
```

Response on success:

```json
{
  "ok": true,
  "exported_at": "2026-05-18T12:34:56Z",
  "size_bytes": 245678,
  "row_counts": { "contributors": 12, "recipes": 14, ... }
}
```

## Bumping `SCHEMA_VERSION`

Edit the `SCHEMA_VERSION` constant at the top of
[`app/api/cron/backup/route.ts`](../app/api/cron/backup/route.ts) when a
new migration lands. The restore script will eventually use this to
refuse restoring an older-schema backup into a newer database.
