import { describe, it, expect } from 'vitest';
import { checkFetchTarget } from '@/lib/url-safety';

// These cases use IP literals or blocklisted names, so checkFetchTarget
// short-circuits before any real DNS lookup — the tests stay hermetic.

describe('checkFetchTarget() — blocked addresses', () => {
  const blocked = [
    ['loopback v4',        'http://127.0.0.1/recipe'],
    ['loopback v4 .x',     'http://127.0.0.53/recipe'],
    ['cloud metadata',     'http://169.254.169.254/latest/meta-data/'],
    ['link-local v4',      'http://169.254.10.1/'],
    ['private 10/8',       'http://10.0.0.5/'],
    ['private 172.16/12',  'http://172.20.1.1/'],
    ['private 192.168/16', 'http://192.168.1.1/'],
    ['CGNAT 100.64/10',    'http://100.100.0.1/'],
    ['unspecified v4',     'http://0.0.0.0/'],
    ['loopback v6',        'http://[::1]/'],
    ['localhost name',     'http://localhost/recipe'],
    ['*.local name',      'http://nas.local/recipe'],
    ['*.internal name',   'http://api.internal/recipe'],
  ] as const;

  for (const [label, url] of blocked) {
    it(`blocks ${label}`, async () => {
      const r = await checkFetchTarget(url);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('private_address');
    });
  }
});

describe('checkFetchTarget() — bad input', () => {
  it('rejects a non-URL string', async () => {
    const r = await checkFetchTarget('not a url at all');
    expect(r).toEqual({ ok: false, reason: 'bad_url' });
  });
  it('rejects non-http(s) protocols', async () => {
    for (const u of ['ftp://example.com/x', 'file:///etc/passwd', 'gopher://x/']) {
      const r = await checkFetchTarget(u);
      expect(r).toEqual({ ok: false, reason: 'bad_protocol' });
    }
  });
});

describe('checkFetchTarget() — allowed public IP literals', () => {
  it('allows a public IPv4 literal', async () => {
    const r = await checkFetchTarget('http://8.8.8.8/');
    expect(r.ok).toBe(true);
  });
});
