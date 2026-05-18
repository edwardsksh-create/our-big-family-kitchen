// Per-filename rules for the BFK PDF ingestion pipeline. Adding a new
// BFK_*.pdf with new metadata is a config-only change.

export type BfkFileRule = {
  // Display label for log output.
  label:               string;
  // Name as stored in the contributors table.
  contributorName:     string;
  // Extra guidance handed to Claude when extracting recipes from this file.
  // The base vision prompt already handles the general case; this fills in
  // file-specific quirks (e.g. "extract only the third recipe").
  extraction:          string;
  // If set, the parser is told to use this as `originally_from` for every
  // recipe extracted from the file (overrides anything the AI infers).
  originallyFrom?:     string;
  // If set, this becomes the story field (overrides anything the AI infers).
  // Useful when the file's author provided narrative outside the recipe
  // itself.
  storyOverride?:      string;
  // If true, recipes from this file get a `needs_instructions` tag so the
  // admin queue can highlight them (some BFK files have ingredient-only
  // recipes with no full instructions documented).
  needsInstructions?:  boolean;
  // Hint a section slug if the file is unambiguous (most cases let the AI
  // pick from the list of section slugs).
  defaultSection?:     string;
};

export const BFK_RULES: Record<string, BfkFileRule> = {
  'BFK_BrazilianSalsa.pdf': {
    label:             'Brazilian Salsa',
    contributorName:   'Annie Sundy',
    extraction:
      'This is a handwritten recipe on torn paper, printed in all-caps. ' +
      'Extract the single recipe titled "SALSA". It is an ingredient list ' +
      'with no cooking instructions documented — leave the instructions ' +
      'array empty if no clear steps appear.',
    needsInstructions: true,
    defaultSection:    'appetizers',
  },

  'BFK_HerbedGoatCheesefromMinnie.pdf': {
    label:           'Herbed Goat Cheese (Cook’s Illustrated scan)',
    contributorName: 'Martha Branion',
    extraction:
      'This is a magazine scan from Cook’s Illustrated, November/December 2003 page 19. ' +
      'The page shows THREE recipes. Extract ONLY the third recipe, titled ' +
      '"Salad with Apples, Walnuts, Dried Cherries, and Herbed Baked Goat Cheese" ' +
      '(serves 6). Do NOT extract the other two recipes (the standalone goat ' +
      'cheese recipe and the basic salad), and do NOT extract surrounding ' +
      'article text. Return exactly one recipe in the array.',
    originallyFrom:  "Cook's Illustrated, November 2003",
    storyOverride:
      'Aunt Martha (Minnie) made this salad with the herbed baked goat cheese ' +
      'for Christmas Day dinner one year and gave me this scan so I could ' +
      'learn to make them on my own.',
    defaultSection:  'salads',
  },

  'BFK_LucysFavorites.pdf': {
    label:           'Lucy’s 2005 Favorites',
    contributorName: 'Lucy Leusch',
    extraction:
      'This is an 11-page document titled "Lucy’s 2005 Top Ten Recipes and ' +
      'Favorite New Kitchen Tool". Page 1 is a cover; pages 2–11 contain ' +
      'ten recipes in order. Extract ALL TEN recipes:\n' +
      '  1. Sparkling Peach Splash\n' +
      '  2. Bacon and Blue Cheese Salad with Caesar Dressing\n' +
      '  3. Simple Balsamic Vinaigrette\n' +
      '  4. Grilled Dixie Chicken with Cayenne Spice Rub\n' +
      '  5. Chicken Breasts Chasseur ("Chaucer")\n' +
      '  6. Le Francais’ Braised Short Ribs\n' +
      '  7. Balthazar’s Moules a la Mariniere\n' +
      '  8. Penne with Veal Ragu\n' +
      '  9. Green Beans, Toasted Pecans, and Blue Cheese\n' +
      ' 10. Steve Grudichak’s Kahlua Cake\n' +
      'Some recipes contain personal notes addressed to specific family ' +
      'members (e.g. "Special Note: Kate, never attempt this recipe..."). ' +
      'PRESERVE these notes verbatim in the recipe’s story field — they are ' +
      'part of the family voice. Do not turn the cover page into a recipe.',
  },

  'BFK_SteakSalad.pdf': {
    label:             'Steak Salad',
    contributorName:   'Lucy Leusch',
    extraction:
      'This is a handwritten recipe in cursive titled "Steak Salad". It ' +
      'has section headers (marinade, dressing, vegetables) but no full ' +
      'cooking instructions — only margin notes like "refrigerate after ' +
      'rubbing meat", "cut against grain", "blend in food processor". ' +
      'Save the ingredients organized under their sub-headers. Put the ' +
      'margin notes as instruction steps where they fit, but leave the ' +
      'instructions array sparse if that is what the recipe documents — ' +
      'do NOT invent steps that aren’t there.',
    needsInstructions: true,
    defaultSection:    'meat-entrees',
  },
};

export function ruleFor(filename: string): BfkFileRule | null {
  return BFK_RULES[filename] ?? null;
}
