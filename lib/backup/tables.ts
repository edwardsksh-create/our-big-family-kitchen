import type { Database } from '@/types/supabase';

// Single source of truth for which tables the backup system covers.
//
// BACKUP_TABLES is in RESTORE dependency order (parents before children).
// The export itself doesn't care about order, but keeping the one list in
// insert order means the backup route and the restore script can't drift
// on ordering semantics. tests/unit/backup-tables.test.ts asserts that:
//
//   1. BACKUP_TABLES + EXCLUDED_TABLES exactly equals the schema's table
//      list (parsed from types/supabase.ts, which is regenerated after
//      every migration) — so a migration that adds a table without
//      updating this file fails CI instead of silently shipping
//      incomplete backups.
//   2. The restore script's INSERT_ORDER and TABLE_KEYS match this file.

export type PublicTableName = keyof Database['public']['Tables'];

export const BACKUP_TABLES = [
  // No FK dependencies.
  'family_lines',
  'sections',
  'tags',
  'family_photo_occasion_types',
  // Self-FK (invited_by_id) handled by the restore script's two-pass insert.
  'contributors',
  // Depend on contributors / family_lines.
  'contributor_family_lines',
  'invitations',
  'invite_links',
  'federated_recipes',
  'family_members',
  // Recipes and their children.
  'recipes',
  'ingredients',
  'instructions',
  'recipe_tags',
  'recipe_occasions',
  'photos',
  'submissions',
  'recipe_comments',
  // Family photos and their join tables.
  'family_photos',
  'family_photo_people',
  'family_photo_occasions',
  'family_photo_recipes',
  'family_photo_comments',
] as const satisfies readonly PublicTableName[];

export type BackupTableName = (typeof BACKUP_TABLES)[number];

// Tables that exist in the schema but are deliberately NOT backed up.
// `comments` is the dormant 0001 table superseded by `recipe_comments`
// (see 0021's header) — no app code writes to it and it holds no data.
// `ai_usage_daily` is ephemeral rate-limit state (0033) that resets every
// day — there's nothing worth restoring, and a stale counter would mislead.
export const EXCLUDED_TABLES = ['comments', 'ai_usage_daily'] as const satisfies readonly PublicTableName[];

// Key columns per table, parents-of-truth for two consumers:
//   - the backup export orders by these columns so PostgREST range
//     pagination is stable (unordered pagination can skip/repeat rows);
//   - the restore script uses the FIRST column as the match-all filter
//     for its delete() calls (PostgREST requires a WHERE clause, and the
//     composite-PK join tables have no `id` column).
// Every column listed here is NOT NULL in the schema.
export const TABLE_KEYS: Record<BackupTableName, readonly string[]> = {
  family_lines:                ['id'],
  sections:                    ['id'],
  tags:                        ['id'],
  family_photo_occasion_types: ['slug'],
  contributors:                ['id'],
  contributor_family_lines:    ['contributor_id', 'family_line_id'],
  invitations:                 ['id'],
  invite_links:                ['id'],
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

// Bumped whenever a new migration lands. The restore script refuses a
// backup whose schema_version doesn't match what it expects (--force to
// override), so a stale backup can't be silently restored into a schema
// it no longer describes.
export const SCHEMA_VERSION = '0036';
