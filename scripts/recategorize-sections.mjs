// Recategorize recipes still on legacy section slugs (meat-entrees, soups,
// starches, breakfast) into the new 16-section scheme. Uses Sonnet 4.6 with
// structured output. Logs decisions to scripts/_recat-log.json.
//
// Usage:
//   set -a && source .env.local && set +a
//   node scripts/recategorize-sections.mjs              # dry run, no DB writes
//   node scripts/recategorize-sections.mjs --apply      # apply DB updates

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import fs from 'node:fs';

const APPLY = process.argv.includes('--apply');
const BATCH_SIZE = 15;

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => l.split(/=(.*)/s).slice(0, 2)),
);

process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const ai = new Anthropic();

const LEGACY_SOURCES = ['meat-entrees', 'soups', 'starches', 'breakfast'];

const NEW_SECTIONS = [
  ['breakfast-and-brunch',       'Breakfast & Brunch — pancakes, eggs, coffee cakes, brunch dishes'],
  ['drinks',                     'Drinks — cocktails, mocktails, punches, hot drinks'],
  ['appetizers-and-snacks',      'Appetizers & Snacks — dips, finger foods, party bites, hors d\'oeuvres'],
  ['soups-and-stews',            'Soups & Stews — broth-based, bisques, stocks, stews; NOT chili'],
  ['chili',                      'Chili — any dish whose primary identity is chili (bean, beef, white chicken, Cincinnati, etc.)'],
  ['salads-and-dressings',       'Salads & Dressings — cold salads + standalone dressings/vinaigrettes'],
  ['sandwiches',                 'Sandwiches — burgers, paninis, subs, wraps'],
  ['pasta-and-noodles',          'Pasta & Noodles — primary identity is the noodle (lasagna, manicotti, fettuccine, linguine, spaghetti dishes, stuffed shells, spätzle as the main, noodle bake)'],
  ['mains-chicken-turkey',       'Mains: Chicken & Turkey — main-course poultry dishes'],
  ['mains-beef-pork-lamb',       'Mains: Beef, Pork & Lamb — main-course red meat dishes (steak, pot roast, pork chops, lamb chops, ham, sausage-as-main)'],
  ['mains-fish-seafood',         'Mains: Fish & Seafood — main-course fish or shellfish (paella, jambalaya with seafood, clam dishes)'],
  ['mains-vegetarian',           'Mains: Vegetarian — main-course meatless dishes (NOT a side, NOT a salad)'],
  ['sides-vegetables',           'Sides: Vegetables — cooked vegetable side dishes'],
  ['sides-potatoes-rice-grains', 'Sides: Potatoes, Rice & Grains — potato sides, rice sides, grain sides, stuffings/dressings (the Thanksgiving kind), risotto as a side, fried rice'],
  ['breads',                     'Breads — yeasted breads, quick breads, biscuits, scones, kuchen dough, Yorkshire pudding, brown bread'],
  ['desserts',                   'Desserts — cakes, pies, cookies, candies, ice cream, sweet finales'],
];

const VALID_SLUGS = NEW_SECTIONS.map(([s]) => s);
const SlugEnum = z.enum(VALID_SLUGS);

const DecisionSchema = z.object({
  id: z.string(),
  section_slug: SlugEnum,
  reason: z.string(),
});
const BatchOutputSchema = z.object({
  decisions: z.array(DecisionSchema),
});

const SYSTEM_PROMPT = `You categorize recipes into a fixed list of 16 sections for a family cookbook. The user will give you a batch of recipes; for each, return its best section_slug from the allowed list, plus a one-line reason citing the dish identity.

Allowed sections (slug — definition):
${NEW_SECTIONS.map(([s, d]) => `- ${s} — ${d}`).join('\n')}

Rules:
- The "primary identity" of the dish wins. A pasta dish stuffed with meat (lasagna, manicotti) is Pasta & Noodles, not a meat main.
- A dish called "Chili" — beef chili, white chicken chili, Cincinnati chili, even chili that uses ground turkey — goes to "chili", not "soups-and-stews".
- A meat-based stew (Irish stew, beef stew, joe's zoo stew) goes to "soups-and-stews", not chili.
- Stocks (chicken stock, beef stock, fish stock, turkey giblet stock) → soups-and-stews.
- Stuffings/dressings (the Thanksgiving kind) → sides-potatoes-rice-grains.
- Quick breads, biscuits, scones, yeasted breads, Yorkshire pudding, kuchen dough (the dough itself, not finished kuchen) → breads.
- Sweet finished baked goods like coffee cake, fruit kuchen, sour-cream walnut coffee cake, pinwheels, doughnuts → breakfast-and-brunch (or desserts if the source explicitly frames it as dessert).
- Fried rice as a main (with meat as the central protein) → mains-chicken-turkey or mains-beef-pork-lamb based on the protein. Fried rice as a side → sides-potatoes-rice-grains.
- Paella & jambalaya → mains-fish-seafood when seafood is featured.
- Yorkshire Pudding with Rare Roast Beef (single dish) → mains-beef-pork-lamb; plain Yorkshire Pudding → breads.
- Hot Chicken Salad (the casserole) → mains-chicken-turkey, not salads.
- Steak Salad → salads-and-dressings.
- A recipe whose name suggests a sauce or basting glaze on its own → sides-potatoes-rice-grains is wrong; if it's clearly a sauce/condiment, pick salads-and-dressings (dressings/sauces live there) only if there's no obviously better home. Use your judgment.

When you cannot tell a vegetarian main from a side, prefer "sides-vegetables" unless the recipe has substantial protein (cheese-heavy, eggs, tofu, beans as the centerpiece).`;

const userMessageFor = (batch) => {
  const lines = batch.map((r) => {
    const tag = r.kind === 'native' ? `[NATIVE/${r.old_slug}]` : `[FED/${r.old_slug}]`;
    const ingredients = r.ingredients ? `\nIngredients: ${r.ingredients}` : '';
    return `id: ${r.id}\n${tag} ${r.title}${ingredients}\n`;
  });
  return `Categorize each recipe below. Return one decision per id (use the EXACT id strings).\n\n${lines.join('\n---\n')}`;
};

async function callBatch(batch) {
  const resp = await ai.messages.parse({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'medium',
      format: zodOutputFormat(BatchOutputSchema),
    },
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userMessageFor(batch) }],
  });
  if (!resp.parsed_output) throw new Error('No parsed output');
  return {
    decisions: resp.parsed_output.decisions,
    usage: resp.usage,
  };
}

// ---------------------- pull candidates ----------------------

console.log('Pulling candidates…');

const { data: oldSectionRows } = await db
  .from('sections')
  .select('id, slug')
  .in('slug', LEGACY_SOURCES);
const oldSectionIds = oldSectionRows.map((r) => r.id);
const oldSectionSlugById = Object.fromEntries(oldSectionRows.map((r) => [r.id, r.slug]));

const { data: nativeRows } = await db
  .from('recipes')
  .select(`
    id, title, section_id,
    ingredients ( item_text, sort_order )
  `)
  .in('section_id', oldSectionIds);

const { data: fedRows } = await db
  .from('federated_recipes')
  .select('id, title, section_slug, search_tokens')
  .in('section_slug', LEGACY_SOURCES);

const candidates = [
  ...nativeRows.map((r) => ({
    kind: 'native',
    id: r.id,
    title: r.title,
    old_slug: oldSectionSlugById[r.section_id],
    ingredients: (r.ingredients || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => i.item_text)
      .join(', ')
      .slice(0, 1200),
  })),
  ...fedRows.map((r) => ({
    kind: 'federated',
    id: r.id,
    title: r.title,
    old_slug: r.section_slug,
    // The search_tokens blob already contains ingredient text after the
    // double pipe. Keep it short for cost control.
    ingredients: (r.search_tokens || '').slice(0, 1200),
  })),
];

console.log(`Found ${candidates.length} candidates: ${nativeRows.length} native + ${fedRows.length} federated`);

// ---------------------- run AI ----------------------

const decisions = [];
let totalInput = 0, totalOutput = 0;

for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
  const batch = candidates.slice(i, i + BATCH_SIZE);
  process.stdout.write(`  batch ${i / BATCH_SIZE + 1}/${Math.ceil(candidates.length / BATCH_SIZE)} (${batch.length} items)… `);
  const start = Date.now();
  const { decisions: batchDecisions, usage } = await callBatch(batch);
  totalInput  += usage.input_tokens;
  totalOutput += usage.output_tokens;
  for (const d of batchDecisions) {
    const c = batch.find((b) => b.id === d.id);
    if (!c) { console.warn(`  ⚠ no candidate for id ${d.id}`); continue; }
    decisions.push({ ...c, new_slug: d.section_slug, reason: d.reason });
  }
  console.log(`${Date.now() - start}ms (in:${usage.input_tokens} out:${usage.output_tokens})`);
}

console.log(`\nAI done. Total: ${decisions.length}/${candidates.length} decisions.`);
console.log(`Tokens: in=${totalInput} out=${totalOutput}`);
const cost = (totalInput * 3 + totalOutput * 15) / 1_000_000;
console.log(`Est cost: $${cost.toFixed(2)} (Sonnet 4.6 $3/M in, $15/M out)`);

// ---------------------- summarize ----------------------

const byNewSlug = {};
for (const d of decisions) {
  byNewSlug[d.new_slug] = (byNewSlug[d.new_slug] ?? 0) + 1;
}
console.log('\nDecisions per new section:');
for (const [slug, n] of Object.entries(byNewSlug).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${slug}`);
}

// Log a few notable changes (chili, vegetarian, pasta, breads).
console.log('\nNotable picks:');
for (const slug of ['chili', 'pasta-and-noodles', 'mains-vegetarian', 'breads']) {
  const picks = decisions.filter((d) => d.new_slug === slug);
  if (picks.length === 0) continue;
  console.log(`\n[${slug}] (${picks.length})`);
  for (const d of picks) console.log(`  - ${d.title}  ←  ${d.old_slug}  (${d.reason})`);
}

fs.writeFileSync('scripts/_recat-log.json', JSON.stringify(decisions, null, 2));
console.log('\nWrote scripts/_recat-log.json');

if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to write to the DB.');
  process.exit(0);
}

// ---------------------- apply ----------------------

console.log('\nApplying updates…');

const { data: newSections } = await db.from('sections').select('id, slug').in('slug', VALID_SLUGS);
const sectionIdBySlug = Object.fromEntries(newSections.map((r) => [r.slug, r.id]));

let appliedN = 0, appliedF = 0;

for (const d of decisions) {
  if (d.kind === 'native') {
    const newId = sectionIdBySlug[d.new_slug];
    if (!newId) throw new Error(`No section row for slug ${d.new_slug}`);
    const { error } = await db.from('recipes').update({ section_id: newId }).eq('id', d.id);
    if (error) { console.error(`  ✗ native ${d.id}: ${error.message}`); continue; }
    appliedN++;
  } else {
    const { error } = await db.from('federated_recipes').update({ section_slug: d.new_slug }).eq('id', d.id);
    if (error) { console.error(`  ✗ fed ${d.id}: ${error.message}`); continue; }
    appliedF++;
  }
}

console.log(`Applied: ${appliedN} native + ${appliedF} federated`);

// ---------------------- final orphan check ----------------------

const { count: leftoverNative } = await db
  .from('recipes')
  .select('id', { head: true, count: 'exact' })
  .in('section_id', oldSectionIds);
const { count: leftoverFed } = await db
  .from('federated_recipes')
  .select('id', { head: true, count: 'exact' })
  .in('section_slug', LEGACY_SOURCES);

console.log(`Orphans remaining: ${leftoverNative} native, ${leftoverFed} federated`);
if (leftoverNative === 0 && leftoverFed === 0) {
  console.log('All clear. Old sections can now be deleted (migration 0013).');
}
