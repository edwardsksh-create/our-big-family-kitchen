import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { Resend } from 'resend';

// Deploy-failure alerts. A Vercel webhook (scoped to this project, event
// deployment.error) POSTs here; we verify the signature and email
// ADMIN_EMAIL. Born of the June 2026 incident where deploys failed
// silently for four days and production quietly went stale.
//
// This route lives on the LAST GOOD deployment, which is exactly why it
// works: when a new build fails, the previous deployment keeps serving —
// including this hook.

export const dynamic = 'force-dynamic';

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac('sha1', secret).update(rawBody).digest('hex');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const secret = process.env.VERCEL_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'webhook_secret_not_configured' }, { status: 500 });
  }

  const rawBody = await req.text();
  if (!verifySignature(rawBody, req.headers.get('x-vercel-signature'), secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let event: {
    type?: string;
    payload?: {
      deployment?: { id?: string; url?: string; meta?: Record<string, string> };
      project?: { id?: string };
      target?: string;
      links?: { deployment?: string };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  // Only deployment failures are subscribed, but be defensive anyway.
  if (event.type !== 'deployment.error') {
    return NextResponse.json({ ok: true, ignored: event.type ?? 'unknown' });
  }

  const apiKey      = process.env.RESEND_API_KEY;
  const adminEmail  = process.env.ADMIN_EMAIL;
  const fromAddress = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  if (!apiKey || !adminEmail) {
    return NextResponse.json({ error: 'email_not_configured' }, { status: 500 });
  }

  const meta      = event.payload?.deployment?.meta ?? {};
  const commitMsg = meta.githubCommitMessage?.split('\n')[0] ?? '(unknown commit)';
  const commitSha = meta.githubCommitSha?.slice(0, 7) ?? '???????';
  const target    = event.payload?.target ?? 'unknown';
  const logsUrl   = event.payload?.links?.deployment
    ?? (event.payload?.deployment?.url ? `https://${event.payload.deployment.url}` : 'https://vercel.com');

  const body =
    `A ${target} deployment of Our Big Family Kitchen failed to build.\n\n` +
    `Commit: ${commitSha} — ${commitMsg}\n` +
    `Logs:   ${logsUrl}\n\n` +
    `Until a build succeeds, the site keeps serving the previous deployment — ` +
    `recent code and content changes are NOT live. If this arrives more than ` +
    `once for the same commit, the build is stuck and needs a look.\n\n— Our Big Family Kitchen`;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from:    fromAddress,
      to:      adminEmail,
      subject: `⚠ Deploy failed — ${commitSha} ${commitMsg.slice(0, 60)}`,
      text:    body,
    });
  } catch (err) {
    console.error('deploy-hook: alert email failed', err);
    return NextResponse.json({ error: 'email_send_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
