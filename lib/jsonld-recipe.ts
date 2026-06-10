import * as cheerio from 'cheerio';
import type { ParsedRecipe } from '@/lib/recipe-parser';
import { formatSourceAttribution } from '@/lib/recipes/source-attribution';
import { applyHouseStyleToParsedRecipe } from '@/lib/recipes/house-style';

// Pure JSON-LD Recipe extraction. Split out of recipe-from-url.ts so the
// parsing logic is unit-testable without network I/O.

export type AnyJson = Record<string, unknown> | unknown[] | string | number | boolean | null;

export function asArray<T>(x: T | T[] | undefined | null): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

// Walk a parsed JSON-LD value (which may be an object, an array, or an
// @graph-wrapped object) and return the first node whose @type is "Recipe".
export function findRecipeNode(node: AnyJson): Record<string, unknown> | null {
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

// schema.org "author" can be a string, a Person/Organization object, or an
// array of either. Returns a comma-joined name string, or null.
export function authorString(author: unknown): string | null {
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

// schema.org "publisher" is typically an Organization with a name. Strings
// are also tolerated. Returns the publication name, or null.
export function publisherString(publisher: unknown): string | null {
  if (!publisher) return null;
  if (typeof publisher === 'string') return publisher.trim() || null;
  if (Array.isArray(publisher)) {
    for (const p of publisher) {
      const s = publisherString(p);
      if (s) return s;
    }
    return null;
  }
  if (typeof publisher === 'object') {
    const p = publisher as Record<string, unknown>;
    if (typeof p.name === 'string') return p.name.trim() || null;
  }
  return null;
}

// recipeInstructions can be: a single string, an array of strings, an array
// of HowToStep objects, or an array of HowToSection objects (which nest
// HowToStep items and carry a section name).
export function instructionsToSteps(
  ins: unknown,
): { sub_header: string | null; body: string }[] {
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

// recipeIngredient is normally a flat string[]. We don't try to reconstruct
// sub-header groupings from JSON-LD (rare and inconsistent) — one group.
export function ingredientsToGroups(
  ings: unknown,
): { sub_header: string | null; items: string[] }[] {
  if (!ings) return [];
  const items = asArray<unknown>(ings)
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean);
  if (items.length === 0) return [];
  return [{ sub_header: null, items }];
}

// Build a ParsedRecipe from a single JSON-LD Recipe node. Returns null when
// the node has no usable title. JSON-LD recipes nearly always come from a
// publication or website (schema.org Recipe is rarely emitted by book apps),
// so author + publisher feed the "Author for Source" form by default.
export function recipeNodeToParsed(node: Record<string, unknown>): ParsedRecipe | null {
  const title = (node.name as string) || '';
  if (!title.trim()) return null;
  const description = (node.description as string) || null;
  const author    = authorString(node.author);
  const publisher = publisherString(node.publisher);
  const originally_from = formatSourceAttribution({ author, source: publisher, isBook: false });
  return applyHouseStyleToParsedRecipe({
    title:             title.trim(),
    story:             description?.trim() || null,
    originally_from,
    external_source:   (author || publisher)
      ? { author, source: publisher, is_book: false }
      : null,
    ingredient_groups: ingredientsToGroups(node.recipeIngredient ?? node.ingredients),
    instruction_steps: instructionsToSteps(node.recipeInstructions),
  });
}

// Scan a full HTML document's <script type="application/ld+json"> tags for
// the first parseable Recipe node. Returns null when none is found.
export function extractJsonLdRecipe(html: string): ParsedRecipe | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const script of scripts) {
    const raw = $(script).contents().text();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Some sites embed multiple JSON objects in one tag — wrap and retry.
      const cleaned = raw.trim().replace(/^\s*\[|\]\s*$/g, '');
      try {
        parsed = JSON.parse(`[${cleaned}]`);
      } catch {
        continue;
      }
    }
    const node = findRecipeNode(parsed as AnyJson);
    if (!node) continue;
    const recipe = recipeNodeToParsed(node);
    if (recipe) return recipe;
  }
  return null;
}
