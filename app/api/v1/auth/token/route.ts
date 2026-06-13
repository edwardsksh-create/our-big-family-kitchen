import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { mintSupabaseToken } from '@/lib/auth/supabase-token';
import { verifyHandoffCode } from '@/lib/auth/mobile-handoff';

export const dynamic = 'force-dynamic';

function tokenResponse(minted: Awaited<ReturnType<typeof mintSupabaseToken>>) {
  return NextResponse.json({
    accessToken: minted.token,
    tokenType: 'bearer',
    expiresIn: minted.expiresIn,
    expiresAt: minted.expiresAt,
    // Bootstrap values so a fresh client can construct the Supabase SDK without
    // hardcoding them. The anon key is the publishable key — safe to return.
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

// GET /api/v1/auth/token
//
// The mobile contract's single auth seam. A client that already holds a valid
// NextAuth session (established via the normal magic-link sign-in — including
// inside an in-app browser on mobile) exchanges it here for a short-lived
// Supabase access token. The client then instantiates the Supabase SDK with
// that token and talks to Postgres / Storage / Realtime directly, governed by
// the RLS in 0004_rls.sql.
//
// This is a versioned namespace (/api/v1/*) on purpose: the web UI's internal
// routes can churn freely, but anything under /api/v1 is the stable surface the
// mobile apps depend on. Breaking changes get a /api/v2, never an edit here.
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // The session callback in auth.ts resolves these from the contributors table.
  const contributorId = (session.user as { contributorId?: string }).contributorId;
  const role = (session.user as { role?: string }).role;

  if (!contributorId) {
    // Signed in to NextAuth but not a provisioned contributor — should not
    // happen given the signIn callback, but never mint a token we can't bind.
    return NextResponse.json({ error: 'no_contributor' }, { status: 403 });
  }

  const minted = await mintSupabaseToken({
    contributorId,
    email: session.user.email,
    role,
  });

  return tokenResponse(minted);
}

// POST /api/v1/auth/token   { code, code_verifier? }
//
// The native path: a client with no session cookie exchanges the one-time
// handoff code from /api/v1/auth/mobile-callback for a Supabase token, over
// HTTPS. With PKCE, the code_verifier must match the challenge the app sent when
// it started sign-in. Same response shape as GET.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const code = body?.code;
  if (typeof code !== 'string' || !code) {
    return NextResponse.json({ error: 'missing_code' }, { status: 400 });
  }

  let claims;
  try {
    claims = await verifyHandoffCode(code, body?.code_verifier);
  } catch {
    return NextResponse.json({ error: 'invalid_code' }, { status: 401 });
  }

  if (!claims.contributorId) {
    return NextResponse.json({ error: 'no_contributor' }, { status: 403 });
  }

  const minted = await mintSupabaseToken({
    contributorId: claims.contributorId,
    email: claims.email,
    role: claims.role,
  });

  return tokenResponse(minted);
}
