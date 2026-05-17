#!/usr/bin/env node
// One-off data correction:
// - Link Kate to the Leusch family line (she's the project owner / cross-line).
// - Create Annie Sundy as a stub contributor linked to Leusch.
// - Reattribute "Oriental Cole Slaw" to Annie.
// - Publish "Kate's Rosemary Cashews" and "Oriental Cole Slaw" (both pending).
//
// Idempotent: re-running won't duplicate links or stubs.
//
// Run with:
//   node --env-file=.env.local scripts/data-fix-annie-cole-slaw.mjs

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing Supabase env.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  // 1) Look up IDs we need.
  const [{ data: leusch }, { data: kate }, { data: cashews }, { data: coleSlaw }] =
    await Promise.all([
      db.from('family_lines').select('id').eq('slug', 'leusch').single(),
      db.from('contributors').select('id, name').eq('email', 'edwards.ksh@gmail.com').single(),
      db.from('recipes').select('id, status').eq('slug', 'kates-rosemary-cashews').single(),
      db.from('recipes').select('id, status').eq('slug', 'oriental-cole-slaw').single(),
    ]);
  console.log('Leusch FL:', leusch?.id);
  console.log('Kate:', kate?.id);
  console.log('Cashews:', cashews?.id, cashews?.status);
  console.log('Cole slaw:', coleSlaw?.id, coleSlaw?.status);

  // 2) Link Kate to Leusch (idempotent — composite PK).
  await db.from('contributor_family_lines').upsert(
    { contributor_id: kate.id, family_line_id: leusch.id },
    { onConflict: 'contributor_id,family_line_id' },
  );
  console.log('✓ Kate linked to Leusch');

  // 3) Annie Sundy stub. If she already exists with this name, reuse.
  const { data: existingAnnie } = await db
    .from('contributors')
    .select('id, email')
    .eq('name', 'Annie Sundy')
    .maybeSingle();
  let annieId = existingAnnie?.id;
  if (!annieId) {
    const stubEmail = `stub+annie-sundy-${Date.now()}@ourbigfamilykitchen.local`;
    const { data: created, error } = await db
      .from('contributors')
      .insert({
        name:          'Annie Sundy',
        email:         stubEmail,
        role:          'viewer',
        joined_at:     null,
        invited_at:    null,
        invited_by_id: kate.id,
      })
      .select('id')
      .single();
    if (error) {
      console.error('Failed to create Annie:', error);
      process.exit(2);
    }
    annieId = created.id;
    console.log('✓ Annie created:', annieId);
  } else {
    console.log('  Annie already exists:', annieId);
  }

  // 4) Link Annie to Leusch.
  await db.from('contributor_family_lines').upsert(
    { contributor_id: annieId, family_line_id: leusch.id },
    { onConflict: 'contributor_id,family_line_id' },
  );
  console.log('✓ Annie linked to Leusch');

  // 5) Reattribute cole slaw + set primary_family_line to Leusch.
  if (coleSlaw?.id) {
    const { error } = await db
      .from('recipes')
      .update({
        contributor_id:         annieId,
        primary_family_line_id: leusch.id,
        status:                 'published',
        published_at:           new Date().toISOString(),
      })
      .eq('id', coleSlaw.id);
    if (error) {
      console.error('Cole slaw update failed:', error);
      process.exit(3);
    }
    console.log('✓ Cole slaw reattributed to Annie, set to Leusch, published');
  }

  // 6) Publish Kate's Rosemary Cashews.
  if (cashews?.id) {
    const { error } = await db
      .from('recipes')
      .update({
        status:       'published',
        published_at: new Date().toISOString(),
      })
      .eq('id', cashews.id);
    if (error) {
      console.error('Cashews update failed:', error);
      process.exit(4);
    }
    console.log('✓ Cashews published');
  }

  // 7) Close out any open submissions for these recipes.
  for (const id of [coleSlaw?.id, cashews?.id].filter(Boolean)) {
    await db
      .from('submissions')
      .update({
        status:         'approved',
        reviewed_by_id: kate.id,
        reviewed_at:    new Date().toISOString(),
      })
      .eq('recipe_id_if_published', id)
      .eq('status', 'queued');
  }
  console.log('✓ Submissions closed out');

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
