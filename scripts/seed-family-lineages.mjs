#!/usr/bin/env node
// Seed 10 stub contributors with primary/secondary family-line ranks,
// and bring Kate + Annie's lineages to the spec.
//
// Prerequisite: migration 0008_family_line_rank.sql has been applied.
//
// Idempotent: re-running is safe (looks up by name, replaces a
// contributor's cfl rows wholesale before re-inserting the desired set).
//
// Run with:
//   node --env-file=.env.local scripts/seed-family-lineages.mjs

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing Supabase env.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const LINEAGES = [
  // Kate is already in the contributors table — we just rewrite her cfl rows.
  { name: 'Kate',            primary: 'edwards',  secondary: 'sundy'    },
  { name: 'Annie Sundy',     primary: 'sundy',    secondary: 'leusch'   },
  { name: 'Lucy Leusch',     primary: 'leusch'                          },
  { name: 'Martha Branion',  primary: 'branion',  secondary: 'leusch'   },
  { name: 'Nancy Quinn',     primary: 'quinn',    secondary: 'leusch'   },
  { name: 'Regina Quinn',    primary: 'quinn'                           },
  { name: 'Brian Edwards',   primary: 'edwards'                         },
  { name: 'Susan Edwards',   primary: 'edwards'                         },
  { name: 'Gary Sundy',      primary: 'sundy'                           },
  { name: 'Megan Sundy',     primary: 'sundy'                           },
  { name: 'Darlene Hong',    primary: 'hong'                            },
  { name: 'Kylene Hong',     primary: 'hong'                            },
];

function stubEmailFor(name) {
  return `stub+${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}@ourbigfamilykitchen.local`;
}

async function ensureContributor(name) {
  const { data: existing } = await db
    .from('contributors')
    .select('id, name, email, role')
    .eq('name', name)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await db
    .from('contributors')
    .insert({
      name,
      email:         stubEmailFor(name),
      role:          'viewer',
      joined_at:     null,
      invited_at:    null,
    })
    .select('id')
    .single();
  if (error || !created) {
    console.error('Insert failed for', name, error);
    process.exit(2);
  }
  return created.id;
}

async function setLineage(contributorId, lineSlugs, rankFn) {
  // Wipe existing rows; re-insert with the right ranks.
  await db.from('contributor_family_lines').delete().eq('contributor_id', contributorId);
  const rows = [];
  for (const [rank, slug] of Object.entries(lineSlugs)) {
    if (!slug) continue;
    const id = rankFn(slug);
    if (!id) throw new Error(`No family line for slug ${slug}`);
    rows.push({ contributor_id: contributorId, family_line_id: id, rank });
  }
  if (rows.length === 0) return;
  const { error } = await db.from('contributor_family_lines').insert(rows);
  if (error) {
    console.error('cfl insert failed for', contributorId, error);
    process.exit(3);
  }
}

async function main() {
  // Sanity-check: rank column exists. Selecting it would 400 otherwise.
  const { error: schemaCheck } = await db
    .from('contributor_family_lines')
    .select('rank')
    .limit(1);
  if (schemaCheck) {
    console.error(
      '✗ rank column not present — apply supabase/migrations/0008_family_line_rank.sql first.',
    );
    console.error('  Original error:', schemaCheck.message);
    process.exit(10);
  }

  const { data: lines } = await db.from('family_lines').select('id, slug');
  const idBySlug = new Map((lines ?? []).map((f) => [f.slug, f.id]));
  const rankFn = (slug) => idBySlug.get(slug);

  for (const lin of LINEAGES) {
    const id = await ensureContributor(lin.name);
    await setLineage(id, { primary: lin.primary, secondary: lin.secondary ?? null }, rankFn);
    const lineage = `${lin.primary}${lin.secondary ? ' / ' + lin.secondary : ''}`;
    console.log(`✓ ${lin.name.padEnd(18)} → ${lineage}`);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
