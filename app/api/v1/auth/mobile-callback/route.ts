import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { mintHandoffCode } from '@/lib/auth/mobile-handoff';

export const dynamic = 'force-dynamic';

// GET /api/v1/auth/mobile-callback?code_challenge=<S256>
//
// The return leg of native sign-in. The magic link's redirect lands here in the
// system browser once a NextAuth session exists. We mint a short-lived handoff
// code and 302 to the app's custom scheme, which hands control back to the app.
// The app then exchanges the code for a Supabase token at POST /api/v1/auth/token.
//
// If there's no session yet (e.g. the link was opened cold), bounce to sign-in
// with this same URL as the callback so the round-trip resumes here afterward.
const APP_SCHEME = process.env.MOBILE_APP_SCHEME ?? 'ourbigfamilykitchen';

export async function GET(req: NextRequest) {
  const codeChallenge = req.nextUrl.searchParams.get('code_challenge') ?? undefined;
  const session = await auth();

  if (!session?.user?.email) {
    const self = '/api/v1/auth/mobile-callback' + req.nextUrl.search;
    return NextResponse.redirect(
      new URL(`/sign-in?callbackUrl=${encodeURIComponent(self)}`, req.nextUrl.origin),
    );
  }

  const contributorId = (session.user as { contributorId?: string }).contributorId;
  const role = (session.user as { role?: string }).role;
  if (!contributorId) {
    return NextResponse.json({ error: 'no_contributor' }, { status: 403 });
  }

  const code = await mintHandoffCode({
    contributorId,
    email: session.user.email,
    role,
    codeChallenge,
  });

  // Hand back to the app. The token never travels in the URL — only this
  // single-use, 120s, PKCE-bound code does.
  return NextResponse.redirect(`${APP_SCHEME}://auth?code=${encodeURIComponent(code)}`);
}
