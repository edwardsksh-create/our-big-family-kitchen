import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase/server';
import { mirrorAllPhotoBuckets, type MirrorResult } from '@/lib/backup/photo-mirror';

// The mirror is incremental (already-copied objects are skipped server-side)
// and idempotent, so even if a first run over the whole archive doesn't
// finish inside the budget, the next run continues where it left off.
export const maxDuration = 300;
export const dynamic     = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'cron_secret_not_configured' }, { status: 500 });
  }
  // Vercel cron sends `Authorization: Bearer <CRON_SECRET>` automatically.
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 });
  }

  const db = supabaseAdmin();

  let results: MirrorResult[];
  try {
    results = await mirrorAllPhotoBuckets(db.storage);
  } catch (err) {
    console.error('photo-backup: mirror failed', err);
    await notify(`The image backup run errored before finishing:\n\n${(err as Error).message}`);
    return NextResponse.json({ error: 'mirror_failed', message: (err as Error).message }, { status: 500 });
  }

  const copied  = results.reduce((n, r) => n + r.copied, 0);
  const skipped = results.reduce((n, r) => n + r.skipped, 0);
  const failed  = results.flatMap((r) => r.failed.map((f) => ({ bucket: r.bucket, ...f })));

  // Only failures page someone — a clean run is silent (like a green cron).
  if (failed.length > 0) {
    const lines = failed.slice(0, 20).map((f) => `  - ${f.bucket}/${f.path}: ${f.error}`).join('\n');
    const more  = failed.length > 20 ? `\n  …and ${failed.length - 20} more` : '';
    await notify(
      `The nightly image backup copied ${copied} new file(s) but ${failed.length} failed:\n\n${lines}${more}\n\n` +
      `The mirror is incremental, so the next run retries the failures. If they persist, check the photo-backups bucket and the function logs.`,
    );
    return NextResponse.json({ ok: false, copied, skipped, failed: failed.length, results }, { status: 500 });
  }

  return NextResponse.json({ ok: true, copied, skipped, results });
}

async function notify(body: string): Promise<void> {
  const apiKey      = process.env.RESEND_API_KEY;
  const adminEmail  = process.env.ADMIN_EMAIL;
  const fromAddress = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  if (!apiKey || !adminEmail) return;
  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from:    fromAddress,
      to:      adminEmail,
      subject: `⚠ Image backup problem`,
      // Literal to match the sibling cron routes on main; Phase 0 (config
      // extraction) swaps these to FAMILY.siteName when it merges.
      text:    `${body}\n\n— Our Big Family Kitchen`,
    });
  } catch (err) {
    console.error('photo-backup: alert email failed', err);
  }
}
