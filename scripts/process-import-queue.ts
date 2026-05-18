#!/usr/bin/env -S npx tsx
// BFK bulk PDF ingestion pipeline.
//
// Usage:
//   npx tsx scripts/process-import-queue.ts            # process every BFK_*.pdf
//   npx tsx scripts/process-import-queue.ts --dry-run  # parse only, no DB writes
//   npx tsx scripts/process-import-queue.ts --file=BFK_BrazilianSalsa.pdf
//
// Prerequisites:
//   - migration 0009_submissions_bulk_pdf.sql applied (adds 'bulk_pdf' source)
//   - poppler installed (`brew install poppler`) for pdftoppm
//   - ANTHROPIC_API_KEY and Supabase service-role env vars set in .env.local
//
// Reads ENV from .env.local automatically when run via `npx tsx --env-file ...`
// or with `--env-file=.env.local` (Node 20+).

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { renderPdfPagesToPng } from '../lib/pdf/render';
import { parseRecipesFromImages } from '../lib/recipe-from-images';
import { BFK_RULES, ruleFor, type BfkFileRule } from '../lib/bfk/config';
import { writeRecipe, type WriterContext } from '../lib/bfk/writer';

const IMPORT_DIR = path.resolve(process.cwd(), 'import-queue');

// Sonnet 4.6 pricing — input $3 / 1M, output $15 / 1M.
const PRICE_INPUT_PER_1M  = 3;
const PRICE_OUTPUT_PER_1M = 15;

type Args = { dryRun: boolean; file?: string };

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false };
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--file=')) args.file = a.slice('--file='.length);
    else if (a === '--help' || a === '-h') {
      console.log('Usage: npx tsx scripts/process-import-queue.ts [--dry-run] [--file=NAME.pdf]');
      process.exit(0);
    } else {
      console.error(`Unknown flag: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

async function listBfkPdfs(): Promise<string[]> {
  const entries = await readdir(IMPORT_DIR).catch(() => []);
  return entries
    .filter((f) => /^BFK_.+\.pdf$/i.test(f))
    .sort();
}

async function main() {
  const args = parseArgs(process.argv);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing Supabase env. Run with --env-file=.env.local.');
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Missing ANTHROPIC_API_KEY. Run with --env-file=.env.local.');
    process.exit(1);
  }

  // Resolve metadata for matching by contributor name + section slug → id.
  const db = createClient(url, key, { auth: { persistSession: false } });
  const [contribRes, flRes, secRes, cflRes] = await Promise.all([
    db.from('contributors').select('id, name'),
    db.from('family_lines').select('id, slug, name'),
    db.from('sections').select('id, slug'),
    db.from('contributor_family_lines').select('contributor_id, family_line_id, rank'),
  ]);
  const contribByName = new Map<string, string>(
    (contribRes.data ?? []).map((c) => [c.name, c.id]),
  );
  const sectionIdBySlug = new Map<string, string>(
    (secRes.data ?? []).map((s) => [s.slug, s.id]),
  );
  const primaryByContributor = new Map<string, string>();
  for (const link of cflRes.data ?? []) {
    if (link.rank === 'primary') primaryByContributor.set(link.contributor_id, link.family_line_id);
  }

  let files = await listBfkPdfs();
  if (args.file) {
    if (!files.includes(args.file)) {
      console.error(`File not found in ${IMPORT_DIR}: ${args.file}`);
      process.exit(2);
    }
    files = [args.file];
  }
  if (files.length === 0) {
    console.log(`No BFK_*.pdf files in ${IMPORT_DIR}.`);
    return;
  }

  console.log(`Processing ${files.length} file(s) from ${IMPORT_DIR}${args.dryRun ? ' (dry run)' : ''}.\n`);

  let totalInputTokens  = 0;
  let totalOutputTokens = 0;
  let totalRecipes = 0;
  const fileSummaries: { file: string; recipes: number; warnings: string[]; usd: number }[] = [];

  for (const filename of files) {
    const rule: BfkFileRule | null = ruleFor(filename);
    if (!rule) {
      console.warn(`! Skipping ${filename} — no config rule.`);
      continue;
    }
    console.log(`▸ ${filename}  (${rule.label})`);

    const contributorId = contribByName.get(rule.contributorName);
    if (!contributorId) {
      console.warn(`  ! Contributor "${rule.contributorName}" not in DB. Skipping.`);
      continue;
    }
    const primaryFamilyLineId = primaryByContributor.get(contributorId);
    if (!primaryFamilyLineId) {
      console.warn(`  ! Contributor "${rule.contributorName}" has no primary family line. Skipping.`);
      continue;
    }

    const pdfPath = path.join(IMPORT_DIR, filename);
    process.stdout.write(`  rendering pages…\r`);
    const pages = await renderPdfPagesToPng(pdfPath);
    process.stdout.write(`  rendered ${pages.length} page(s).${' '.repeat(20)}\n`);

    process.stdout.write(`  asking Claude…\r`);
    const t0 = Date.now();
    const { recipes, usage } = await parseRecipesFromImages({
      pages,
      extraction: rule.extraction,
    });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    process.stdout.write(`  parsed ${recipes.length} recipe(s) in ${elapsed}s.${' '.repeat(20)}\n`);

    const usdInput  = (usage.input_tokens  / 1_000_000) * PRICE_INPUT_PER_1M;
    const usdOutput = (usage.output_tokens / 1_000_000) * PRICE_OUTPUT_PER_1M;
    const usd = usdInput + usdOutput;
    totalInputTokens  += usage.input_tokens;
    totalOutputTokens += usage.output_tokens;
    totalRecipes += recipes.length;

    const ctx: WriterContext = {
      filename,
      rule,
      contributorId,
      primaryFamilyLineId,
      sectionIdBySlug,
    };

    const warnings: string[] = [];
    for (const recipe of recipes) {
      if (args.dryRun) {
        console.log(`    [dry] ${recipe.title}  (section: ${recipe.section_slug ?? '-'})`);
        continue;
      }
      try {
        const outcome = await writeRecipe(ctx, recipe);
        const flags = [
          outcome.sectionSlug ? '' : '⚠ no section',
          rule.needsInstructions ? '⚠ needs instructions' : '',
          recipe.instruction_steps.length === 0 && !rule.needsInstructions ? '⚠ no steps' : '',
        ].filter(Boolean).join(' ');
        console.log(`    + ${outcome.title}  ${flags}`);
        warnings.push(...outcome.warnings);
      } catch (err) {
        console.error(`    ! Insert failed for "${recipe.title}":`, (err as Error).message);
      }
    }

    console.log(`  $${usd.toFixed(4)}  (${usage.input_tokens} in / ${usage.output_tokens} out)\n`);
    fileSummaries.push({ file: filename, recipes: recipes.length, warnings, usd });
  }

  const totalUsd =
    (totalInputTokens  / 1_000_000) * PRICE_INPUT_PER_1M +
    (totalOutputTokens / 1_000_000) * PRICE_OUTPUT_PER_1M;
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  for (const s of fileSummaries) {
    console.log(`  ${s.file.padEnd(40)}  ${s.recipes} recipe(s)  $${s.usd.toFixed(4)}`);
    for (const w of s.warnings) console.log(`    ⚠ ${w}`);
  }
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Total: ${totalRecipes} recipe(s), $${totalUsd.toFixed(4)} (${totalInputTokens} in / ${totalOutputTokens} out)`);
  if (args.dryRun) console.log('(dry run — no DB writes)');
}

// Reference BFK_RULES so an unused-import warning doesn't fire.
void BFK_RULES;

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
