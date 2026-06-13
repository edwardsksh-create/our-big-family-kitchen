#!/usr/bin/env node
// Restore the database from a backup JSON file produced by /api/cron/backup.
//
// Backups live in the private `backups` Supabase Storage bucket — download
// the file from the dashboard (Storage → backups) first.
//
// Usage:
//   node --env-file=.env.local scripts/restore-from-backup.mjs path/to/backup-YYYY-MM-DD.json
//
// Optional:
//   --force   Skip the "newer rows exist" and schema-version safety checks.
//
// Safety:
//   1. Refuses without an interactive "RESTORE" confirmation.
//   2. Refuses if the backup's schema_version doesn't match what this script
//      expects (EXPECTED_SCHEMA_VERSION below) — pass --force to override.
//   3. By default refuses if any table has rows newer than the backup's
//      exported_at — pass --force to override (last-resort recovery).
//   4. Validates EVERY table is present in the backup and handleable BEFORE
//      deleting anything — the script can never abort partway through a
//      truncate and leave a half-emptied database.
//   5. Truncates child tables before parent tables to avoid FK violations.
//   6. Re-inserts rows preserving IDs.
//
// INSERT_ORDER and TABLE_KEYS are mirrored from lib/backup/tables.ts (this
// script stays dependency-free plain Node, so it can't import the TS module).
// tests/unit/backup-tables.test.ts asserts the two stay in sync.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { createClient } from '@supabase/supabase-js';

// Insert order (parent before child). The reverse of this list is the
// truncate order. Self-ref FKs (contributors.invited_by_id) are handled
// by a second pass after the initial contributors insert.
export const INSERT_ORDER = [
  'family_lines',
  'sections',
  'tags',
  'family_photo_occasion_types',
  'contributors',
  'contributor_family_lines',
  'invitations',
  'federated_recipes',
  'family_members',
  'recipes',
  'ingredients',
  'instructions',
  'recipe_tags',
  'recipe_occasions',
  'photos',
  'submissions',
  'recipe_comments',
  'family_photos',
  'family_photo_people',
  'family_photo_occasions',
  'family_photo_recipes',
  'family_photo_comments',
];

// First column = the NOT NULL column used as the match-all delete filter
// (the Supabase client requires a non-empty WHERE clause on delete(), and
// the composite-PK join tables have no `id` column).
export const TABLE_KEYS = {
  family_lines:                ['id'],
  sections:                    ['id'],
  tags:                        ['id'],
  family_photo_occasion_types: ['slug'],
  contributors:                ['id'],
  contributor_family_lines:    ['contributor_id', 'family_line_id'],
  invitations:                 ['id'],
  federated_recipes:           ['id'],
  family_members:              ['id'],
  recipes:                     ['id'],
  ingredients:                 ['id'],
  instructions:                ['id'],
  recipe_tags:                 ['recipe_id', 'tag_id'],
  recipe_occasions:            ['recipe_id', 'occasion_slug'],
  photos:                      ['id'],
  submissions:                 ['id'],
  recipe_comments:             ['id'],
  family_photos:               ['id'],
  family_photo_people:         ['family_photo_id', 'person_type'],
  family_photo_occasions:      ['family_photo_id', 'occasion_slug'],
  family_photo_recipes:        ['family_photo_id', 'recipe_id'],
  family_photo_comments:       ['id'],
};

// Must match SCHEMA_VERSION in lib/backup/tables.ts (CI-enforced). A backup
// produced under a different schema version is refused without --force.
export const EXPECTED_SCHEMA_VERSION = '0032';

// Tables that carry a created_at column — used for the "newer rows exist"
// staleness check.
const TABLES_WITH_CREATED_AT = [
  'contributors', 'recipes', 'submissions', 'invitations',
  'federated_recipes', 'recipe_comments', 'family_photos', 'family_members',
  'family_photo_comments',
];

function parseArgs(argv) {
  const args = { file: null, force: false };
  for (const a of argv.slice(2)) {
    if (a === '--force') args.force = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node --env-file=.env.local scripts/restore-from-backup.mjs <backup.json> [--force]');
      process.exit(0);
    } else if (!args.file) args.file = a;
    else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

async function confirm(rl) {
  const answer = await rl.question(
    'This will DELETE all current data and restore from the backup.\n' +
    'Type RESTORE to continue, anything else to abort: ',
  );
  return answer.trim() === 'RESTORE';
}

async function checkNewerRows(db, backupExportedAt) {
  const exportedAtIso = new Date(backupExportedAt).toISOString();
  const newer = [];
  for (const table of TABLES_WITH_CREATED_AT) {
    const { data, error } = await db
      .from(table)
      .select('created_at')
      .gt('created_at', exportedAtIso)
      .limit(1);
    if (error) continue;
    if ((data ?? []).length > 0) newer.push(table);
  }
  return newer;
}

/** Every check that could abort the restore runs HERE, before any delete.
 *  Returns a list of problems; an empty list means every table is fully
 *  handleable and the destructive phase cannot fail on a known-unknown. */
function validateBackup(backup) {
  const problems = [];

  const backupTables = Object.keys(backup.data ?? {});
  const known        = new Set(INSERT_ORDER);

  // Every table this script restores must be present in the backup —
  // otherwise we'd truncate it and restore nothing (data loss). This also
  // refuses pre-0025 backups, which silently omitted the photo archive.
  const missing = INSERT_ORDER.filter((t) => !(t in (backup.data ?? {})));
  if (missing.length > 0) {
    problems.push(
      `Backup is missing tables this script restores (an old/incomplete backup?):\n` +
      missing.map((t) => `    - ${t}`).join('\n'),
    );
  }

  // Tables in the backup this script doesn't know — restoring would
  // silently drop their rows.
  const unknown = backupTables.filter((t) => !known.has(t));
  if (unknown.length > 0) {
    problems.push(
      `Backup contains tables this script doesn't know how to restore:\n` +
      unknown.map((t) => `    - ${t}`).join('\n') +
      `\n  Update INSERT_ORDER/TABLE_KEYS in this script (and lib/backup/tables.ts).`,
    );
  }

  // Every table must have a delete key so the truncate phase can't hit an
  // unhandled case mid-run.
  const keyless = INSERT_ORDER.filter((t) => !TABLE_KEYS[t]?.length);
  if (keyless.length > 0) {
    problems.push(
      `No TABLE_KEYS entry for:\n` + keyless.map((t) => `    - ${t}`).join('\n'),
    );
  }

  return problems;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.file) {
    console.error('Usage: node --env-file=.env.local scripts/restore-from-backup.mjs <backup.json>');
    process.exit(2);
  }
  const filePath = path.resolve(args.file);
  const raw = readFileSync(filePath, 'utf8');
  const backup = JSON.parse(raw);
  if (!backup?.data || !backup?.exported_at) {
    console.error('Invalid backup file — missing data or exported_at.');
    process.exit(2);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing Supabase env. Run with --env-file=.env.local.');
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  console.log(`Backup file:  ${filePath}`);
  console.log(`Target:       ${url}`);
  console.log(`Exported at:  ${backup.exported_at}`);
  console.log(`Schema:       ${backup.schema_version}`);
  console.log('Row counts in backup:');
  for (const [t, n] of Object.entries(backup.row_counts ?? {})) {
    if (n > 0) console.log(`  ${n.toString().padStart(4)}  ${t}`);
  }

  // ---- Pre-flight: nothing destructive happens until all of this passes.

  if (backup.schema_version !== EXPECTED_SCHEMA_VERSION) {
    if (!args.force) {
      console.error(
        `\nRefusing to restore: backup schema_version is ${backup.schema_version}, ` +
        `this script expects ${EXPECTED_SCHEMA_VERSION}.\n` +
        `If the backup predates a migration, restore with a matching checkout of this ` +
        `script, or re-run with --force if you've verified the schemas are compatible.`,
      );
      process.exit(3);
    }
    console.log(`\n--force given — proceeding despite schema_version mismatch (${backup.schema_version} ≠ ${EXPECTED_SCHEMA_VERSION}).`);
  }

  const problems = validateBackup(backup);
  if (problems.length > 0) {
    console.error('\nRefusing to restore — pre-flight validation failed:\n');
    for (const p of problems) console.error(`  ${p}\n`);
    process.exit(3);
  }

  if (!args.force) {
    process.stdout.write('\nChecking for rows newer than this backup… ');
    const newer = await checkNewerRows(db, backup.exported_at);
    if (newer.length > 0) {
      console.log('\n');
      console.error(
        `Refusing to restore: these tables have rows newer than the backup's exported_at:\n` +
        newer.map((t) => `  - ${t}`).join('\n') +
        `\n\nThis backup is OLDER than the current database. Re-run with --force ` +
        `if you really mean to overwrite recent data.`,
      );
      process.exit(3);
    }
    console.log('clean.');
  } else {
    console.log('\n--force given — skipping the newer-rows check.');
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const proceed = await confirm(rl);
  rl.close();
  if (!proceed) {
    console.log('Aborted.');
    process.exit(0);
  }

  // ---- Destructive phase. Every table is pre-validated as handleable.

  // Truncate in reverse insert order so child tables go first (avoids FK
  // violations even without ON DELETE cascade). The `.not(key, 'is', null)`
  // filter matches every row (key columns are NOT NULL) and satisfies the
  // Supabase client's requirement of a non-empty WHERE clause on delete().
  console.log('\nTruncating existing data…');
  for (const table of [...INSERT_ORDER].reverse()) {
    const keyCol = TABLE_KEYS[table][0];
    const { error } = await db.from(table).delete().not(keyCol, 'is', null);
    if (error) {
      console.error(`\nTruncate failed on ${table}:`, error);
      console.error('The database may be partially truncated. Re-run the restore once the cause is fixed.');
      process.exit(4);
    }
    process.stdout.write(`  ${table} `);
  }
  console.log('\n');

  // Insert in parent → child order.
  console.log('Restoring rows…');
  for (const table of INSERT_ORDER) {
    const rows = backup.data?.[table] ?? [];
    if (rows.length === 0) {
      console.log(`  ${table.padEnd(28)} —`);
      continue;
    }
    // Two-pass for contributors: insert with invited_by_id=null first,
    // then update with the original values so self-references don't
    // depend on ordering.
    if (table === 'contributors') {
      const stripped = rows.map((r) => ({ ...r, invited_by_id: null }));
      const { error } = await db.from('contributors').insert(stripped);
      if (error) {
        console.error(`Insert failed on contributors:`, error);
        process.exit(5);
      }
      const withRefs = rows.filter((r) => r.invited_by_id);
      for (const r of withRefs) {
        await db
          .from('contributors')
          .update({ invited_by_id: r.invited_by_id })
          .eq('id', r.id);
      }
      console.log(`  contributors                  ${rows.length} (self-refs reapplied: ${withRefs.length})`);
      continue;
    }
    // Batched insert.
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const { error } = await db.from(table).insert(slice);
      if (error) {
        console.error(`Insert failed on ${table} (batch starting ${i}):`, error);
        process.exit(5);
      }
    }
    console.log(`  ${table.padEnd(28)} ${rows.length}`);
  }

  console.log('\nDone.');
}

// Only run when executed directly — tests import INSERT_ORDER/TABLE_KEYS.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
