import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hermetic SSRF check: no DNS — hosts named *.blocked.example (and localhost)
// are private, everything else is public.
vi.mock('@/lib/url-safety', () => ({
  checkFetchTarget: vi.fn(async (rawUrl: string) => {
    const host = new URL(rawUrl).hostname;
    if (host === 'localhost' || host.endsWith('blocked.example')) {
      return { ok: false, reason: 'private_address' };
    }
    return { ok: true };
  }),
}));

// The AI fallback must never run in these tests — a call means the JSON-LD
// fixture broke, so fail loudly instead of silently passing via the mock.
vi.mock('@/lib/recipe-parser', () => ({
  parseRecipeFromText: vi.fn(async () => {
    throw new Error('AI fallback should not be reached in this test');
  }),
}));

import { fetchRecipeFromUrl } from '@/lib/recipe-from-url';

const RECIPE_HTML = `<html><head><script type="application/ld+json">
  {"@type":"Recipe","name":"Test Soup","recipeIngredient":["1 cup water"],
   "recipeInstructions":[{"@type":"HowToStep","text":"Boil the water."}]}
</script></head><body>Test Soup</body></html>`;

type StubResponse = {
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
};

function response(status: number, opts: { location?: string; body?: string } = {}): StubResponse {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'location' ? (opts.location ?? null) : null,
    },
    text: async () => opts.body ?? '',
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchRecipeFromUrl redirect handling', () => {
  it('follows a safe redirect chain and parses the final page', async () => {
    fetchMock
      .mockResolvedValueOnce(response(301, { location: 'https://example.com/recipes/soup' }))
      .mockResolvedValueOnce(response(200, { body: RECIPE_HTML }));

    const result = await fetchRecipeFromUrl('http://example.com/soup');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.via).toBe('jsonld');
      expect(result.recipe.title).toBe('Test Soup');
      // sourceUrl stays the user-entered URL, not the redirect target.
      expect(result.sourceUrl).toBe('http://example.com/soup');
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('https://example.com/recipes/soup');
    // Every hop fetches without auto-following.
    for (const call of fetchMock.mock.calls) {
      expect(call[1].redirect).toBe('manual');
    }
  });

  it('resolves a relative Location against the current URL', async () => {
    fetchMock
      .mockResolvedValueOnce(response(302, { location: '/moved/soup' }))
      .mockResolvedValueOnce(response(200, { body: RECIPE_HTML }));

    const result = await fetchRecipeFromUrl('https://example.com/old/soup');

    expect(result.ok).toBe(true);
    expect(fetchMock.mock.calls[1][0]).toBe('https://example.com/moved/soup');
  });

  it('blocks a redirect onto a private address without fetching it', async () => {
    fetchMock.mockResolvedValueOnce(
      response(302, { location: 'http://internal.blocked.example/latest/meta-data' }),
    );

    const result = await fetchRecipeFromUrl('https://example.com/soup');

    expect(result).toEqual({ ok: false, reason: 'blocked_redirect' });
    // The blocked hop must never be fetched.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('blocks when the initial URL itself is private (defense in depth)', async () => {
    const result = await fetchRecipeFromUrl('http://localhost/admin');

    expect(result).toEqual({ ok: false, reason: 'blocked_redirect' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gives up after too many redirects', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      response(302, { location: `${url}x` }),
    );

    const result = await fetchRecipeFromUrl('https://example.com/a');

    expect(result).toEqual({ ok: false, reason: 'too_many_redirects' });
    // Initial request + MAX_REDIRECTS follows.
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('classifies a 3xx without a Location header as http_other', async () => {
    fetchMock.mockResolvedValueOnce(response(304));

    const result = await fetchRecipeFromUrl('https://example.com/soup');

    expect(result).toEqual({ ok: false, reason: 'http_other', status: 304 });
  });

  it('still classifies plain HTTP failures', async () => {
    fetchMock.mockResolvedValueOnce(response(403));

    const result = await fetchRecipeFromUrl('https://example.com/soup');

    expect(result).toEqual({ ok: false, reason: 'http_forbidden', status: 403 });
  });
});
