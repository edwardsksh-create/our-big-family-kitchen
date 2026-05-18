// Local smoke test for the URL-fetch hardening. Tries a handful of real
// recipe sites and prints whether each yields a recipe, falls through to
// the AI fallback, or fails with a specific reason.
//
// Run: npx tsx scripts/test-url-fetch.ts

import { fetchRecipeFromUrl } from '../lib/recipe-from-url';

const URLS = [
  // Cloudflare-protected, expected to still 403:
  'https://www.foodnetwork.com/recipes/food-network-kitchen/copycat-zuppa-toscana-5565099',
  // Food blogs that usually have clean JSON-LD:
  'https://smittenkitchen.com/2025/01/perfect-tomato-soup/',
  'https://smittenkitchen.com/',  // home page — should parse_failed
  'https://www.seriouseats.com/no-knead-bread-recipe-1972832',
  'https://www.allrecipes.com/recipe/8628461/curried-roasted-cauliflower-and-leek-soup/',
  'https://www.bonappetit.com/recipe/cacio-e-pepe',
  // Garbage URL:
  'https://this-host-definitely-does-not-exist.invalid/recipe',
];

async function main() {
  for (const url of URLS) {
    process.stdout.write(`${url}\n  -> `);
    try {
      const result = await fetchRecipeFromUrl(url);
      if (result.ok) {
        console.log(`ok via ${result.via} — "${result.recipe.title}"`);
      } else {
        console.log(`failed: ${result.reason}${result.status ? ` (status ${result.status})` : ''}`);
      }
    } catch (err) {
      const e = err as Error;
      console.log(`threw: ${e?.message ?? err}`);
    }
  }
}

main();
