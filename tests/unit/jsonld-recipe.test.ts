import { describe, it, expect } from 'vitest';
import {
  asArray,
  findRecipeNode,
  authorString,
  instructionsToSteps,
  ingredientsToGroups,
  recipeNodeToParsed,
  extractJsonLdRecipe,
} from '@/lib/jsonld-recipe';
import { classifyHttpStatus } from '@/lib/recipe-from-url';

describe('asArray()', () => {
  it('wraps a scalar', () => {
    expect(asArray('x')).toEqual(['x']);
  });
  it('passes an array through', () => {
    expect(asArray(['a', 'b'])).toEqual(['a', 'b']);
  });
  it('returns [] for null/undefined', () => {
    expect(asArray(null)).toEqual([]);
    expect(asArray(undefined)).toEqual([]);
  });
});

describe('classifyHttpStatus()', () => {
  it('403 → http_forbidden', () => expect(classifyHttpStatus(403)).toBe('http_forbidden'));
  it('404 → http_not_found', () => expect(classifyHttpStatus(404)).toBe('http_not_found'));
  it('410 → http_not_found', () => expect(classifyHttpStatus(410)).toBe('http_not_found'));
  it('500 → http_server_error', () => expect(classifyHttpStatus(500)).toBe('http_server_error'));
  it('503 → http_server_error', () => expect(classifyHttpStatus(503)).toBe('http_server_error'));
  it('418 → http_other', () => expect(classifyHttpStatus(418)).toBe('http_other'));
});

describe('findRecipeNode()', () => {
  it('finds a top-level Recipe object', () => {
    const node = findRecipeNode({ '@type': 'Recipe', name: 'Kuchen' });
    expect(node?.name).toBe('Kuchen');
  });
  it('finds a Recipe inside an array', () => {
    const node = findRecipeNode([
      { '@type': 'WebPage' },
      { '@type': 'Recipe', name: 'Stew' },
    ]);
    expect(node?.name).toBe('Stew');
  });
  it('finds a Recipe inside @graph', () => {
    const node = findRecipeNode({
      '@graph': [{ '@type': 'Organization' }, { '@type': 'Recipe', name: 'Pie' }],
    });
    expect(node?.name).toBe('Pie');
  });
  it('matches @type given as an array (Recipe + NewsArticle)', () => {
    const node = findRecipeNode({ '@type': ['NewsArticle', 'Recipe'], name: 'Soup' });
    expect(node?.name).toBe('Soup');
  });
  it('is case-insensitive on @type', () => {
    expect(findRecipeNode({ '@type': 'recipe', name: 'x' })?.name).toBe('x');
  });
  it('returns null when there is no Recipe node', () => {
    expect(findRecipeNode({ '@type': 'WebPage' })).toBeNull();
    expect(findRecipeNode('a string')).toBeNull();
    expect(findRecipeNode(null)).toBeNull();
  });
});

describe('authorString()', () => {
  it('handles a plain string', () => {
    expect(authorString('Aunt Laura')).toBe('Aunt Laura');
  });
  it('handles a Person object', () => {
    expect(authorString({ '@type': 'Person', name: 'Bertha Leusch' })).toBe('Bertha Leusch');
  });
  it('handles an array of authors', () => {
    expect(authorString([{ name: 'A' }, { name: 'B' }])).toBe('A, B');
  });
  it('returns null for missing / empty', () => {
    expect(authorString(undefined)).toBeNull();
    expect(authorString('')).toBeNull();
    expect(authorString({})).toBeNull();
  });
});

describe('instructionsToSteps()', () => {
  it('splits a single string on sentence boundaries', () => {
    const steps = instructionsToSteps('Heat the oven. Mix the batter. Bake for an hour.');
    expect(steps.map((s) => s.body)).toEqual([
      'Heat the oven.',
      'Mix the batter.',
      'Bake for an hour.',
    ]);
    expect(steps.every((s) => s.sub_header === null)).toBe(true);
  });
  it('handles an array of HowToStep objects', () => {
    const steps = instructionsToSteps([
      { '@type': 'HowToStep', text: 'Cream the butter.' },
      { '@type': 'HowToStep', text: 'Add eggs.' },
    ]);
    expect(steps).toHaveLength(2);
    expect(steps[1].body).toBe('Add eggs.');
  });
  it('handles HowToSection with a sub_header', () => {
    const steps = instructionsToSteps([
      {
        '@type': 'HowToSection',
        name: 'For the filling',
        itemListElement: [
          { '@type': 'HowToStep', text: 'Chop apples.' },
          { '@type': 'HowToStep', text: 'Toss with cinnamon.' },
        ],
      },
    ]);
    expect(steps).toHaveLength(2);
    expect(steps[0].sub_header).toBe('For the filling');
    expect(steps[1].sub_header).toBe('For the filling');
  });
  it('handles a plain array of strings', () => {
    expect(instructionsToSteps(['Step one.', 'Step two.'])).toEqual([
      { sub_header: null, body: 'Step one.' },
      { sub_header: null, body: 'Step two.' },
    ]);
  });
  it('returns [] for missing / unusable input', () => {
    expect(instructionsToSteps(undefined)).toEqual([]);
    expect(instructionsToSteps(null)).toEqual([]);
    expect(instructionsToSteps(42)).toEqual([]);
  });
});

describe('ingredientsToGroups()', () => {
  it('wraps a flat string array in one group', () => {
    const groups = ingredientsToGroups(['1 cup flour', '2 eggs']);
    expect(groups).toHaveLength(1);
    expect(groups[0].sub_header).toBeNull();
    expect(groups[0].items).toEqual(['1 cup flour', '2 eggs']);
  });
  it('trims and drops empties', () => {
    const groups = ingredientsToGroups(['  1 cup flour  ', '', '   ']);
    expect(groups[0].items).toEqual(['1 cup flour']);
  });
  it('returns [] for missing input', () => {
    expect(ingredientsToGroups(undefined)).toEqual([]);
    expect(ingredientsToGroups([])).toEqual([]);
  });
});

describe('recipeNodeToParsed()', () => {
  it('builds a ParsedRecipe from a complete node', () => {
    const parsed = recipeNodeToParsed({
      '@type': 'Recipe',
      name: 'Apple Pie',
      description: 'A family favorite.',
      author: { '@type': 'Person', name: 'Dorothy Leusch' },
      recipeIngredient: ['6 apples', '1 pie crust'],
      recipeInstructions: [{ '@type': 'HowToStep', text: 'Fill and bake.' }],
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.title).toBe('Apple Pie');
    expect(parsed!.story).toBe('A family favorite.');
    expect(parsed!.originally_from).toBe('Dorothy Leusch');
    expect(parsed!.ingredient_groups[0].items).toHaveLength(2);
    expect(parsed!.instruction_steps[0].body).toBe('Fill and bake.');
  });
  it('returns null when there is no title', () => {
    expect(recipeNodeToParsed({ '@type': 'Recipe' })).toBeNull();
    expect(recipeNodeToParsed({ '@type': 'Recipe', name: '   ' })).toBeNull();
  });
});

describe('extractJsonLdRecipe()', () => {
  it('extracts a Recipe from a full HTML document', () => {
    const html = `<!doctype html><html><head>
      <script type="application/ld+json">
      ${JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', name: 'Some Blog' },
          {
            '@type': 'Recipe',
            name: 'Bundt Kuchen',
            recipeIngredient: ['flour', 'butter'],
            recipeInstructions: 'Mix it. Bake it.',
          },
        ],
      })}
      </script></head><body>page</body></html>`;
    const recipe = extractJsonLdRecipe(html);
    expect(recipe?.title).toBe('Bundt Kuchen');
    expect(recipe?.ingredient_groups[0].items).toEqual(['flour', 'butter']);
    expect(recipe?.instruction_steps).toHaveLength(2);
  });
  it('returns null when the page has no JSON-LD Recipe', () => {
    const html = `<html><head>
      <script type="application/ld+json">${JSON.stringify({ '@type': 'WebPage' })}</script>
      </head><body>nothing here</body></html>`;
    expect(extractJsonLdRecipe(html)).toBeNull();
  });
  it('returns null for a page with no JSON-LD at all', () => {
    expect(extractJsonLdRecipe('<html><body>plain</body></html>')).toBeNull();
  });
  it('skips a malformed JSON-LD block and keeps scanning', () => {
    const html = `<html><head>
      <script type="application/ld+json">{ this is not valid json }</script>
      <script type="application/ld+json">${JSON.stringify({ '@type': 'Recipe', name: 'Salvaged' })}</script>
      </head><body></body></html>`;
    expect(extractJsonLdRecipe(html)?.title).toBe('Salvaged');
  });
});
