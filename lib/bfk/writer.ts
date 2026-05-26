import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { slugify } from '@/lib/utils';
import type { ParsedRecipeVision } from '@/lib/recipe-from-images';
import type { BfkFileRule } from '@/lib/bfk/config';

type DB = SupabaseClient<any, 'public', any>;

let _db: DB | undefined;
function db(): DB {
  if (_db) return _db;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env.');
  _db = createClient<any, 'public', any>(url, key, {
    auth: { persistSession: false },
    db:   { schema: 'public' },
  });
  return _db;
}

async function ensureUniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || 'recipe';
  let candidate = root;
  let suffix = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data } = await db().from('recipes').select('id').eq('slug', candidate).maybeSingle();
    if (!data) return candidate;
    suffix += 1;
    candidate = `${root}-${suffix}`;
  }
}

async function ensureTag(slug: string, name: string): Promise<string> {
  const { data: existing } = await db().from('tags').select('id').eq('slug', slug).maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await db().from('tags').insert({ slug, name }).select('id').single();
  if (error || !created) throw new Error(`tag insert failed: ${error?.message}`);
  return created.id;
}

export type WriterContext = {
  filename:     string;
  rule:         BfkFileRule;
  contributorId:        string;
  primaryFamilyLineId:  string;
  sectionIdBySlug:      Map<string, string>;
};

export type WriteOutcome = {
  recipeId:    string;
  title:       string;
  slug:        string;
  sectionSlug: string | null;
  warnings:    string[];
};

export async function writeRecipe(
  ctx: WriterContext,
  parsed: ParsedRecipeVision,
): Promise<WriteOutcome> {
  const warnings: string[] = [];

  const title = (parsed.title || '').trim() || 'Untitled recipe';
  const slug  = await ensureUniqueSlug(title);

  const sectionSlug = parsed.section_slug ?? ctx.rule.defaultSection ?? null;
  const sectionId   = sectionSlug ? ctx.sectionIdBySlug.get(sectionSlug) ?? null : null;
  if (!sectionId) {
    warnings.push(`No section slug for "${title}" — admin will need to set one`);
  }

  // Story precedence: rule override beats the parser's extraction.
  const story = ctx.rule.storyOverride ?? parsed.story?.trim() ?? null;
  const originallyFrom = ctx.rule.originallyFrom ?? parsed.originally_from?.trim() ?? null;

  // Insert the recipe row (status='pending_review' — admin must approve).
  const { data: inserted, error } = await db()
    .from('recipes')
    .insert({
      title,
      slug,
      contributor_id:         ctx.contributorId,
      originally_from:        originallyFrom,
      primary_family_line_id: ctx.primaryFamilyLineId,
      section_id:             sectionId,
      story,
      status:                 'pending_review',
      published_at:           null,
    })
    .select('id')
    .single();
  if (error || !inserted) {
    throw new Error(`recipe insert failed for "${title}": ${error?.message}`);
  }
  const recipeId = inserted.id;

  // Ingredients
  if (parsed.ingredient_groups.length > 0) {
    const ingRows: { recipe_id: string; sub_header: string | null; item_text: string; sort_order: number }[] = [];
    let order = 0;
    for (const group of parsed.ingredient_groups) {
      const subHeader = (group.sub_header ?? '').trim() || null;
      let first = true;
      for (const item of group.items) {
        const text = (item ?? '').trim();
        if (!text) continue;
        ingRows.push({
          recipe_id:  recipeId,
          sub_header: first ? subHeader : null,
          item_text:  text,
          sort_order: order++,
        });
        first = false;
      }
    }
    if (ingRows.length > 0) {
      await db().from('ingredients').insert(ingRows);
    }
  }

  // Instructions (may legitimately be empty for ingredient-only recipes).
  if (parsed.instruction_steps.length > 0) {
    const insRows = parsed.instruction_steps
      .filter((s) => s.body?.trim())
      .map((s, idx) => ({
        recipe_id:  recipeId,
        sub_header: s.sub_header?.trim() || null,
        body:       s.body.trim(),
        sort_order: idx,
      }));
    if (insRows.length > 0) {
      await db().from('instructions').insert(insRows);
    }
  } else if (!ctx.rule.needsInstructions) {
    warnings.push(`"${title}" has no instructions — admin should add them.`);
  }

  // Add 'needs-instructions' when the BFK file declares the recipe is
  // ingredient-only or the parser returned zero steps. We used to also tag
  // every BFK import with 'bulk-import', but Kate retired that tag — the
  // contributor + originally_from fields already carry the provenance.
  const tagSlugs: { slug: string; name: string }[] = [];
  const noSteps = parsed.instruction_steps.length === 0;
  if (ctx.rule.needsInstructions || noSteps) {
    tagSlugs.push({ slug: 'needs-instructions', name: 'needs instructions' });
  }
  for (const t of tagSlugs) {
    const tagId = await ensureTag(t.slug, t.name);
    await db().from('recipe_tags').insert({ recipe_id: recipeId, tag_id: tagId });
  }

  // Submission row — feeds the admin queue context (raw_payload preserved).
  // Requires migration 0009 (adds 'bulk_pdf' to the submissions.source check).
  await db().from('submissions').insert({
    source: 'bulk_pdf',
    raw_payload: {
      bulk_pdf:  ctx.filename,
      parsed,
      rule:      { contributor: ctx.rule.contributorName, defaultSection: ctx.rule.defaultSection ?? null },
    },
    contributor_id:         ctx.contributorId,
    status:                 'queued',
    recipe_id_if_published: recipeId,
  });

  return { recipeId, title, slug, sectionSlug, warnings };
}
