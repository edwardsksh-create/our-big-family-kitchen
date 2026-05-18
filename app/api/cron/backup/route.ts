import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase/server';

// 60s is enough for a family-sized cookbook. If row counts grow into
// hundreds of thousands, swap this for a streaming export.
export const maxDuration = 60;
export const dynamic     = 'force-dynamic';

// Order doesn't matter for export — only for restore. Keep alphabetical here
// so the JSON is stable.
const TABLES = [
  'comments',
  'contributor_family_lines',
  'contributors',
  'family_lines',
  'federated_recipes',
  'ingredients',
  'instructions',
  'invitations',
  'photos',
  'recipe_tags',
  'recipes',
  'sections',
  'submissions',
  'tags',
] as const;

// Bumped whenever a new migration lands. Used by the restore script to
// refuse importing into an older schema.
const SCHEMA_VERSION = '0010';

const SOFT_SIZE_LIMIT_BYTES = 10 * 1024 * 1024;

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

  // Fetch every table in parallel — small dataset, no risk of overload.
  const results = await Promise.all(
    TABLES.map(async (table) => {
      const { data, error } = await db.from(table).select('*');
      return { table, data: data ?? [], error };
    }),
  );

  for (const r of results) {
    if (r.error) {
      console.error('backup: query failed', r.table, r.error);
      return NextResponse.json(
        { error: 'export_failed', table: r.table, message: r.error.message },
        { status: 500 },
      );
    }
  }

  const rowCounts: Record<string, number> = {};
  const data:      Record<string, unknown[]> = {};
  for (const r of results) {
    rowCounts[r.table] = r.data.length;
    data[r.table]      = r.data;
  }

  const backup = {
    exported_at:    new Date().toISOString(),
    schema_version: SCHEMA_VERSION,
    row_counts:     rowCounts,
    data,
  };
  const json      = JSON.stringify(backup, null, 2);
  const sizeBytes = Buffer.byteLength(json, 'utf8');
  const sizeMb    = (sizeBytes / 1024 / 1024).toFixed(2);

  if (sizeBytes > SOFT_SIZE_LIMIT_BYTES) {
    console.warn(`backup: file is ${sizeMb} MB (over the ${SOFT_SIZE_LIMIT_BYTES / 1024 / 1024} MB soft limit) — sending anyway.`);
  }

  const apiKey      = process.env.RESEND_API_KEY;
  const adminEmail  = process.env.ADMIN_EMAIL;
  const fromAddress = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  if (!apiKey || !adminEmail) {
    return NextResponse.json(
      { error: 'email_not_configured', message: 'RESEND_API_KEY and ADMIN_EMAIL must be set.' },
      { status: 500 },
    );
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const countsList = Object.entries(rowCounts)
    .filter(([, n]) => n > 0)
    .map(([table, n]) => `  - ${n} ${table}`)
    .join('\n');
  const body =
    `Daily backup attached.\n\n` +
    `Row counts:\n${countsList || '  (all tables empty)'}\n\n` +
    `File size: ${sizeMb} MB\n` +
    `Schema version: ${SCHEMA_VERSION}\n\n` +
    `This email contains a complete export of the database. Save the\n` +
    `attachment somewhere safe — if anything goes wrong, this file is\n` +
    `how we restore.\n\n— Our Big Family Kitchen`;

  const resend = new Resend(apiKey);
  try {
    await resend.emails.send({
      from:    fromAddress,
      to:      adminEmail,
      subject: `Our Big Family Kitchen — daily backup ${dateStr}`,
      text:    body,
      attachments: [
        {
          filename: `backup-${dateStr}.json`,
          content:  Buffer.from(json, 'utf8'),
        },
      ],
    });
  } catch (err) {
    console.error('backup: email send failed', err);
    return NextResponse.json(
      { error: 'email_send_failed', message: (err as Error).message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok:         true,
    exported_at: backup.exported_at,
    size_bytes: sizeBytes,
    row_counts: rowCounts,
  });
}
