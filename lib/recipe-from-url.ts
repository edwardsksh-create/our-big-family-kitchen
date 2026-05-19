import * as cheerio from 'cheerio';
import { parseRecipeFromText, type ParsedRecipe } from '@/lib/recipe-parser';
import { extractJsonLdRecipe } from '@/lib/jsonld-recipe';

export type FromUrlFailureReason =
  | 'http_forbidden'      // 403 — common when a site blocks automated requests
  | 'http_not_found'      // 404 / 410
  | 'http_server_error'   // 5xx
  | 'http_other'          // 4xx/3xx we didn't classify above (rare)
  | 'timeout'             // AbortController fired
  | 'network_error'       // DNS/TLS/etc.
  | 'parse_failed';       // fetched OK but no recipe schema and AI fallback failed too

export type FromUrlResult =
  | { ok: true;  recipe: ParsedRecipe; via: 'jsonld' | 'ai-fallback'; sourceUrl: string }
  | { ok: false; reason: FromUrlFailureReason; status?: number };

// A real Chrome desktop UA — getting past most simple bot blockers requires
// looking like a browser, not just sending *some* User-Agent.
const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,' +
    'image/webp,image/apng,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  'accept-encoding': 'gzip, deflate, br',
  'upgrade-insecure-requests': '1',
};

// 10 s is long enough for slow blogs, short enough to give up on stalled sites.
const FETCH_TIMEOUT_MS = 10_000;

// Exported for unit testing.
export function classifyHttpStatus(status: number): FromUrlFailureReason {
  if (status === 403) return 'http_forbidden';
  if (status === 404 || status === 410) return 'http_not_found';
  if (status >= 500 && status <= 599) return 'http_server_error';
  return 'http_other';
}

export async function fetchRecipeFromUrl(url: string): Promise<FromUrlResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let html: string;
  let status: number | undefined;
  try {
    const res = await fetch(url, {
      headers:  BROWSER_HEADERS,
      redirect: 'follow',
      cache:    'no-store',
      signal:   controller.signal,
    });
    status = res.status;
    if (!res.ok) {
      return { ok: false, reason: classifyHttpStatus(res.status), status: res.status };
    }
    html = await res.text();
  } catch (err) {
    const e = err as { name?: string };
    if (e?.name === 'AbortError') {
      return { ok: false, reason: 'timeout' };
    }
    return { ok: false, reason: 'network_error' };
  } finally {
    clearTimeout(timeout);
  }

  // 1) Try JSON-LD Recipe schema.
  const jsonld = extractJsonLdRecipe(html);
  if (jsonld) {
    return { ok: true, recipe: jsonld, via: 'jsonld', sourceUrl: url };
  }

  // 2) Fall back to AI parsing of the page's visible text.
  const text = extractVisibleText(html);
  if (text.length < 80) {
    return { ok: false, reason: 'parse_failed', status };
  }
  try {
    const ai = await parseRecipeFromText(text);
    return { ok: true, recipe: ai, via: 'ai-fallback', sourceUrl: url };
  } catch {
    return { ok: false, reason: 'parse_failed', status };
  }
}

function extractVisibleText(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, noscript, iframe, nav, header, footer, form').remove();
  const main = $('main').first().text() || $('article').first().text() || $('body').text();
  return main.replace(/\s+/g, ' ').trim().slice(0, 18000);
}
