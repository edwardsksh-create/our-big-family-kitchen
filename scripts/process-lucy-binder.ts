#!/usr/bin/env -S npx tsx --env-file=.env.local
// Bulk-import pipeline for Aunt Lucy's binder photo set.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/process-lucy-binder.ts [flags]
//
// Flags:
//   --dry-run       Parse + group + AI, but skip DB writes and storage uploads.
//   --limit=N       Process only the first N tentative groups (by capture time).
//   --resume        Skip photos already linked to a recipe (idempotent re-runs).
//
// Prerequisites:
//   - migration 0014_submissions_bulk_photos.sql applied (adds 'bulk_photos').
//   - migration 0013_drop_legacy_sections.sql applied (new 16 sections live).
//   - macOS `sips` available for resize (built-in on macOS).
//   - ANTHROPIC_API_KEY and Supabase service-role env vars in .env.local.

import { readdir, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { readPhotoMeta, groupByTimeWindow } from '../lib/photos/exif-grouping';
import {
  parseBinderGroup,
  VALID_BINDER_SECTION_SLUGS,
  type BinderRecipe,
} from '../lib/photos/binder-intake';
import { uploadPhoto } from '../lib/storage/photos';
import { slugify } from '../lib/utils';

const execFileP = promisify(execFile);

// ---- Pipeline configuration ------------------------------------------------

const BINDER_DIR     = path.resolve(process.cwd(), 'import-queue/lucy-binder');
const GROUP_WINDOW_MS = 15_000;
const RESIZE_LONG_EDGE = 1568;
const COLLECTION = 'bulk_lucy';
// Above this size we chunk the group before sending to vision. A single
// vision call producing ~10 recipes blows past the 16k output cap and the
// Anthropic SDK's non-streaming limit. 5-photo chunks keep us safe and
// most binder pages are 1-recipe-per-page anyway.
const MAX_PHOTOS_PER_CALL = 5;

// Sonnet 4.6 input $3 / 1M, output $15 / 1M.
const PRICE_INPUT_PER_1M  = 3;
const PRICE_OUTPUT_PER_1M = 15;

// ---- CLI ------------------------------------------------------------------

type Args = { dryRun: boolean; limit?: number; resume: boolean };
function parseArgs(argv: string[]): Args {
  const out: Args = { dryRun: false, resume: false };
  for (const a of argv.slice(2)) {
    if (a === '--dry-run')              out.dryRun = true;
    else if (a === '--resume')          out.resume = true;
    else if (a.startsWith('--limit='))  out.limit = parseInt(a.slice('--limit='.length), 10);
    else if (a === '--help' || a === '-h') {
      console.log('Usage: process-lucy-binder.ts [--dry-run] [--limit=N] [--resume]');
      process.exit(0);
    } else {
      console.error(`Unknown flag: ${a}`);
      process.exit(2);
    }
  }
  return out;
}

// ---- Helpers --------------------------------------------------------------

async function listBinderPhotos(): Promise<string[]> {
  const entries = await readdir(BINDER_DIR).catch(() => []);
  return entries
    .filter((f) => /\.jpe?g$/i.test(f))
    .map((f) => path.join(BINDER_DIR, f))
    .sort();
}

async function resizeForVision(srcPath: string, dstPath: string): Promise<void> {
  await execFileP('sips', ['-Z', String(RESIZE_LONG_EDGE), srcPath, '--out', dstPath]);
}

// Map a section_slug from the AI to a known slug, falling back to null
// (which becomes "uncategorized" in the queue).
function normalizeSectionSlug(s: string): string | null {
  return VALID_BINDER_SECTION_SLUGS.includes(s) ? s : null;
}

type AnyDb = SupabaseClient<any, 'public', any>;

async function ensureUniqueRecipeSlug(
  db: AnyDb,
  base: string,
): Promise<string> {
  const root = slugify(base) || 'recipe';
  let cand = root;
  let i = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data } = await db.from('recipes').select('id').eq('slug', cand).maybeSingle();
    if (!data) return cand;
    i += 1;
    cand = `${root}-${i}`;
  }
}

async function ensureTag(
  db: AnyDb,
  slug: string,
  name: string,
): Promise<string> {
  const { data: existing } = await db.from('tags').select('id').eq('slug', slug).maybeSingle();
  if (existing) return existing.id as string;
  const { data: created, error } = await db
    .from('tags')
    .insert({ slug, name })
    .select('id')
    .single();
  if (error || !created) throw new Error(`tag insert failed: ${error?.message}`);
  return created.id as string;
}

// ---- Main -----------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env. Run with --env-file=.env.local.');
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY.');

  const db: AnyDb = createClient<any, 'public', any>(url, key, { auth: { persistSession: false } });

  // Static fixtures ----------------------------------------------------------
  const { data: lucy } = await db.from('contributors').select('id').eq('email', 'stub+lucy-leusch@ourbigfamilykitchen.local').single();
  if (!lucy) throw new Error('Lucy Leusch contributor not found.');
  const lucyId = lucy.id as string;

  const { data: leusch } = await db.from('family_lines').select('id').eq('slug', 'leusch').single();
  if (!leusch) throw new Error('Leusch family line not found.');
  const leuschId = leusch.id as string;

  const { data: secRows } = await db.from('sections').select('id, slug');
  const sectionIdBySlug = new Map<string, string>((secRows ?? []).map((s) => [s.slug as string, s.id as string]));

  // Existing Lucy recipes — for dedup checks.
  const { data: existingLucy } = await db
    .from('recipes')
    .select('id, slug, title')
    .eq('contributor_id', lucyId);
  const existingByTitle = new Map<string, { id: string; slug: string; title: string }>();
  for (const r of existingLucy ?? []) {
    existingByTitle.set(((r.title as string) || '').trim().toLowerCase(), {
      id: r.id as string,
      slug: r.slug as string,
      title: r.title as string,
    });
  }

  // Already-processed photo basenames (--resume) ----------------------------
  const processed = new Set<string>();
  if (args.resume) {
    const { data: existingPhotos } = await db
      .from('photos')
      .select('storage_path')
      .like('storage_path', `sources/_${COLLECTION}/%`);
    for (const p of existingPhotos ?? []) {
      const m = String(p.storage_path).match(/_inbox|_bulk_lucy\/([^/]+)\/.+$/);
      void m;
    }
    // The storage_path doesn't include the original IMG_ filename — we tracked
    // origin in the submission's raw_payload instead. Pull origin filenames
    // from there.
    const { data: priorSubmissions } = await db
      .from('submissions')
      .select('raw_payload')
      .eq('source', 'bulk_photos');
    for (const s of priorSubmissions ?? []) {
      const pl = s.raw_payload as { source_photos?: string[] } | null;
      for (const fn of pl?.source_photos ?? []) processed.add(fn);
    }
    console.log(`  --resume: ${processed.size} photo(s) already processed in prior runs`);
  }

  // EXIF + grouping ----------------------------------------------------------
  const files = await listBinderPhotos();
  console.log(`Reading EXIF from ${files.length} photo(s)…`);
  const photoMetas = [];
  let noExif = 0;
  for (const f of files) {
    if (args.resume && processed.has(path.basename(f))) continue;
    const m = await readPhotoMeta(f);
    if (!m) { noExif++; console.warn(`  ! no EXIF: ${path.basename(f)}`); continue; }
    photoMetas.push(m);
  }
  if (noExif > 0) console.warn(`${noExif} photo(s) had no EXIF and will be skipped.`);

  let groups = groupByTimeWindow(photoMetas, GROUP_WINDOW_MS);
  if (args.limit && args.limit > 0) {
    console.log(`--limit=${args.limit}: processing only the first ${args.limit} group(s)`);
    groups = groups.slice(0, args.limit);
  }

  console.log(`\n${groups.length} tentative group(s)${args.dryRun ? ' (dry run)' : ''}.\n`);

  // Stats --------------------------------------------------------------------
  const stats = {
    photos:             files.length,
    photosProcessed:    photoMetas.length,
    groups:             groups.length,
    recipesQueued:      0,
    notRecipeSkips:     0,
    lowConfidence:      0,
    multiRecipe:        0,
    possibleDuplicates: 0,
    needsInstructions:  0,
    inputTokens:        0,
    outputTokens:       0,
    errors:             [] as string[],
  };

  const topByConfidence: { title: string; conf: 'low' | 'medium' | 'high' }[] = [];

  // Working dir for resized vision inputs -----------------------------------
  const workDir = await mkdir(path.join(os.tmpdir(), `lucy-binder-${Date.now()}`), { recursive: true });
  if (!workDir) throw new Error('Could not create tmp dir for resized photos.');

  // Helper to upload originals (no-op in dry-run) and insert photos rows.
  async function uploadAndAttach(
    recipeId: string,
    photoPaths: string[],
  ): Promise<{ uploaded: number }> {
    if (args.dryRun) return { uploaded: photoPaths.length };
    let order = 0;
    for (const p of photoPaths) {
      const bytes = await readFile(p);
      const stored = await uploadPhoto(bytes, 'image/jpeg', {
        kind: 'bulk',
        collection: COLLECTION,
        recipeId,
      });
      await db.from('photos').insert({
        recipe_id:    recipeId,
        contributor_id: lucyId,
        url:          stored.public_url,
        storage_path: stored.storage_path,
        photo_type:   'source',
        caption:      path.basename(p),
        sort_order:   order++,
      });
    }
    return { uploaded: photoPaths.length };
  }

  // Process groups -----------------------------------------------------------
  for (const group of groups) {
    const idx     = group.index;
    const photos  = group.photos;
    const tag     = `group #${idx} (${photos.length} photo${photos.length === 1 ? '' : 's'})`;
    const names   = photos.map((p) => path.basename(p.path)).join(', ');

    process.stdout.write(`▸ ${tag}  ${names}\n  resizing…\r`);

    // Resize each photo with sips.
    const resizedPaths: string[] = [];
    for (const p of photos) {
      const dst = path.join(workDir, path.basename(p.path).replace(/\.jpe?g$/i, '.resized.jpg'));
      await resizeForVision(p.path, dst);
      resizedPaths.push(dst);
    }

    // Chunk the group if it's larger than the per-call cap. Each chunk
    // becomes its own AI call; the indices are translated back to the
    // parent group's photo array before the recipes get written.
    const chunkStarts: number[] = [];
    for (let i = 0; i < photos.length; i += MAX_PHOTOS_PER_CALL) chunkStarts.push(i);

    // Collected recipes across all chunks for this group, with photo
    // indices already normalized to the parent group's 1-based scheme.
    const collected: { rec: BinderRecipe; indices: number[] }[] = [];

    for (const start of chunkStarts) {
      const end       = Math.min(start + MAX_PHOTOS_PER_CALL, photos.length);
      const subPhotos = photos.slice(start, end);
      const subResized = resizedPaths.slice(start, end);
      const subTag = chunkStarts.length > 1
        ? `${tag} chunk ${chunkStarts.indexOf(start) + 1}/${chunkStarts.length} (${subPhotos.length} photos)`
        : tag;

      const visionInput = await Promise.all(subResized.map(async (p) => ({
        base64:    (await readFile(p)).toString('base64'),
        mediaType: 'image/jpeg',
      })));

      process.stdout.write(`  ${subTag} → asking Claude…${' '.repeat(20)}\r`);
      const t0 = Date.now();
      let parsed;
      try {
        parsed = await parseBinderGroup({ photos: visionInput });
      } catch (e) {
        const msg = `${subTag}: AI call failed: ${(e as Error).message}`;
        console.error(`\n  ! ${msg}`);
        stats.errors.push(msg);
        continue;
      }
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      stats.inputTokens  += parsed.usage.input_tokens;
      stats.outputTokens += parsed.usage.output_tokens;
      process.stdout.write(
        `▸ ${subTag} → ${parsed.recipes.length} recipe(s) in ${elapsed}s ` +
        `(in:${parsed.usage.input_tokens} out:${parsed.usage.output_tokens})\n`,
      );

      for (const rec of parsed.recipes) {
        // Translate sub-photo indices (1-based, within the chunk) to
        // parent-group indices (1-based, within the full group).
        const localIndices = rec.source_photo_indices && rec.source_photo_indices.length > 0
          ? rec.source_photo_indices.filter((n) => n >= 1 && n <= subPhotos.length)
          : subPhotos.map((_, i) => i + 1);
        const parentIndices = localIndices.map((n) => start + n);
        collected.push({ rec, indices: parentIndices });
      }
    }

    // Per-recipe handling --------------------------------------------------
    for (let r = 0; r < collected.length; r++) {
      const rec: BinderRecipe = collected[r].rec;
      const parentIndices: number[] = collected[r].indices;

      // is_not_a_recipe — skip, just log
      if (rec.is_not_a_recipe) {
        stats.notRecipeSkips++;
        console.log(`    ‒ not a recipe: ${rec.title || '(no title)'} — ${rec.not_a_recipe_reason ?? 'no reason given'}`);
        continue;
      }

      const title = (rec.title || '').trim() || 'Untitled (from Lucy binder)';
      const sectionSlug = normalizeSectionSlug(rec.suggested_section_slug);
      const sectionId   = sectionSlug ? sectionIdBySlug.get(sectionSlug) ?? null : null;

      // Dedup
      const dupHit = existingByTitle.get(title.toLowerCase().trim());
      const isDup  = !!dupHit;
      if (isDup) stats.possibleDuplicates++;
      if (rec.overall_confidence === 'low') stats.lowConfidence++;
      if (rec.is_multiple_recipes) stats.multiRecipe++;

      // Which input photos belong to this recipe (indices already
      // translated to the parent group's 1-based numbering).
      const photoIndices = parentIndices.length > 0
        ? parentIndices
        : photos.map((_, i) => i + 1);
      const recipePhotoPaths = photoIndices.map((n) => photos[n - 1].path);

      // Tags
      const tagSlugs: { slug: string; name: string }[] = [
        { slug: 'bulk-import', name: 'bulk import' },
        { slug: 'bulk-lucy',   name: 'bulk: Lucy binder' },
      ];
      const noInstructions = rec.instructions.length === 0;
      if (noInstructions) {
        tagSlugs.push({ slug: 'needs-instructions', name: 'needs instructions' });
        stats.needsInstructions++;
      }
      if (rec.overall_confidence === 'low') {
        tagSlugs.push({ slug: 'low-confidence', name: 'low confidence' });
      }
      if (rec.is_multiple_recipes) {
        tagSlugs.push({ slug: 'multi-recipe', name: 'multi-recipe' });
      }
      if (isDup) {
        tagSlugs.push({ slug: 'possible-duplicate', name: 'possible duplicate' });
      }

      // Notes_to_reviewer composition
      const noteParts: string[] = [];
      if (rec.notes_to_reviewer)    noteParts.push(rec.notes_to_reviewer);
      if (rec.is_multiple_recipes && rec.needs_split_notes) noteParts.push(`Split: ${rec.needs_split_notes}`);
      if (isDup) noteParts.push(`Possible duplicate of existing recipe '/recipes/${dupHit!.slug}'. Review and decide whether to merge or skip.`);
      if (!sectionSlug) noteParts.push(`AI's suggested section "${rec.suggested_section_slug}" was not one of the 16 known slugs — section_id left null.`);
      const notesToReviewer = noteParts.length > 0 ? noteParts.join('  ·  ') : null;

      // Track top-confidence picks
      topByConfidence.push({ title, conf: rec.overall_confidence });

      // Dry run — just log
      if (args.dryRun) {
        const flags = [
          rec.overall_confidence === 'low' ? '⚠ low-conf' : '',
          rec.is_multiple_recipes ? '⚠ multi' : '',
          isDup ? '⚠ dup' : '',
          noInstructions ? '⚠ no-instr' : '',
        ].filter(Boolean).join(' ');
        console.log(
          `    + [${rec.overall_confidence}] ${title}  (section: ${sectionSlug ?? '?'})  photos:${photoIndices.join(',')}  ${flags}`,
        );
        if (notesToReviewer) console.log(`      note: ${notesToReviewer}`);
        stats.recipesQueued++;
        continue;
      }

      // ---- Real insert path ----
      try {
        const slug = await ensureUniqueRecipeSlug(db, title);

        const { data: recipeRow, error: recErr } = await db
          .from('recipes')
          .insert({
            title,
            slug,
            contributor_id:         lucyId,
            originally_from:        rec.originally_from?.trim() || null,
            primary_family_line_id: leuschId,
            section_id:             sectionId,
            story:                  rec.story?.trim() || null,
            status:                 'pending_review',
            published_at:           null,
            kitchen_notes:          rec.kitchen_notes,
          })
          .select('id')
          .single();
        if (recErr || !recipeRow) throw new Error(`recipe insert failed: ${recErr?.message}`);
        const recipeId = recipeRow.id as string;

        // Ingredients
        const ingRows: { recipe_id: string; sub_header: string | null; item_text: string; sort_order: number }[] = [];
        let order = 0;
        for (const grp of rec.ingredients) {
          const sub = (grp.sub_header ?? '').trim() || null;
          let first = true;
          for (const item of grp.items) {
            const text = (item ?? '').trim();
            if (!text) continue;
            ingRows.push({
              recipe_id: recipeId,
              sub_header: first ? sub : null,
              item_text: text,
              sort_order: order++,
            });
            first = false;
          }
        }
        if (ingRows.length > 0) await db.from('ingredients').insert(ingRows);

        // Instructions
        const insRows: { recipe_id: string; sub_header: string | null; body: string; sort_order: number }[] = [];
        let sOrder = 0;
        for (const grp of rec.instructions) {
          const sub = (grp.sub_header ?? '').trim() || null;
          let first = true;
          for (const step of grp.steps) {
            const body = (step ?? '').trim();
            if (!body) continue;
            insRows.push({
              recipe_id: recipeId,
              sub_header: first ? sub : null,
              body,
              sort_order: sOrder++,
            });
            first = false;
          }
        }
        if (insRows.length > 0) await db.from('instructions').insert(insRows);

        // Tags
        for (const t of tagSlugs) {
          const tagId = await ensureTag(db, t.slug, t.name);
          await db.from('recipe_tags').insert({ recipe_id: recipeId, tag_id: tagId });
        }

        // Upload originals + photos rows
        await uploadAndAttach(recipeId, recipePhotoPaths);

        // Submission row
        await db.from('submissions').insert({
          source: 'bulk_photos',
          raw_payload: {
            collection: COLLECTION,
            group_index: idx,
            source_photos: recipePhotoPaths.map((p) => path.basename(p)),
            parsed: rec,
            sibling_recipes: collected.length,
            ai_section_slug: rec.suggested_section_slug,
            section_confidence: rec.suggested_section_confidence,
            title_confidence: rec.title_confidence,
            overall_confidence: rec.overall_confidence,
            is_multiple_recipes: rec.is_multiple_recipes,
            has_handwriting: rec.has_handwriting,
            notes_to_reviewer: notesToReviewer,
            possible_duplicate_of: dupHit ? { slug: dupHit.slug, title: dupHit.title } : null,
          },
          contributor_id:         lucyId,
          status:                 'queued',
          recipe_id_if_published: recipeId,
        });

        stats.recipesQueued++;
        const flags = [
          rec.overall_confidence === 'low' ? 'low-conf' : '',
          rec.is_multiple_recipes ? 'multi' : '',
          isDup ? 'dup' : '',
          noInstructions ? 'no-instr' : '',
          !sectionSlug ? 'no-section' : '',
        ].filter(Boolean).join(' ');
        console.log(`    + ${title}  →  /recipes/${slug}  [${rec.overall_confidence}] ${flags}`);
      } catch (e) {
        const msg = `${tag} recipe "${title}": ${(e as Error).message}`;
        console.error(`    ! ${msg}`);
        stats.errors.push(msg);
      }
    }
  }

  // Cleanup tmp resize dir
  await rm(workDir, { recursive: true, force: true }).catch(() => undefined);

  // ---- Report ----
  const costUsd =
    (stats.inputTokens  / 1_000_000) * PRICE_INPUT_PER_1M +
    (stats.outputTokens / 1_000_000) * PRICE_OUTPUT_PER_1M;

  topByConfidence.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 } as const;
    return order[a.conf] - order[b.conf];
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Photos in directory:     ${stats.photos}`);
  console.log(`Photos processed:        ${stats.photosProcessed}`);
  console.log(`Tentative groups:        ${stats.groups}`);
  console.log(`Recipes queued:          ${stats.recipesQueued}`);
  console.log(`Not-a-recipe skips:      ${stats.notRecipeSkips}`);
  console.log(`Possible duplicates:     ${stats.possibleDuplicates}`);
  console.log(`Low confidence:          ${stats.lowConfidence}`);
  console.log(`Multi-recipe groups:     ${stats.multiRecipe}`);
  console.log(`Needs instructions:      ${stats.needsInstructions}`);
  console.log(`Tokens:                  in=${stats.inputTokens} out=${stats.outputTokens}`);
  console.log(`Est cost:                $${costUsd.toFixed(2)}`);
  if (stats.errors.length > 0) {
    console.log(`Errors (${stats.errors.length}):`);
    for (const e of stats.errors) console.log(`  ! ${e}`);
  }
  if (topByConfidence.length > 0) {
    console.log('\nTop 3 high-confidence recipes:');
    for (const r of topByConfidence.filter((x) => x.conf === 'high').slice(0, 3)) {
      console.log(`  ${r.conf}  ${r.title}`);
    }
  }
  console.log(args.dryRun ? '(dry run — no DB writes)' : 'Done.');

  // Stash report for the user.
  await writeFile('scripts/_lucy-binder-report.json', JSON.stringify({ stats, topByConfidence }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

void crypto; // keep node:crypto import live for ts strict-mode build paths
