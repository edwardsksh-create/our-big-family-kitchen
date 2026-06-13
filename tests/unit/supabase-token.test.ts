import { describe, it, expect, beforeEach } from 'vitest';
import { jwtVerify } from 'jose';
import { mintSupabaseToken, SUPABASE_TOKEN_TTL_SECONDS } from '@/lib/auth/supabase-token';

const SECRET = 'test-jwt-secret-at-least-32-bytes-long-xxxxx';

describe('mintSupabaseToken', () => {
  beforeEach(() => {
    process.env.SUPABASE_JWT_SECRET = SECRET;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  });

  it('mints a token Supabase can verify with the shared JWT secret', async () => {
    const { token } = await mintSupabaseToken({
      contributorId: '11111111-1111-1111-1111-111111111111',
      email: 'Kate@Example.com',
      role: 'admin',
    });

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(SECRET),
      { audience: 'authenticated' },
    );

    // RLS in 0004_rls.sql reads auth.jwt() ->> 'email', lower-cased.
    expect(payload.email).toBe('kate@example.com');
    // role drives the Postgres role Supabase assumes for the request.
    expect(payload.role).toBe('authenticated');
    // sub is the contributor UUID, so auth.uid() is also usable in future policies.
    expect(payload.sub).toBe('11111111-1111-1111-1111-111111111111');
    expect(payload.app_role).toBe('admin');
  });

  it('sets an expiry one TTL window out', async () => {
    const before = Math.floor(Date.now() / 1000);
    const { token, expiresIn } = await mintSupabaseToken({
      contributorId: '22222222-2222-2222-2222-222222222222',
      email: 'a@b.com',
    });
    const { payload } = await jwtVerify(token, new TextEncoder().encode(SECRET), {
      audience: 'authenticated',
    });

    expect(expiresIn).toBe(SUPABASE_TOKEN_TTL_SECONDS);
    expect(payload.exp! - before).toBeGreaterThanOrEqual(SUPABASE_TOKEN_TTL_SECONDS - 2);
    expect(payload.exp! - before).toBeLessThanOrEqual(SUPABASE_TOKEN_TTL_SECONDS + 2);
  });

  it('rejects a token signed with the wrong secret (RLS would deny it)', async () => {
    const { token } = await mintSupabaseToken({
      contributorId: '33333333-3333-3333-3333-333333333333',
      email: 'a@b.com',
    });
    await expect(
      jwtVerify(token, new TextEncoder().encode('a-different-secret-entirely-nope')),
    ).rejects.toThrow();
  });

  it('throws a clear error when the JWT secret is absent', async () => {
    delete process.env.SUPABASE_JWT_SECRET;
    await expect(
      mintSupabaseToken({ contributorId: 'x', email: 'a@b.com' }),
    ).rejects.toThrow(/SUPABASE_JWT_SECRET/);
  });
});
