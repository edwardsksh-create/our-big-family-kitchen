// Recipe house style — see docs/recipe-house-style.md for the standard this
// implements. Pure string transforms; safe to call on any parsed recipe field.
//
// Two public entry points:
//   normalizeIngredientLine — full normalization (units + temps + lowercase pass)
//   normalizeMethodSentence — units + temps only; preserves sentence case
//
// Plus adapters that walk the parser output shapes and call the right helper
// per line, so the parsers can apply the style with a single call.

// -------------------------------------------------------------------------
// Brand allowlist — words that stay capitalized even on ingredient lines.
// Extend this list (and the corresponding test) when a new brand turns up.
// -------------------------------------------------------------------------

const BRAND_NAMES = [
  'Pam',
  'Bisquick',
  'Crisco',
  'Cool Whip',
  'Velveeta',
  'Tabasco',
  'Old Bay',
  'Cheez-It',
  'Jell-O',
  'Ritz',
  'Heinz',
];

// Tokens whose canonical case must be restored after the ingredient-line
// lowercase pass. Brand names + the one unit abbreviation that isn't already
// lowercase (Tbsp).
const CASE_PRESERVED_TOKENS = [...BRAND_NAMES, 'Tbsp'];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Quantity = integer, decimal, fraction, or a mixed number. Used inside
// regexes that match against a line.
const QUANTITY = '\\d+(?:\\s+\\d+\\/\\d+|\\/\\d+|\\.\\d+)?';

function parseQuantity(s: string): number {
  const t = s.trim();
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return parseInt(frac[1], 10) / parseInt(frac[2], 10);
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

function pluralizeSpelledOut(line: string, base: string, plural: string): string {
  // Matches "<qty> <base>" with optional trailing s/es, case-insensitive,
  // and rewrites to the form (singular vs plural) that matches the quantity.
  const re = new RegExp(`(${QUANTITY})\\s+${base}(?:s|es)?\\b`, 'gi');
  return line.replace(re, (_, qty: string) => {
    const n = parseQuantity(qty);
    return `${qty} ${n > 1 ? plural : base}`;
  });
}

function normalizeUnits(line: string): string {
  let out = line;

  // OCR pound symbol: "1#" or "1 #" → "1 lb"
  out = out.replace(new RegExp(`(${QUANTITY})\\s*#`, 'g'), '$1 lb');

  // No-space-stuck units: "1Tbsp" → "1 Tbsp". Done before spell-out so
  // "1tablespoon" is handled too.
  out = out.replace(
    /(\d)(Tbsp|tsp|oz|lb|tablespoons?|teaspoons?|ounces?|pounds?|cups?|pints?|quarts?|gallons?|pinch(?:es)?|dash(?:es)?)\b/gi,
    '$1 $2',
  );

  // Spell-out → abbrev with canonical case.
  out = out.replace(/\btablespoons?\b/gi, 'Tbsp');
  out = out.replace(/\bteaspoons?\b/gi,   'tsp');
  out = out.replace(/\bfluid\s+ounces?\b/gi, 'fl oz');
  out = out.replace(/\bounces?\b/gi,      'oz');
  out = out.replace(/\bpounds?\b/gi,      'lb');

  // Strip trailing periods on the abbreviated units. The negative-lookahead
  // \b matches between the last letter and the period.
  out = out.replace(/\b(Tbsp|tsp|oz|lb)\./gi, '$1');
  out = out.replace(/\bfl\s+oz\./gi, 'fl oz');

  // Normalize the abbreviation forms themselves: drop plurals, lock canonical
  // case. "TBSP", "Tbsps", "tbsp" all become "Tbsp"; same idea for the rest.
  out = out.replace(/\bTbsps?\b/gi, 'Tbsp');
  out = out.replace(/\btsps?\b/gi,  'tsp');
  out = out.replace(/\bozs?\b/gi,   'oz');
  out = out.replace(/\blbs?\b/gi,   'lb');
  out = out.replace(/\bfl\s+oz\b/gi, 'fl oz');

  // Pluralize / singularize spelled-out units based on the quantity.
  out = pluralizeSpelledOut(out, 'cup',    'cups');
  out = pluralizeSpelledOut(out, 'pint',   'pints');
  out = pluralizeSpelledOut(out, 'quart',  'quarts');
  out = pluralizeSpelledOut(out, 'gallon', 'gallons');
  out = pluralizeSpelledOut(out, 'pinch',  'pinches');
  out = pluralizeSpelledOut(out, 'dash',   'dashes');

  return out;
}

function normalizeTemperatures(line: string): string {
  return line
    // 350°F  or  350 ° F
    .replace(/(\d+)\s*°\s*F\b/g, '$1 degrees')
    // 350°  (not followed by another letter — guards against accidental hits)
    .replace(/(\d+)\s*°(?!\w)/g, '$1 degrees')
    // 350F  (only when followed by a word boundary that isn't another letter)
    .replace(/(\d+)\s*F\b(?=[\s.,;:!?)\]]|$)/g, '$1 degrees')
    // Short form: "350 deg" or "350 deg." (\b prevents matching "deg" inside "degrees")
    .replace(/(\d+)\s+deg\b\.?/gi, '$1 degrees')
    // Singular "350 degree" → "350 degrees"
    .replace(/(\d+)\s+degree\b(?!s)/gi, '$1 degrees')
    // "350 degrees F" → drop the redundant F
    .replace(/(\d+\s+degrees)\s+F\b/gi, '$1');
}

function collapseSpaces(line: string): string {
  return line.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
}

function restoreCasing(line: string): string {
  let out = line;
  for (const token of CASE_PRESERVED_TOKENS) {
    const re = new RegExp(`\\b${escapeRegex(token)}\\b`, 'gi');
    out = out.replace(re, token);
  }
  return out;
}

/**
 * Full normalization for an ingredient line — unit abbreviations, temperature
 * copy, OCR cleanup, lowercase pass, then brand casing restored.
 */
export function normalizeIngredientLine(line: string): string {
  let out = line;
  out = normalizeUnits(out);
  out = normalizeTemperatures(out);
  out = collapseSpaces(out);
  // Ingredient lines: lowercase the whole thing, then restore brand and
  // unit-abbreviation casing.
  out = out.toLowerCase();
  out = restoreCasing(out);
  return out;
}

/**
 * Method/instruction prose normalization — units and temperatures only.
 * Sentence capitalization stays exactly as the author wrote it.
 */
export function normalizeMethodSentence(s: string): string {
  let out = s;
  out = normalizeUnits(out);
  out = normalizeTemperatures(out);
  out = collapseSpaces(out);
  // No lowercase pass — but the unit step may have rewritten "Tablespoon" to
  // "Tbsp" with proper case already. Run restoreCasing so any brand mentions
  // and any case-mangled "tbsp" inside the prose also come out canonical.
  out = restoreCasing(out);
  return out;
}

// -------------------------------------------------------------------------
// Adapters that walk the parser output shapes and apply the right helper to
// each line. The parser callers run these once at parse-completion.
// -------------------------------------------------------------------------

type IngredientGroup    = { sub_header: string | null; items: string[] };
type InstructionStep    = { sub_header: string | null; body:  string  };
type InstructionGroup   = { sub_header: string | null; steps: string[] };

type ParsedRecipeLike = {
  ingredient_groups?: IngredientGroup[];
  instruction_steps?: InstructionStep[];
};

type ParsedFromPhotosLike = {
  ingredients?:  IngredientGroup[];
  instructions?: InstructionGroup[];
};

/** Normalize a ParsedRecipe (text-parse / vision / JSON-LD output shape). */
export function applyHouseStyleToParsedRecipe<T extends ParsedRecipeLike>(p: T): T {
  return {
    ...p,
    ingredient_groups: p.ingredient_groups?.map((g) => ({
      ...g,
      items: g.items.map(normalizeIngredientLine),
    })),
    instruction_steps: p.instruction_steps?.map((s) => ({
      ...s,
      body: normalizeMethodSentence(s.body),
    })),
  };
}

/** Normalize a ParsedFromPhotos (photo-intake) shape. */
export function applyHouseStyleToParsedFromPhotos<T extends ParsedFromPhotosLike>(p: T): T {
  return {
    ...p,
    ingredients:  p.ingredients?.map((g) => ({
      ...g,
      items: g.items.map(normalizeIngredientLine),
    })),
    instructions: p.instructions?.map((g) => ({
      ...g,
      steps: g.steps.map(normalizeMethodSentence),
    })),
  };
}
