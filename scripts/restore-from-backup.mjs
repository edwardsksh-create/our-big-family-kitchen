#!/usr/bin/env node
// Restore the database from a backup JSON file produced by /api/cron/backup.
//
// Usage:
//   node --env-file=.env.local scripts/restore-from-backup.mjs path/to/backup-YYYY-MM-DD.json
//
// Optional:
//   --force   Skip the "newer rows exist" safety check.
//
// Safety:
//   1. Refuses without an interactive "RESTORE" confirmation.
//   2. By default refuses if any table has rows newer than the backup's
//      exported_at — pass --force to override (last-resort recovery).
//   3. Truncates child tables before parent tables to avoid FK violations.
//   4. Re-inserts rows preserving IDs.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { createClient } from '@supabase/supabase-js';

// Insert order (parent before child). The reverse of this list is the
// truncate order. self-ref FKs (contributors.invited_by_id) are handled
// by a second pass after the initial contributors insert.
const INSERT_ORDER = [
  'family_lines',
  'sections',
  'tags',
  'contributors',
  'contributor_family_lines',
  'invitations',
  'federated_recipes',
  'recipes',
  'ingredients',
  'instructions',
  'recipe_tags',
  'photos',
  'comments',
  'submissions',
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
  // For tables with a `created_at` column, check if any row is newer.
  const TABLES_WITH_CREATED_AT = [
    'contributors', 'recipes', 'comments', 'submissions',
    'invitations', 'federated_recipes',
  ];
  const exportedAtIso = new Date(backupExportedAt).toISOString();
  const newer = [];
  for (const table of TABLES_WITH_CREATED_AT) {
    const { data, error } = await db
      .from(table)
      .select('id, created_at')
      .gt('created_at', exportedAtIso)
      .limit(1);
    if (error) continue;
    if ((data ?? []).length > 0) newer.push(table);
  }
  return newer;
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
  console.log(`Exported at:  ${backup.exported_at}`);
  console.log(`Schema:       ${backup.schema_version}`);
  console.log('Row counts in backup:');
  for (const [t, n] of Object.entries(backup.row_counts ?? {})) {
    if (n > 0) console.log(`  ${n.toString().padStart(4)}  ${t}`);
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

  // Truncate in reverse insert order so child tables go first (avoids FK
  // violations even without ON DELETE cascade).
  console.log('\nTruncating existing data…');
  for (const table of [...INSERT_ORDER].reverse()) {
    const { error } = await db.from(table).delete().gte('id::text', '');
    // .gte('id::text', '') is a "match all" filter that satisfies the Supabase
    // client's safety requirement of a non-empty where clause for delete().
    // Some tables (recipe_tags, contributor_family_lines) have composite PKs
    // and no `id` column — for those we fall back to a different filter below.
    if (error && error.message.includes('column "id"')) {
      // composite-PK tables
      const altCol =
        table === 'recipe_tags' ? 'recipe_id' :
        table === 'contributor_family_lines' ? 'contributor_id' :
        null;
      if (!altCol) {
        console.error(`Truncate failed on ${table}:`, error);
        process.exit(4);
      }
      const { error: e2 } = await db.from(table).delete().gte(altCol, '00000000-0000-0000-0000-000000000000');
      if (e2) {
        console.error(`Truncate fallback failed on ${table}:`, e2);
        process.exit(4);
      }
    } else if (error) {
      console.error(`Truncate failed on ${table}:`, error);
      process.exit(4);
    }
    process.stdout.write(`  ${table} `);
  }
  console.log('\n');

  // Insert in parent → child order.
  console.log('Restoring rows…');
  for (const table of INSERT_ORDER) {
    let rows = backup.data?.[table] ?? [];
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
