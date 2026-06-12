import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  BACKUP_TABLES,
  EXCLUDED_TABLES,
  TABLE_KEYS,
  SCHEMA_VERSION,
} from '@/lib/backup/tables';
// The restore script is plain Node (.mjs) and mirrors the TS constants;
// its main() is guarded behind a direct-execution check, so importing it
// here is side-effect free.
import {
  INSERT_ORDER,
  TABLE_KEYS as RESTORE_TABLE_KEYS,
  EXPECTED_SCHEMA_VERSION,
} from '../../scripts/restore-from-backup.mjs';

/** Parse the public-schema table names out of the generated types file.
 *  types/supabase.ts is regenerated after every migration (`supabase gen
 *  types`), so this is the schema's table list as far as CI can see —
 *  a migration that adds a table without rerunning typegen fails the
 *  typecheck elsewhere, and one that reruns typegen without updating the
 *  backup list fails here. */
function schemaTableNames(): string[] {
  const src = readFileSync(
    path.resolve(__dirname, '../../types/supabase.ts'),
    'utf8',
  );
  const tablesStart = src.indexOf('Tables: {');
  const viewsStart  = src.indexOf('Views: {');
  expect(tablesStart, 'types/supabase.ts: could not find public Tables block').toBeGreaterThan(-1);
  expect(viewsStart,  'types/supabase.ts: could not find Views block').toBeGreaterThan(tablesStart);
  const block = src.slice(tablesStart, viewsStart);
  // Table entries sit at exactly 6-space indentation in the generated file;
  // Row/Insert/Update/column keys are nested deeper.
  const names = [...block.matchAll(/^ {6}([a-z_]+): \{$/gm)].map((m) => m[1]);
  expect(names.length, 'parsed zero table names — typegen layout changed?').toBeGreaterThan(0);
  return names;
}

describe('backup table coverage', () => {
  it('BACKUP_TABLES + EXCLUDED_TABLES exactly covers the schema', () => {
    const schema:  string[] = [...schemaTableNames()].sort();
    const covered: string[] = [...BACKUP_TABLES, ...EXCLUDED_TABLES].sort();

    const notCovered = schema.filter((t) => !covered.includes(t));
    const notInSchema = covered.filter((t) => !schema.includes(t));

    expect(
      notCovered,
      `Schema tables missing from the backup list — add them to BACKUP_TABLES ` +
      `(and the restore script's INSERT_ORDER/TABLE_KEYS), or to EXCLUDED_TABLES ` +
      `with a reason: ${notCovered.join(', ')}`,
    ).toEqual([]);
    expect(
      notInSchema,
      `Backup list names tables that no longer exist in the schema: ${notInSchema.join(', ')}`,
    ).toEqual([]);
  });

  it('no table is both backed up and excluded', () => {
    const overlap = BACKUP_TABLES.filter((t) => (EXCLUDED_TABLES as readonly string[]).includes(t));
    expect(overlap).toEqual([]);
  });

  it('every backed-up table has key columns', () => {
    for (const t of BACKUP_TABLES) {
      expect(TABLE_KEYS[t]?.length, `TABLE_KEYS missing for ${t}`).toBeGreaterThan(0);
    }
  });
});

describe('restore script stays in sync with lib/backup/tables', () => {
  it('INSERT_ORDER matches BACKUP_TABLES exactly (same tables, same order)', () => {
    expect(INSERT_ORDER).toEqual([...BACKUP_TABLES]);
  });

  it('TABLE_KEYS match', () => {
    expect(RESTORE_TABLE_KEYS).toEqual(
      Object.fromEntries(Object.entries(TABLE_KEYS).map(([t, ks]) => [t, [...ks]])),
    );
  });

  it('schema versions match', () => {
    expect(EXPECTED_SCHEMA_VERSION).toBe(SCHEMA_VERSION);
  });

  it('SCHEMA_VERSION matches the latest migration file', () => {
    const dir = path.resolve(__dirname, '../../supabase/migrations');
    const latest = readdirSync(dir)
      .filter((f) => /^\d{4}_.+\.sql$/.test(f))
      .sort()
      .at(-1)!
      .slice(0, 4);
    expect(
      SCHEMA_VERSION,
      'A new migration landed — bump SCHEMA_VERSION in lib/backup/tables.ts and ' +
      'EXPECTED_SCHEMA_VERSION in scripts/restore-from-backup.mjs.',
    ).toBe(latest);
  });
});

describe('restore dependency order', () => {
  // Parent must be inserted before child (FK target before FK source).
  const MUST_PRECEDE: [string, string][] = [
    ['family_lines', 'contributor_family_lines'],
    ['family_lines', 'family_members'],
    ['contributors', 'contributor_family_lines'],
    ['contributors', 'recipes'],
    ['contributors', 'photos'],
    ['contributors', 'submissions'],
    ['contributors', 'recipe_comments'],
    ['contributors', 'family_photos'],
    ['contributors', 'family_photo_people'],
    ['sections', 'recipes'],
    ['family_lines', 'recipes'],
    ['recipes', 'ingredients'],
    ['recipes', 'instructions'],
    ['recipes', 'recipe_tags'],
    ['recipes', 'photos'],
    ['recipes', 'submissions'],
    ['recipes', 'recipe_comments'],
    ['recipes', 'family_photo_recipes'],
    ['tags', 'recipe_tags'],
    ['family_photos', 'family_photo_people'],
    ['family_photos', 'family_photo_occasions'],
    ['family_photos', 'family_photo_recipes'],
    ['family_members', 'family_photo_people'],
    ['family_photo_occasion_types', 'family_photo_occasions'],
  ];

  it.each(MUST_PRECEDE)('%s is restored before %s', (parent, child) => {
    const pi = INSERT_ORDER.indexOf(parent);
    const ci = INSERT_ORDER.indexOf(child);
    expect(pi, `${parent} missing from INSERT_ORDER`).toBeGreaterThan(-1);
    expect(ci, `${child} missing from INSERT_ORDER`).toBeGreaterThan(-1);
    expect(pi).toBeLessThan(ci);
  });
});
