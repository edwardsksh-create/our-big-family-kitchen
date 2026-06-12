import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { BACKUP_TABLES, TABLE_KEYS, SCHEMA_VERSION, type BackupTableName } from './tables';

export type BackupPayload = {
  exported_at:    string;
  schema_version: string;
  row_counts:     Record<string, number>;
  data:           Record<string, unknown[]>;
};

// PostgREST caps un-ranged selects at 1000 rows, which would silently
// truncate large tables (the photo archive is the first realistic one to
// cross it). Page explicitly, ordered by the table's key columns so the
// pagination is stable.
const PAGE_SIZE = 1000;

async function exportTable(
  db: SupabaseClient<Database, 'public'>,
  table: BackupTableName,
): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = db.from(table).select('*');
    for (const key of TABLE_KEYS[table]) {
      query = query.order(key, { ascending: true });
    }
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`backup: export failed for ${table}: ${error.message}`);
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

/** Read-only: builds the full backup payload from the given client.
 *  Throws (with the table name) on any query failure — a partial backup
 *  must never be mistaken for a complete one. */
export async function buildBackup(
  db: SupabaseClient<Database, 'public'>,
): Promise<BackupPayload> {
  const data:      Record<string, unknown[]> = {};
  const rowCounts: Record<string, number> = {};

  // Sequential rather than parallel: 20 paged exports in parallel would
  // race the connection pool for no real wall-clock win at this scale.
  for (const table of BACKUP_TABLES) {
    const rows = await exportTable(db, table);
    data[table]      = rows;
    rowCounts[table] = rows.length;
  }

  return {
    exported_at:    new Date().toISOString(),
    schema_version: SCHEMA_VERSION,
    row_counts:     rowCounts,
    data,
  };
}
