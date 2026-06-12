import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase/server';
import { FAMILY } from '@/config/family';

// Dead-man's switch for the nightly backup. The backup cron runs at 07:00
// UTC and writes backup-YYYY-MM-DD.json to the private `backups` bucket;
// this watchdog runs at 12:00 UTC and emails ADMIN_EMAIL if today's file
// is missing or suspiciously small. A backup that fails — or silently
// stops running — can't go unnoticed for days again.
//
// Quiet on success: no email when the backup is where it should be.

export const maxDuration = 30;
export const dynamic     = 'force-dynamic';

const BACKUP_BUCKET = 'backups';
// A real backup of this database is megabytes; anything under 100 KB means
// something went badly wrong even if a file technically exists.
const MIN_PLAUSIBLE_BYTES = 100 * 1024;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'cron_secret_not_configured' }, { status: 500 });
  }
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 });
  }

  const today    = new Date().toISOString().slice(0, 10);
  const expected = `backup-${today}.json`;

  const db = supabaseAdmin();
  const { data: files, error } = await db.storage
    .from(BACKUP_BUCKET)
    .list('', { search: expected, limit: 5 });

  let problem: string | null = null;
  if (error) {
    problem = `Couldn't read the backups bucket: ${error.message}`;
  } else {
    const file = (files ?? []).find((f) => f.name === expected);
    if (!file) {
      problem = `Today's backup (${expected}) is missing from the backups bucket.`;
    } else {
      const size = (file.metadata as { size?: number } | null)?.size ?? 0;
      if (size < MIN_PLAUSIBLE_BYTES) {
        problem = `Today's backup (${expected}) exists but is only ${size} bytes — far too small to be a real export.`;
      }
    }
  }

  if (!problem) {
    return NextResponse.json({ ok: true, checked: expected });
  }

  console.error('backup-watchdog:', problem);

  const apiKey      = process.env.RESEND_API_KEY;
  const adminEmail  = process.env.ADMIN_EMAIL;
  const fromAddress = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  if (apiKey && adminEmail) {
    try {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from:    fromAddress,
        to:      adminEmail,
        subject: `⚠ Backup problem — ${today}`,
        text:
          `${problem}\n\n` +
          `The nightly backup runs at 07:00 UTC (/api/cron/backup). Check the ` +
          `Vercel cron logs and the Supabase backups bucket. Until this is ` +
          `fixed, the most recent good backup is the one we'd restore from.\n\n` +
          `— ${FAMILY.siteName}`,
      });
    } catch (err) {
      console.error('backup-watchdog: alert email failed', err);
    }
  }

  // Non-200 so the failed state is also visible in the Vercel cron dashboard.
  return NextResponse.json({ ok: false, problem }, { status: 500 });
}
