import { SignJWT, jwtVerify } from 'jose';
import crypto from 'node:crypto';

// --- Native sign-in handoff code ------------------------------------------
//
// The problem this solves: a native app can't reach our NextAuth session.
// Magic-link sign-in completes in the system browser (the email link opens
// Safari, not the app's web view), so the app never gets the session cookie and
// can't call the cookie-gated GET /api/v1/auth/token.
//
// The bridge: after the browser completes sign-in, GET /api/v1/auth/mobile-
// callback mints one of these short-lived handoff codes and 302-redirects to the
// app's custom scheme (ourbigfamilykitchen://auth?code=...). The app then
// exchanges the code over HTTPS at POST /api/v1/auth/token for the real Supabase
// token — the token itself never travels in a URL.
//
// PKCE (recommended): if the app passes a code_challenge when starting sign-in,
// it's bound into the code, and the exchange requires the matching code_verifier.
// That makes a stolen code (e.g. another app hijacking the URL scheme) useless.

const HANDOFF_TTL_SECONDS = 120;
const HANDOFF_AUD = 'mobile-handoff';

function handoffSecret(): Uint8Array {
  const raw = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!raw) {
    throw new Error(
      'Missing AUTH_SECRET / NEXTAUTH_SECRET — required to sign mobile handoff codes.',
    );
  }
  return new TextEncoder().encode(raw);
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** S256 PKCE: the challenge is base64url(SHA256(verifier)). */
export function pkceChallengeMatches(verifier: string, challenge: string): boolean {
  const computed = base64url(crypto.createHash('sha256').update(verifier).digest());
  // Constant-time compare on equal-length buffers.
  const a = Buffer.from(computed);
  const b = Buffer.from(challenge);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

interface HandoffClaims {
  contributorId: string;
  email: string;
  role?: string;
}

/** Mint a one-time handoff code for the signed-in contributor. */
export async function mintHandoffCode(
  claims: HandoffClaims & { codeChallenge?: string },
): Promise<string> {
  const payload: Record<string, unknown> = {
    email: claims.email.toLowerCase(),
    app_role: claims.role ?? 'contributor',
  };
  if (claims.codeChallenge) payload.cc = claims.codeChallenge;

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.contributorId)
    .setAudience(HANDOFF_AUD)
    .setIssuedAt()
    .setExpirationTime(`${HANDOFF_TTL_SECONDS}s`)
    .sign(handoffSecret());
}

/**
 * Verify a handoff code and return its claims. When the code carries a PKCE
 * challenge, `codeVerifier` is required and must match. Throws on any failure.
 */
export async function verifyHandoffCode(
  code: string,
  codeVerifier?: string,
): Promise<HandoffClaims> {
  const { payload } = await jwtVerify(code, handoffSecret(), { audience: HANDOFF_AUD });

  const challenge = payload.cc as string | undefined;
  if (challenge) {
    if (!codeVerifier || !pkceChallengeMatches(codeVerifier, challenge)) {
      throw new Error('pkce_verification_failed');
    }
  }

  const contributorId = payload.sub;
  const email = payload.email as string | undefined;
  if (!contributorId || !email) throw new Error('malformed_handoff_code');

  return { contributorId, email, role: payload.app_role as string | undefined };
}
