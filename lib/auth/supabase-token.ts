import { SignJWT, jwtVerify } from 'jose';

// --- The NextAuth → Supabase JWT bridge -----------------------------------
//
// Web stays on NextAuth (database sessions). But native clients (iOS/iPadOS/
// Android) and any future client-side web query can't reach our server-layer
// `auth()` guard — they talk to Supabase directly. For Supabase to enforce the
// access model in RLS, it needs a JWT it can verify.
//
// This mints exactly that: an HS256 token signed with the project's JWT secret,
// carrying the `email` claim that `public.current_contributor_id()` and
// `public.is_admin()` read in `0004_rls.sql`. Once a client presents this token,
// every Postgres / Storage / Realtime call is constrained by the same RLS the
// web app's policies already describe — no second copy of the access model.
//
// Keep TTL short. Clients re-fetch from GET /api/v1/auth/token (which requires a
// live NextAuth session) to roll the token forward.

export const SUPABASE_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

export interface MintedToken {
  token: string;
  /** Seconds until expiry — convenience for clients scheduling a refresh. */
  expiresIn: number;
  /** Absolute expiry as an ISO-8601 string. */
  expiresAt: string;
}

interface MintArgs {
  /** Used as the `sub` claim; should be the contributor's UUID. */
  contributorId: string;
  /** Drives RLS — must match `contributors.email` (case-insensitive). */
  email: string;
  /** 'admin' contributors get an `app_role` claim for optional client-side hints. */
  role?: string;
}

/**
 * Mint a short-lived Supabase-compatible access token for a contributor.
 *
 * The token is HS256-signed with SUPABASE_JWT_SECRET (Supabase dashboard →
 * Settings → API → JWT Secret). `role: 'authenticated'` selects the Postgres
 * role; `aud: 'authenticated'` is what Supabase's GoTrue expects by default.
 */
export async function mintSupabaseToken({
  contributorId,
  email,
  role,
}: MintArgs): Promise<MintedToken> {
  const rawSecret = process.env.SUPABASE_JWT_SECRET;
  if (!rawSecret) {
    throw new Error(
      'Missing SUPABASE_JWT_SECRET — required to bridge NextAuth sessions to ' +
        'Supabase. Find it in the Supabase dashboard under Settings → API → JWT Secret.',
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL.');
  }

  const secret = new TextEncoder().encode(rawSecret);
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + SUPABASE_TOKEN_TTL_SECONDS;

  const token = await new SignJWT({
    email: email.toLowerCase(),
    role: 'authenticated',
    app_role: role ?? 'contributor',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(contributorId)
    .setAudience('authenticated')
    .setIssuer(`${supabaseUrl}/auth/v1`)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(secret);

  return {
    token,
    expiresIn: SUPABASE_TOKEN_TTL_SECONDS,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

export interface BearerActor {
  email: string;
  contributorId?: string;
  role?: string;
}

/**
 * Verify a Supabase bearer token (the one our bridge mints) for `/api/v1/*`
 * endpoints that aren't reached through Supabase directly. Same HS256 secret and
 * `authenticated` audience Supabase itself checks, so a token good for the DB is
 * good here too. Throws on any failure.
 */
export async function verifySupabaseToken(token: string): Promise<BearerActor> {
  const rawSecret = process.env.SUPABASE_JWT_SECRET;
  if (!rawSecret) throw new Error('Missing SUPABASE_JWT_SECRET.');
  const { payload } = await jwtVerify(token, new TextEncoder().encode(rawSecret), {
    audience: 'authenticated',
  });
  const email = payload.email as string | undefined;
  if (!email) throw new Error('token missing email claim');
  return {
    email,
    contributorId: typeof payload.sub === 'string' ? payload.sub : undefined,
    role: payload.app_role as string | undefined,
  };
}

/** Pull and verify the bearer token from a request's Authorization header. */
export async function actorFromRequest(req: Request): Promise<BearerActor | null> {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    return await verifySupabaseToken(match[1]);
  } catch {
    return null;
  }
}
