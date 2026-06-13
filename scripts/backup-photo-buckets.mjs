// Mirror every Supabase Storage bucket to a local folder.
//
// The nightly cron backs up the DATABASE (rows, captions, people, comments)
// but not the photo bytes — without this, the only copy of every scanned
// recipe card and family photo lives in one Supabase project. This script
// pulls them all down to ~/BigFamilyKitchen-Backups, skipping files already
// mirrored (matched by path + byte size), so re-runs only fetch what's new.
//
// Run from the repo root:   node --env-file=.env.local scripts/backup-photo-buckets.mjs
// Re-run monthly, or after a big photo import. Deletions in the bucket are
// NOT propagated — a stray delete can be recovered from this mirror.

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const BUCKETS = ['family-photos', 'recipe-photos', 'backups'];
const DEST_ROOT = path.join(os.homedir(), 'BigFamilyKitchen-Backups');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — run with --env-file=.env.local');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

/** Recursively list every file in a bucket. Supabase returns folders as
 *  entries with id === null; files carry metadata.size. */
async function listAll(bucket, prefix = '') {
  const out = [];
  let offset = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await db.storage.from(bucket).list(prefix, {
      limit: PAGE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    for (const entry of data ?? []) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        out.push(...(await listAll(bucket, full)));
      } else {
        out.push({ path: full, size: entry.metadata?.size ?? 0 });
      }
    }
    if (!data || data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

let downloaded = 0, skipped = 0, failed = 0, bytes = 0;

for (const bucket of BUCKETS) {
  const files = await listAll(bucket);
  console.log(`\n${bucket}: ${files.length} files in bucket`);
  for (const f of files) {
    const dest = path.join(DEST_ROOT, bucket, f.path);
    const existing = fs.existsSync(dest) ? fs.statSync(dest).size : -1;
    if (existing === f.size && f.size > 0) { skipped++; continue; }
    try {
      const { data, error } = await db.storage.from(bucket).download(f.path);
      if (error) throw new Error(error.message);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const buf = Buffer.from(await data.arrayBuffer());
      fs.writeFileSync(dest, buf);
      downloaded++;
      bytes += buf.length;
      if (downloaded % 50 === 0) console.log(`  …${downloaded} downloaded`);
    } catch (err) {
      failed++;
      console.error(`  FAILED ${bucket}/${f.path}: ${err.message}`);
    }
  }
}

const mb = (bytes / 1024 / 1024).toFixed(1);
console.log(`\nMirror complete → ${DEST_ROOT}`);
console.log(`  downloaded: ${downloaded} (${mb} MB new)   already mirrored: ${skipped}   failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
