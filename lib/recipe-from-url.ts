import * as cheerio from 'cheerio';
import { parseRecipeFromText, type ParsedRecipe } from '@/lib/recipe-parser';

export type FromUrlResult =
  | { ok: true; recipe: ParsedRecipe; via: 'jsonld' | 'ai-fallback'; sourceUrl: string }
  | { ok: false; reason: 'fetch_failed' | 'parse_failed'; status?: number; message: string };

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 ourbigfamilykitchen/1.0';

export async function fetchRecipeFromUrl(url: string): Promise<FromUrlResult> {
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, 'accept': 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      cache: 'no-store',
    });
    if (!res.ok) {
      return {
        ok: false,
        reason: 'fetch_failed',
        status: res.status,
        message: `That page returned ${res.status} ${res.statusText}.`,
      };
    }
    html = await res.text();
  } catch (err) {
    return {
      ok: false,
      reason: 'fetch_failed',
      message: (err as Error).message || 'We couldn’t reach that page.',
    };
  }

  // 1) Try JSON-LD Recipe schema.
  const jsonld = extractJsonLdRecipe(html);
  if (jsonld) {
    return { ok: true, recipe: jsonld, via: 'jsonld', sourceUrl: url };
  }

  // 2) Fall back to AI parsing of the page's visible text.
  const text = extractVisibleText(html);
  if (text.length < 80) {
    return {
      ok: false,
      reason: 'parse_failed',
      message: 'That page didn’t look like it had a recipe.',
    };
  }
  try {
    const ai = await parseRecipeFromText(text);
    return { ok: true, recipe: ai, via: 'ai-fallback', sourceUrl: url };
  } catch (err) {
    return {
      ok: false,
      reason: 'parse_failed',
      message: (err as Error).message || 'We couldn’t parse this page.',
    };
  }
}

// ---- JSON-LD extraction --------------------------------------------------

type AnyJson = Record<string, unknown> | unknown[] | string | number | boolean | null;

function asArray<T>(x: T | T[] | undefined | null): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function findRecipeNode(node: AnyJson): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipeNode(n as AnyJson);
      if (r) return r;
    }
    return null;
  }
  const n = node as Record<string, unknown>;
  const t = n['@type'];
  const types = Array.isArray(t) ? t : [t];
  if (types.some((x) => typeof x === 'string' && x.toLowerCase() === 'recipe')) {
    return n;
  }
  if (n['@graph']) {
    const r = findRecipeNode(n['@graph'] as AnyJson);
    if (r) return r;
  }
  return null;
}

function authorString(author: unknown): string | null {
  if (!author) return null;
  if (typeof author === 'string') return author.trim() || null;
  if (Array.isArray(author)) {
    const names = author.map(authorString).filter(Boolean) as string[];
    return names.length ? names.join(', ') : null;
  }
  if (typeof author === 'object') {
    const a = author as Record<string, unknown>;
    if (typeof a.name === 'string') return a.name.trim() || null;
  }
  return null;
}

function instructionsToSteps(
  ins: unknown,
): { sub_header: string | null; body: string }[] {
  // Recipe instructions can be:
  //  - a single string (sometimes with line breaks)
  //  - an array of strings
  //  - an array of HowToStep / HowToSection objects
  if (typeof ins === 'string') {
    return ins
      .split(/\n+|(?<=\.)\s+(?=[A-Z])/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((body) => ({ sub_header: null, body }));
  }
  if (Array.isArray(ins)) {
    const out: { sub_header: string | null; body: string }[] = [];
    for (const step of ins) {
      if (typeof step === 'string') {
        out.push({ sub_header: null, body: step.trim() });
        continue;
      }
      if (step && typeof step === 'object') {
        const s = step as Record<string, unknown>;
        const t = (s['@type'] as string) || '';
        if (t === 'HowToSection') {
          const subHeader = (s.name as string) || null;
          for (const inner of asArray<unknown>(s.itemListElement as unknown)) {
            if (typeof inner === 'string') {
              out.push({ sub_header: subHeader, body: inner.trim() });
            } else if (inner && typeof inner === 'object') {
              const i = inner as Record<string, unknown>;
              const body = (i.text as string) || (i.name as string) || '';
              if (body) out.push({ sub_header: subHeader, body: body.trim() });
            }
          }
        } else {
          const body = (s.text as string) || (s.name as string) || '';
          if (body) out.push({ sub_header: null, body: body.trim() });
        }
      }
    }
    return out.filter((s) => s.body.length > 0);
  }
  return [];
}

function ingredientsToGroups(
  ings: unknown,
): { sub_header: string | null; items: string[] }[] {
  // recipeIngredient is usually a flat string[]. Some sites use HowToSection
  // groupings, but those are rare in JSON-LD — flat is the norm.
  if (!ings) return [];
  const items = asArray<unknown>(ings)
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean);
  if (items.length === 0) return [];
  return [{ sub_header: null, items }];
}

function extractJsonLdRecipe(html: string): ParsedRecipe | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const script of scripts) {
    const raw = $(script).contents().text();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Some sites embed multiple JSON objects in one tag separated by newlines.
      const cleaned = raw.trim().replace(/^\s*\[|\]\s*$/g, '');
      try {
        parsed = JSON.parse(`[${cleaned}]`);
      } catch {
        continue;
      }
    }
    const node = findRecipeNode(parsed as AnyJson);
    if (!node) continue;

    const title = (node.name as string) || '';
    if (!title.trim()) continue;

    const description = (node.description as string) || null;
    const author = authorString(node.author);
    const ingredient_groups = ingredientsToGroups(
      node.recipeIngredient ?? node.ingredients,
    );
    const instruction_steps = instructionsToSteps(node.recipeInstructions);

    return {
      title:           title.trim(),
      story:           description?.trim() || null,
      originally_from: author,
      ingredient_groups,
      instruction_steps,
    };
  }
  return null;
}

// ---- Visible text extraction for AI fallback ----------------------------

function extractVisibleText(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, noscript, iframe, nav, header, footer, form').remove();
  const main = $('main').first().text() || $('article').first().text() || $('body').text();
  return main.replace(/\s+/g, ' ').trim().slice(0, 18000);
}
