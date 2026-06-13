import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase/server';
import { buildBackup } from '@/lib/backup/build';
import { SCHEMA_VERSION } from '@/lib/backup/tables';
import { FAMILY } from '@/config/family';

// 60s is enough for a family-sized cookbook. If row counts grow into
// hundreds of thousands, swap this for a streaming export.
export const maxDuration = 60;
export const dynamic     = 'force-dynamic';

// Backups land in this PRIVATE bucket (migration 0025: public=false, no
// read policy — only the service-role key can touch it). The email is a
// notification with a pointer, never the data itself: the dump contains
// every contributor email, invitation, and family memory, and PII should
// not transit a third-party mail provider or sit in an inbox.
const BACKUP_BUCKET = 'backups';

const SOFT_SIZE_LIMIT_BYTES = 50 * 1024 * 1024;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'cron_secret_not_configured' }, { status: 500 });
  }
  // Vercel cron jobs send `Authorization: Bearer <CRON_SECRET>` automatically
  // when CRON_SECRET is defined. Manual triggers must include the same header.
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 });
  }

  const db = supabaseAdmin();

  let backup;
  try {
    backup = await buildBackup(db);
  } catch (err) {
    console.error('backup: export failed', err);
    return NextResponse.json(
      { error: 'export_failed', message: (err as Error).message },
      { status: 500 },
    );
  }

  const json      = JSON.stringify(backup, null, 2);
  const sizeBytes = Buffer.byteLength(json, 'utf8');
  const sizeMb    = (sizeBytes / 1024 / 1024).toFixed(2);

  if (sizeBytes > SOFT_SIZE_LIMIT_BYTES) {
    console.warn(`backup: file is ${sizeMb} MB (over the ${SOFT_SIZE_LIMIT_BYTES / 1024 / 1024} MB soft limit) — storing anyway.`);
  }

  // One file per day; a same-day re-run overwrites (upsert) so manual
  // triggers don't litter the bucket.
  const dateStr     = backup.exported_at.slice(0, 10);
  const storagePath = `backup-${dateStr}.json`;
  const upload = await db.storage.from(BACKUP_BUCKET).upload(storagePath, Buffer.from(json, 'utf8'), {
    contentType: 'application/json',
    upsert:      true,
  });
  if (upload.error) {
    console.error('backup: storage upload failed', upload.error);
    return NextResponse.json(
      { error: 'storage_upload_failed', message: upload.error.message },
      { status: 500 },
    );
  }

  const apiKey      = process.env.RESEND_API_KEY;
  const adminEmail  = process.env.ADMIN_EMAIL;
  const fromAddress = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  if (!apiKey || !adminEmail) {
    // The backup itself is already safely stored; flag the missing alert
    // channel loudly so the cron run shows as failed.
    return NextResponse.json(
      { error: 'email_not_configured', backup_stored: true, path: storagePath },
      { status: 500 },
    );
  }

  const countsList = Object.entries(backup.row_counts)
    .filter(([, n]) => n > 0)
    .map(([table, n]) => `  - ${n} ${table}`)
    .join('\n');
  const body =
    `Last night's backup is safely stored.\n\n` +
    `Where: Supabase Storage → ${BACKUP_BUCKET} → ${storagePath}\n` +
    `(private bucket — open the Supabase dashboard, Storage, "${BACKUP_BUCKET}", and download the file)\n\n` +
    `Row counts:\n${countsList || '  (all tables empty)'}\n\n` +
    `File size: ${sizeMb} MB\n` +
    `Schema version: ${SCHEMA_VERSION}\n\n` +
    `To restore, see docs/backups.md in the repo.\n\n— ${FAMILY.siteName}`;

  const resend = new Resend(apiKey);
  try {
    await resend.emails.send({
      from:    fromAddress,
      to:      adminEmail,
      subject: `${FAMILY.siteName} — daily backup ${dateStr}`,
      text:    body,
    });
  } catch (err) {
    // Backup stored, notification failed — return 500 so the failed run is
    // visible in the Vercel cron dashboard rather than silently green.
    console.error('backup: notification email failed', err);
    return NextResponse.json(
      { error: 'email_send_failed', backup_stored: true, path: storagePath, message: (err as Error).message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok:          true,
    exported_at: backup.exported_at,
    path:        storagePath,
    size_bytes:  sizeBytes,
    row_counts:  backup.row_counts,
  });
}
