#!/usr/bin/env node
// Federate Aunt Laura's recipes from leusch-family-recipes into
// federated_recipes. Idempotent: upserts on source_url.
//
// Run with:
//   node --env-file=.env.local scripts/import-leusch-federation.mjs

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import path from 'node:path';

const RECIPES_PATH = path.resolve(
  process.env.HOME,
  'Projects/leusch-family-recipes/data/recipes.json',
);
const CANONICAL_BASE = 'https://leuschfamilyrecipes.com/recipes';

// Section display-name (from source) → our slug.
const SECTION_SLUG_MAP = {
  'Breakfast':                  'breakfast',
  'Drinks':                     'drinks',
  'Appetizers':                 'appetizers',
  'Soups':                      'soups',
  'Salad Dressings and Sauces': 'salad-dressings',
  'Salads':                     'salads',
  'Sandwiches':                 'sandwiches',
  'Starches':                   'starches',
  'Vegetables':                 'vegetables',
  'Fish Entrees':               'fish-entrees',
  'Meat Entrees':               'meat-entrees',
  'Cookies and Candy':          'cookies-and-candy',
  'Desserts':                   'desserts',
};

const VALID_SECTION_SLUGS = new Set(Object.values(SECTION_SLUG_MAP));

function pickContributorName(recipe) {
  // Prefer the contributors[] array (richer), fall back to contributor string.
  const arr = Array.isArray(recipe.contributors) ? recipe.contributors : [];
  if (arr.length > 0) {
    return arr.map((c) => c?.name).filter(Boolean).join(', ');
  }
  return (recipe.contributor || '').trim();
}

function ingredientText(recipe) {
  const groups = recipe.ingredients ?? [];
  const lines = [];
  for (const g of groups) {
    if (g?.group) lines.push(g.group);
    for (const item of g?.items ?? []) {
      if (item?.raw) lines.push(item.raw);
    }
  }
  return lines.join(' ');
}

function buildSearchTokens(recipe, contributor) {
  const title = recipe.title || '';
  const ings = ingredientText(recipe);
  const storySnippet = (recipe.story || '').slice(0, 200);
  return `${title} | ${contributor} | ${ings} | ${storySnippet}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function transform(recipe, warnings) {
  const sectionRaw = recipe.section || '';
  let sectionSlug = SECTION_SLUG_MAP[sectionRaw];
  if (!sectionSlug) {
    // Best-effort fallback: lowercase + hyphenate
    const fallback = sectionRaw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (VALID_SECTION_SLUGS.has(fallback)) {
      sectionSlug = fallback;
    } else {
      warnings.push(`unmapped section "${sectionRaw}" for recipe "${recipe.id}"`);
      sectionSlug = null;
    }
  }

  const contributor = pickContributorName(recipe);

  return {
    source_url:       `${CANONICAL_BASE}/${recipe.id}`,
    title:            recipe.title,
    contributor_name: contributor || null,
    section_slug:     sectionSlug,
    search_tokens:    buildSearchTokens(recipe, contributor),
  };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    console.error('Run with: node --env-file=.env.local scripts/import-leusch-federation.mjs');
    process.exit(1);
  }

  const raw = readFileSync(RECIPES_PATH, 'utf8');
  const recipes = JSON.parse(raw);
  if (!Array.isArray(recipes)) {
    throw new Error(`Expected array, got ${typeof recipes}`);
  }
  console.log(`Read ${recipes.length} recipes from ${RECIPES_PATH}`);

  const warnings = [];
  const rows = recipes.map((r) => transform(r, warnings));

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Snapshot how many existed before.
  const { count: before } = await supabase
    .from('federated_recipes')
    .select('id', { head: true, count: 'exact' });

  // Replace strategy: delete-all then bulk-insert. We don't have a unique
  // constraint on source_url (just an index), so onConflict-style upserts
  // aren't available. The federation is a fresh mirror each run anyway.
  const { error: delErr } = await supabase
    .from('federated_recipes')
    .delete()
    .gte('fetched_at', '1970-01-01');
  if (delErr) {
    console.error('Delete failed:', delErr);
    process.exit(2);
  }

  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('federated_recipes').insert(slice);
    if (error) {
      console.error('Insert error on batch starting at', i, error);
      process.exit(2);
    }
    inserted += slice.length;
    process.stdout.write(`  inserted ${inserted}/${rows.length}\r`);
  }
  console.log();

  const { count: after } = await supabase
    .from('federated_recipes')
    .select('id', { head: true, count: 'exact' });

  console.log(`\nFederation import complete.`);
  console.log(`  rows before: ${before ?? 0}`);
  console.log(`  rows after:  ${after ?? 0}`);

  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  - ${w}`);
  } else {
    console.log(`\nNo warnings.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
