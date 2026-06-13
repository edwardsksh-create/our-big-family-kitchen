import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { mintHandoffCode, verifyHandoffCode } from '@/lib/auth/mobile-handoff';

const SECRET = 'test-auth-secret-at-least-32-bytes-long-xxxxx';
const b64url = (b: Buffer) =>
  b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const challengeFor = (v: string) => b64url(crypto.createHash('sha256').update(v).digest());

describe('mobile handoff code', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = SECRET;
  });

  it('round-trips claims without PKCE', async () => {
    const code = await mintHandoffCode({
      contributorId: '11111111-1111-1111-1111-111111111111',
      email: 'Kate@Example.com',
      role: 'admin',
    });
    const claims = await verifyHandoffCode(code);
    expect(claims.contributorId).toBe('11111111-1111-1111-1111-111111111111');
    expect(claims.email).toBe('kate@example.com');
    expect(claims.role).toBe('admin');
  });

  it('accepts a matching PKCE verifier', async () => {
    const verifier = 'a-long-random-code-verifier-string-123456';
    const code = await mintHandoffCode({
      contributorId: 'c1',
      email: 'a@b.com',
      codeChallenge: challengeFor(verifier),
    });
    const claims = await verifyHandoffCode(code, verifier);
    expect(claims.contributorId).toBe('c1');
  });

  it('rejects a wrong or missing PKCE verifier', async () => {
    const code = await mintHandoffCode({
      contributorId: 'c1',
      email: 'a@b.com',
      codeChallenge: challengeFor('the-real-verifier'),
    });
    await expect(verifyHandoffCode(code, 'wrong-verifier')).rejects.toThrow();
    await expect(verifyHandoffCode(code)).rejects.toThrow(); // PKCE required but absent
  });

  it('rejects a code signed with a different secret', async () => {
    const code = await mintHandoffCode({ contributorId: 'c1', email: 'a@b.com' });
    process.env.AUTH_SECRET = 'a-totally-different-secret-value-padding-xx';
    await expect(verifyHandoffCode(code)).rejects.toThrow();
  });
});
