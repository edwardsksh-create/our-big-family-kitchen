import { NextResponse } from 'next/server';
import { z } from 'zod';
import { actorFromRequest } from '@/lib/auth/supabase-token';
import { supabaseAdmin } from '@/lib/supabase/server';
import { saveRecipe } from '@/lib/recipes/save';
import { newRowId, type RecipeDraft, type PhotoEntry } from '@/lib/recipes/draft';

export const maxDuration = 30;
export const dynamic     = 'force-dynamic';

// POST /api/v1/recipes — draft-save for native (create + edit).
//
// Closes the scan loop: the app posts the reviewed/edited draft (the parse shape
// from /api/v1/photos/parse, plus the uploaded recipe-photos URLs). We map it to
// the web's RecipeDraft and call the SAME saveRecipe() path — so child-table
// sync, slug generation, the review/publish queue, and admin notifications are
// identical to web. The authoritative resolution (section, family line, tag
// slugify/create, photo ordering) all happens server-side.

const Group = z.object({ sub_header: z.string().nullable().optional(), items: z.array(z.string()).optional(), steps: z.array(z.string()).optional() });
const Body = z.object({
  id:              z.string().uuid().nullable().optional(),
  title:           z.string(),
  section_slug:    z.string(),
  status:          z.enum(['draft', 'pending_review']),
  originally_from: z.string().nullable().optional(),
  external_source: z.object({
    author:  z.string().nullable().optional(),
    source:  z.string().nullable().optional(),
    is_book: z.boolean().optional(),
  }).nullable().optional(),
  story:           z.string().nullable().optional(),
  ingredients:     z.array(Group).default([]),
  instructions:    z.array(Group).default([]),
  kitchen_notes:   z.array(z.string()).default([]),
  tags:            z.array(z.string()).default([]),
  photos:          z.array(z.object({
    url:        z.string().url(),
    photo_type: z.enum(['source', 'dish']),
    sort_order: z.number().int().optional(),
  })).default([]),
});

/** external_source has no dedicated column — fold it into originally_from. */
function composeOriginallyFrom(b: z.infer<typeof Body>): string {
  const explicit = b.originally_from?.trim();
  if (explicit) return explicit;
  const ext = b.external_source;
  if (!ext) return '';
  const parts = [ext.author?.trim(), ext.source?.trim()].filter(Boolean);
  if (parts.length === 0) return '';
  return ext.is_book ? `${parts.join(' — ')} (book)` : parts.join(' — ');
}

export async function POST(req: Request) {
  const actor = await actorFromRequest(req);
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'bad_body' }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Resolve the contributor (for family-line default) — saveRecipe re-resolves
  // from the same email, so they always agree.
  const { data: contributor } = await db
    .from('contributors')
    .select('id, role')
    .ilike('email', actor.email)
    .maybeSingle();
  if (!contributor) return NextResponse.json({ error: 'not_a_contributor' }, { status: 403 });

  // Ownership guard for updates. saveRecipe only enforces ownership on the
  // 'edit' action; we map to 'draft'/'submit_for_review', so we must check here
  // that the caller owns the recipe (or is admin) before touching it by id —
  // otherwise a passed id could overwrite someone else's recipe.
  if (parsed.id) {
    const { data: existing } = await db
      .from('recipes')
      .select('contributor_id')
      .eq('id', parsed.id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: 'recipe_not_found' }, { status: 404 });
    if (existing.contributor_id !== contributor.id && contributor.role !== 'admin') {
      return NextResponse.json({ error: 'not_recipe_owner' }, { status: 403 });
    }
  }

  // section_slug → section_id.
  const { data: section } = await db
    .from('sections')
    .select('id')
    .eq('slug', parsed.section_slug)
    .maybeSingle();
  if (!section) return NextResponse.json({ error: 'unknown_section', section_slug: parsed.section_slug }, { status: 400 });

  // primary_family_line_id: the contributor's rank='primary' line; fall back to
  // any line they belong to. NOT NULL in the schema, and mobile doesn't send it.
  const { data: cfls } = await db
    .from('contributor_family_lines')
    .select('family_line_id, rank')
    .eq('contributor_id', contributor.id);
  const primaryLine =
    (cfls ?? []).find((r) => r.rank === 'primary')?.family_line_id ??
    (cfls ?? [])[0]?.family_line_id ?? null;
  if (!primaryLine) {
    return NextResponse.json({ error: 'no_family_line_for_contributor' }, { status: 409 });
  }

  // Map photo URLs → PhotoEntry (derive storage_path from the public URL).
  const publicPrefix =
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/recipe-photos/`;
  const orderedPhotos = [...parsed.photos].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const photoEntries: PhotoEntry[] = [];
  for (const p of orderedPhotos) {
    if (!p.url.startsWith(publicPrefix)) {
      return NextResponse.json({ error: 'bad_photo_url', url: p.url }, { status: 400 });
    }
    photoEntries.push({
      storage_path: p.url.slice(publicPrefix.length),
      public_url:   p.url,
      thumb_path:   null,
      photo_type:   p.photo_type,
    });
  }

  // Flatten parse-shaped groups → the draft's flat rows (mirrors draftFromPhotoParse).
  const ingredients = [];
  for (const g of parsed.ingredients) {
    const items = g.items ?? [];
    for (let i = 0; i < items.length; i++) {
      ingredients.push({ id: newRowId(), sub_header: i === 0 ? (g.sub_header ?? '') : '', item_text: items[i] });
    }
  }
  const instructions = [];
  let lastSub: string | null = null;
  for (const g of parsed.instructions) {
    for (const step of g.steps ?? []) {
      const sub = g.sub_header ?? null;
      instructions.push({ id: newRowId(), sub_header: sub && sub !== lastSub ? sub : '', body: step });
      lastSub = sub;
    }
  }

  const draft: RecipeDraft = {
    id:                     parsed.id ?? undefined,
    title:                  parsed.title,
    contributor_id:         contributor.id,
    primary_family_line_id: primaryLine,
    section_id:             section.id,
    originally_from:        composeOriginallyFrom(parsed),
    story:                  parsed.story?.trim() || '',
    ingredients,
    instructions,
    tags:                   parsed.tags,
    occasion_slugs:         [],
    kitchen_notes:          parsed.kitchen_notes,
    source_photos:          photoEntries.filter((p) => p.photo_type === 'source'),
    dish_photos:            photoEntries.filter((p) => p.photo_type === 'dish'),
  };

  // Map status → the shared save action. submit_for_review enters the same
  // review queue as web (and auto-publishes for trusted contributors, exactly
  // as web does — saveRecipe re-reads can_publish from the DB).
  const action = parsed.status === 'pending_review' ? 'submit_for_review' : 'draft';

  const result = await saveRecipe(draft, action, { actorEmail: actor.email });
  if (!result.ok) {
    const status = result.error === 'not_a_contributor' ? 403
      : result.error === 'not_recipe_owner' || result.error === 'admin_only' ? 403
      : result.error === 'sync_failed' || result.error.startsWith('db_') ? 502
      : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ id: result.recipeId, slug: result.slug, status: result.status });
}
