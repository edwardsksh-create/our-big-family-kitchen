import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { listInboxObjects, deletePhotoPaths } from '@/lib/storage/photos';

export const maxDuration = 60;
export const dynamic     = 'force-dynamic';

// Don't touch files newer than this — they might be part of an in-flight intake.
const MIN_AGE_HOURS = 24;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'cron_secret_not_configured' }, { status: 500 });
  }
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 });
  }

  // 1) List every object under sources/_inbox/
  let inbox: { path: string; created_at: string }[];
  try {
    inbox = await listInboxObjects();
  } catch (err) {
    console.error('cleanup-orphans: list failed', err);
    return NextResponse.json({ error: 'list_failed', message: (err as Error).message }, { status: 500 });
  }

  if (inbox.length === 0) {
    return NextResponse.json({ ok: true, scanned: 0, deleted: 0 });
  }

  // 2) Look up which storage_paths the photos table knows about.
  const db = supabaseAdmin();
  const { data: knownRows } = await db
    .from('photos')
    .select('storage_path')
    .not('storage_path', 'is', null);
  const known = new Set<string>(
    (knownRows ?? [])
      .map((r) => r.storage_path as string | null)
      .filter((p): p is string => !!p),
  );

  // 3) Decide which to delete: not in `known` AND older than MIN_AGE_HOURS.
  const cutoff = Date.now() - MIN_AGE_HOURS * 3600 * 1000;
  const candidates = inbox.filter((obj) => {
    if (known.has(obj.path)) return false;
    const created = Date.parse(obj.created_at);
    if (!Number.isFinite(created)) return false; // skip if we can't parse age
    return created < cutoff;
  });

  if (candidates.length === 0) {
    console.log(JSON.stringify({
      event:   'cleanup_orphans_run',
      scanned: inbox.length,
      orphans: 0,
      deleted: 0,
    }));
    return NextResponse.json({ ok: true, scanned: inbox.length, deleted: 0 });
  }

  // 4) Delete in batches (Supabase remove() accepts arrays; 100 at a time is conservative).
  const BATCH = 100;
  let totalDeleted = 0;
  const failed: string[] = [];
  for (let i = 0; i < candidates.length; i += BATCH) {
    const slice = candidates.slice(i, i + BATCH).map((c) => c.path);
    const { deleted, failed: f } = await deletePhotoPaths(slice);
    totalDeleted += deleted;
    failed.push(...f);
  }

  console.log(JSON.stringify({
    event:   'cleanup_orphans_run',
    scanned: inbox.length,
    orphans: candidates.length,
    deleted: totalDeleted,
    failed:  failed.length,
  }));

  return NextResponse.json({
    ok:      true,
    scanned: inbox.length,
    orphans: candidates.length,
    deleted: totalDeleted,
    failed:  failed.length,
  });
}
