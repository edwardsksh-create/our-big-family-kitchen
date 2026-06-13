#!/usr/bin/env node
// Make a freshly-migrated clone database match THIS deployment's config —
// the step the migrations get wrong for a clone (see docs/clone-runbook.md
// §3). Run AFTER `supabase db push` on a new project.
//
// What it does (idempotent):
//   1. Reseeds `family_lines` from lib/family-lines.ts — upserts every
//      configured line and removes any leftover lines not in the config
//      (e.g. Kate's seeded Leusch/Quinn/… on a clone that edited the file).
//   2. Sets the admin: ensures ADMIN_EMAIL exists as role='admin', and
//      demotes/removes the hard-coded Kate seed row from 0005 if it isn't
//      this clone's admin.
//
// SAFETY: refuses to run if the DB already has recipes (i.e. it's not a
// fresh clone) unless --force is passed — this clears family-line rows and
// you don't want that against a populated archive by accident.
//
// Run with:
//   node --env-file=.env.local scripts/provision-clone-db.mjs [--force]
//
// Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL
// from the environment (the clone's .env.local).

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const force = process.argv.includes('--force');
const url   = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

if (!url || !key) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.'); process.exit(2); }
if (!admin)       { console.error('Missing ADMIN_EMAIL — the clone needs its own admin.');          process.exit(2); }

// Import the clone's family lines straight from the TS source (Node strips
// the types). This keeps lib/family-lines.ts the single source of truth.
const libPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../lib/family-lines.ts');
const { FAMILY_LINES } = await import(libPath);

const db = createClient(url, key, { auth: { persistSession: false } });

// Fresh-clone guard.
const { count: recipeCount } = await db.from('recipes').select('id', { count: 'exact', head: true });
if ((recipeCount ?? 0) > 0 && !force) {
  console.error(`Refusing: this DB already has ${recipeCount} recipe(s) — not a fresh clone. Re-run with --force if you really mean to reseed family lines.`);
  process.exit(1);
}

// 1) Reseed family_lines from config.
const desired = FAMILY_LINES.map((l, i) => ({
  slug: l.slug, name: l.name, family_type: l.type, sort_order: i + 1,
}));
const desiredSlugs = new Set(desired.map((d) => d.slug));

const { error: upErr } = await db.from('family_lines').upsert(desired, { onConflict: 'slug' });
if (upErr) { console.error('family_lines upsert failed:', upErr.message); process.exit(1); }

const { data: existing, error: listErr } = await db.from('family_lines').select('id, slug');
if (listErr) { console.error('family_lines read failed:', listErr.message); process.exit(1); }
const stale = (existing ?? []).filter((r) => !desiredSlugs.has(r.slug));
for (const row of stale) {
  const { error } = await db.from('family_lines').delete().eq('id', row.id);
  if (error) { console.error(`failed to remove stale line ${row.slug}:`, error.message); process.exit(1); }
}
console.log(`family_lines: ${desired.length} configured upserted, ${stale.length} stale removed (${stale.map((s) => s.slug).join(', ') || 'none'}).`);

// 2) Admin: ensure ADMIN_EMAIL is admin; clear any other seeded admin.
const { data: admins } = await db.from('contributors').select('id, email, role').eq('role', 'admin');
for (const a of admins ?? []) {
  if (a.email.toLowerCase() !== admin) {
    // Demote a leftover seed admin (e.g. Kate's 0005 row) rather than delete —
    // deleting could cascade-restrict on authored content; demotion is safe.
    await db.from('contributors').update({ role: 'contributor' }).eq('id', a.id);
    console.log(`demoted leftover admin ${a.email} → contributor.`);
  }
}
const { data: me } = await db.from('contributors').select('id').ilike('email', admin).maybeSingle();
if (me) {
  await db.from('contributors').update({ role: 'admin' }).eq('id', me.id);
  console.log(`admin ${admin}: ensured role=admin.`);
} else {
  await db.from('contributors').insert({ email: admin, name: null, role: 'admin', joined_at: new Date().toISOString() });
  console.log(`admin ${admin}: created.`);
}

console.log('\nClone DB provisioned. Next: set the next_auth exposed schema (runbook §5) and smoke-test sign-in.');
