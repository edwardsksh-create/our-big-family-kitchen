import { describe, it, expect } from 'vitest';
import {
  normalizeIngredientLine,
  normalizeMethodSentence,
  applyHouseStyleToParsedRecipe,
} from '@/lib/recipes/house-style';

describe('normalizeIngredientLine — units & OCR cleanup', () => {
  it('converts pound symbol to lb', () => {
    expect(normalizeIngredientLine('1#')).toBe('1 lb');
    expect(normalizeIngredientLine('1# butter')).toBe('1 lb butter');
    expect(normalizeIngredientLine('1 # butter')).toBe('1 lb butter');
  });

  it('uppercase abbreviations are normalized to canonical case', () => {
    expect(normalizeIngredientLine('1 LB Butter')).toBe('1 lb butter');
    expect(normalizeIngredientLine('1 OZ cheese')).toBe('1 oz cheese');
  });

  it('strips trailing periods on abbreviations', () => {
    expect(normalizeIngredientLine('1 tsp. salt')).toBe('1 tsp salt');
    expect(normalizeIngredientLine('2 Tbsp. olive oil')).toBe('2 Tbsp olive oil');
    expect(normalizeIngredientLine('3 oz. cheese')).toBe('3 oz cheese');
  });

  it('inserts a space between quantity and abbreviation', () => {
    expect(normalizeIngredientLine('1Tbsp olive oil')).toBe('1 Tbsp olive oil');
    expect(normalizeIngredientLine('2tsp salt')).toBe('2 tsp salt');
  });

  it('drops plurals from abbreviations', () => {
    expect(normalizeIngredientLine('2 tsps salt')).toBe('2 tsp salt');
    expect(normalizeIngredientLine('3 Tbsps olive oil')).toBe('3 Tbsp olive oil');
    expect(normalizeIngredientLine('2 lbs ground beef')).toBe('2 lb ground beef');
  });

  it('converts spelled-out units to their abbreviation', () => {
    expect(normalizeIngredientLine('1 tablespoon dijon')).toBe('1 Tbsp dijon');
    expect(normalizeIngredientLine('2 tablespoons olive oil')).toBe('2 Tbsp olive oil');
    expect(normalizeIngredientLine('1 teaspoon salt')).toBe('1 tsp salt');
    expect(normalizeIngredientLine('4 ounces cream cheese')).toBe('4 oz cream cheese');
    expect(normalizeIngredientLine('1 pound ground beef')).toBe('1 lb ground beef');
    expect(normalizeIngredientLine('2 fluid ounces olive oil')).toBe('2 fl oz olive oil');
  });

  it('pluralizes/singularizes spelled-out units based on the quantity', () => {
    expect(normalizeIngredientLine('1 cups flour')).toBe('1 cup flour');
    expect(normalizeIngredientLine('2 cup flour')).toBe('2 cups flour');
    expect(normalizeIngredientLine('1/2 cups flour')).toBe('1/2 cup flour');
    expect(normalizeIngredientLine('1 1/2 cup flour')).toBe('1 1/2 cups flour');
    expect(normalizeIngredientLine('2 pint milk')).toBe('2 pints milk');
    expect(normalizeIngredientLine('1 pints milk')).toBe('1 pint milk');
    expect(normalizeIngredientLine('1 dashes salt')).toBe('1 dash salt');
    expect(normalizeIngredientLine('2 dash salt')).toBe('2 dashes salt');
    expect(normalizeIngredientLine('1 pinches saffron')).toBe('1 pinch saffron');
    expect(normalizeIngredientLine('2 pinch saffron')).toBe('2 pinches saffron');
  });
});

describe('normalizeIngredientLine — capitalization', () => {
  it('lowercases the first word of each ingredient line', () => {
    expect(normalizeIngredientLine('Salt To Taste')).toBe('salt to taste');
    expect(normalizeIngredientLine('Eggs, beaten')).toBe('eggs, beaten');
  });

  it('lowercases generic ingredients and place-derived names', () => {
    expect(normalizeIngredientLine('1 cup Parmesan cheese')).toBe('1 cup parmesan cheese');
    expect(normalizeIngredientLine('1 tablespoon Dijon mustard')).toBe('1 Tbsp dijon mustard');
    expect(normalizeIngredientLine('1 tsp Worcestershire sauce')).toBe('1 tsp worcestershire sauce');
    expect(normalizeIngredientLine('2 Cups Flour')).toBe('2 cups flour');
  });

  it('preserves true brand names from the allowlist', () => {
    expect(normalizeIngredientLine('Pam cooking spray')).toBe('Pam cooking spray');
    expect(normalizeIngredientLine('Bisquick mix')).toBe('Bisquick mix');
    expect(normalizeIngredientLine('1 container cool whip')).toBe('1 container Cool Whip');
    expect(normalizeIngredientLine('cheez-it crackers')).toBe('Cheez-It crackers');
    expect(normalizeIngredientLine('jell-o mix')).toBe('Jell-O mix');
    expect(normalizeIngredientLine('1 packet old bay seasoning')).toBe('1 packet Old Bay seasoning');
  });

  it('defaults to lowercase for ambiguous capitalization', () => {
    expect(normalizeIngredientLine('parmesan')).toBe('parmesan');
    expect(normalizeIngredientLine('Cheddar cheese, shredded')).toBe('cheddar cheese, shredded');
  });
});

describe('normalizeIngredientLine — temperatures', () => {
  it('rewrites °F variations', () => {
    expect(normalizeIngredientLine('350°F')).toBe('350 degrees');
    expect(normalizeIngredientLine('350 °F')).toBe('350 degrees');
    expect(normalizeIngredientLine('350°')).toBe('350 degrees');
    expect(normalizeIngredientLine('350F')).toBe('350 degrees');
    expect(normalizeIngredientLine('350 deg')).toBe('350 degrees');
    expect(normalizeIngredientLine('350 deg.')).toBe('350 degrees');
  });

  it('strips a redundant trailing F after "degrees"', () => {
    expect(normalizeMethodSentence('Bake at 350 degrees F for 30 minutes.'))
      .toBe('Bake at 350 degrees for 30 minutes.');
  });
});

describe('normalizeMethodSentence', () => {
  it('preserves sentence capitalization while normalizing units/temps', () => {
    expect(normalizeMethodSentence('Preheat the oven to 350°F.'))
      .toBe('Preheat the oven to 350 degrees.');
    expect(normalizeMethodSentence('Add 1 Tablespoon olive oil and 2 tsps salt.'))
      .toBe('Add 1 Tbsp olive oil and 2 tsp salt.');
    expect(normalizeMethodSentence('Pour in 2 Cups of milk.'))
      .toBe('Pour in 2 cups of milk.'); // unit pluralize works; lowercase NOT applied
  });

  it('does not lowercase the first word of a method sentence', () => {
    const out = normalizeMethodSentence('Whisk the eggs.');
    expect(out.startsWith('Whisk')).toBe(true);
  });
});

describe('applyHouseStyleToParsedRecipe', () => {
  it('normalizes every ingredient line and instruction body', () => {
    const out = applyHouseStyleToParsedRecipe({
      title: 'Test',
      story: null,
      originally_from: null,
      external_source: null,
      ingredient_groups: [
        {
          sub_header: null,
          items: [
            '1 tablespoon Dijon mustard',
            '2 Cups Flour',
            'Salt To Taste',
            'Pam cooking spray',
          ],
        },
      ],
      instruction_steps: [
        { sub_header: null, body: 'Preheat oven to 350°F.' },
        { sub_header: null, body: 'Add 1 Tbsp. olive oil.' },
      ],
    });
    expect(out.ingredient_groups?.[0].items).toEqual([
      '1 Tbsp dijon mustard',
      '2 cups flour',
      'salt to taste',
      'Pam cooking spray',
    ]);
    expect(out.instruction_steps?.[0].body).toBe('Preheat oven to 350 degrees.');
    expect(out.instruction_steps?.[1].body).toBe('Add 1 Tbsp olive oil.');
  });
});
