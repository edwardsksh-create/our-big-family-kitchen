# Recipe house style

The shared standard for unit abbreviations, temperature copy, and capitalization on recipes added to Our Big Family Kitchen. Implemented in `lib/recipes/house-style.ts` and applied automatically at the recipe-ingestion seam (text paste, URL JSON-LD, photo upload, vision parse).

## Units and abbreviations

Always **abbreviated** (no trailing period, single space after the number, never pluralized):

| Spelled out | Abbreviation |
|---|---|
| teaspoon | `tsp` |
| tablespoon | `Tbsp` (capital T) |
| ounce | `oz` |
| pound | `lb` |
| fluid ounce | `fl oz` |

Always **spelled out** (pluralized when quantity > 1):

| Singular | Plural |
|---|---|
| cup | cups |
| pint | pints |
| quart | quarts |
| gallon | gallons |
| pinch | pinches |
| dash | dashes |

## Normalization (handles OCR / handwriting artifacts)

| Input | Output |
|---|---|
| `1#`, `1 #` | `1 lb` |
| `tsp.` | `tsp` |
| `1Tbsp` | `1 Tbsp` |
| `2 tsps` | `2 tsp` |
| `1 cups` | `1 cup` |
| `2 cup` | `2 cups` |

## Temperatures

Render oven temperatures as `[number] degrees`. Drop `°`, `°F`, and the trailing `F`.

| Input | Output |
|---|---|
| `350°F` | `350 degrees` |
| `350°` | `350 degrees` |
| `350F` | `350 degrees` |
| `350 deg`, `350 deg.` | `350 degrees` |

## Capitalization — ingredient lines

**Default: lowercase.** Ingredient lines are list items, not sentences.

- Lowercase the **first word** of each ingredient line.
- Lowercase **generic** ingredients and descriptors: `flour`, `butter`, `eggs`, `chopped`, `minced`, `softened`, `divided`, `to taste`.
- Lowercase **place-derived** ingredient names, including cheeses: `parmesan`, `cheddar`, `swiss`, `gruyère`, `romano`, `dijon`, `worcestershire`.

**Keep capitalized** only true brand / trademark / product names. Current allowlist:

> Pam, Bisquick, Crisco, Cool Whip, Velveeta, Tabasco, Old Bay, Cheez-It, Jell-O, Ritz, Heinz

When uncertain whether something is a brand or a generic, default to **lowercase**. Under-capitalizing is preferable to capitalizing generics.

To extend the allowlist, add the new brand to `BRAND_NAMES` in `lib/recipes/house-style.ts` and add a covering test in `tests/unit/house-style.test.ts`.

## Capitalization — everything else

- **Titles**: unchanged (full normal title-casing as written).
- **Stories** (recipe headnote prose): unchanged sentence capitalization.
- **Method / instruction prose**: unchanged sentence capitalization. *But* unit abbreviations and temperature copy are still normalized inside method prose.

## Scope

- Applies to **new** recipes parsed/added going forward, and to anything still in the review queue as it's processed.
- Existing published recipes are **not** mass-rewritten. If a one-off cleanup pass is desired later, that's a separate decision.

## Implementation

`lib/recipes/house-style.ts` exports:

- `normalizeIngredientLine(line: string): string` — full normalization including the lowercase pass.
- `normalizeMethodSentence(s: string): string` — units + temperatures only; preserves sentence case.
- `applyHouseStyleToParsedRecipe(p)` / `applyHouseStyleToParsedFromPhotos(p)` — adapters that walk a parsed recipe structure and call the right helper on each line.

The ingestion paths that route through these adapters:

- `lib/recipe-parser.ts` — text-paste AI parse
- `lib/recipe-from-images.ts` — vision parse of PDF pages
- `lib/photos/intake.ts` — photo-upload intake
- `lib/jsonld-recipe.ts` — schema.org Recipe extraction from URLs

Archive imports (`lib/photos/binder-intake.ts`, `scripts/_import-curated-leusch.ts`) are deliberately **not** wired through — they handle historical content that's already imported and shouldn't be retroactively rewritten.
