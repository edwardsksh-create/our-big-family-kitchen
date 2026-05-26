// Vision parser for the Lucy binder bulk-import pipeline.
//
// Sends a group of photos (taken in rapid succession from one binder) to
// Claude Sonnet 4.6 with structured output. The AI decides whether the
// photos represent one recipe spanning multiple pages or multiple distinct
// recipes that happened to be photographed back-to-back, and returns one
// recipe object per recipe identified.

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { SECTIONS } from '@/lib/sections';

const Confidence = z.enum(['high', 'medium', 'low']);

const IngredientGroup = z.object({
  sub_header: z.string().nullable(),
  items:      z.array(z.string()),
});

const InstructionGroup = z.object({
  sub_header: z.string().nullable(),
  steps:      z.array(z.string()),
});

const VALID_SECTION_SLUGS = SECTIONS.map((s) => s.slug);

export const BinderRecipeSchema = z.object({
  title:                          z.string(),
  title_confidence:               Confidence,

  // The model is forced to pick from the 16 slugs. If unsure it should pick
  // its best guess and lower suggested_section_confidence — the writer can
  // null it out by post-processing.
  suggested_section_slug:         z.string(),
  suggested_section_confidence:   Confidence,

  originally_from:                z.string().nullable(),
  story:                          z.string().nullable(),

  ingredients:                    z.array(IngredientGroup),
  instructions:                   z.array(InstructionGroup),

  kitchen_notes:                  z.array(z.string()).default([]),

  has_handwriting:                z.boolean(),
  overall_confidence:             Confidence,

  is_multiple_recipes:            z.boolean(),
  needs_split_notes:              z.string().nullable(),

  is_not_a_recipe:                z.boolean(),
  not_a_recipe_reason:            z.string().nullable(),

  notes_to_reviewer:              z.string().nullable(),

  // Which input photos (1-indexed) belong to this recipe. When the AI
  // splits a group into multiple recipes, this lets the writer attach the
  // right photos to each one.
  source_photo_indices:           z.array(z.number().int().positive()),
});

export const BinderGroupSchema = z.object({
  recipes: z.array(BinderRecipeSchema),
});

export type BinderRecipe = z.infer<typeof BinderRecipeSchema>;

const SYSTEM_PROMPT = `You are a recipe transcription assistant for a family cookbook. Aunt Lucy has photographed pages of her three-ring binder of curated favorite recipes (most typed by her, a few magazine clippings, a few handwritten cards).

The user will hand you a SINGLE GROUP of photos taken in rapid succession. The group MAY be:
- One single recipe spanning multiple pages (most likely if 1–3 photos)
- Multiple distinct recipes photographed back-to-back (more likely if 4+ photos — a single recipe spanning 4+ binder pages is unusual)

Examine the content and return one structured recipe object PER recipe identified. If a photo isn't a recipe at all (a section divider, an index page, the back cover, a photo of Lucy's cat), still return a recipe object for it but set is_not_a_recipe=true with not_a_recipe_reason explaining what it actually is — the caller filters those out.

Rules per recipe:
- "title" — the recipe's name. Lower title_confidence when handwriting is hard to read; "high" only when the title is unambiguous.
- "suggested_section_slug" — pick the BEST match from this fixed list:
${VALID_SECTION_SLUGS.map((s) => `    ${s}`).join('\n')}
  If you genuinely cannot tell, still pick the closest and set suggested_section_confidence='low' — the human reviewer will fix it.
- "originally_from" — if the recipe shows attribution (a magazine, cookbook, restaurant, or person's name like "from Mary Jones" or "from Bon Appétit, October 2007"), extract it verbatim. Null otherwise. Do NOT speculate.
- "story" — any contextual prose the page shows, including margin notes like "Christmas 2007 — Charles loved this!" Preserve verbatim. Null if none.
- "ingredients" — preserve sub-headers ("For the dough:", "For the sauce:") as groups. If no sub-headers, return one group with sub_header=null. Keep ingredient lines AS WRITTEN; don't normalize units.
- "instructions" — concrete, step-shaped. Empty array if the page is ingredient-only (some handwritten cards have no documented steps).
- "kitchen_notes" — Lucy's personal annotations or margin scribbles (separate from "story" which is contextual prose). Each note one string.
- "has_handwriting" — true if any source photo contains handwriting (recipe cards, margin notes, signatures).
- "overall_confidence" — set to the WORST of the per-field confidences. Better to flag "low" than make a confident wrong guess.
- "is_multiple_recipes" — true on EVERY recipe in this group if the group contained 2+ recipes. (Helps the queue surface multi-recipe groups for human review.)
- "needs_split_notes" — when is_multiple_recipes=true, briefly describe how you split (e.g. "Photos 1-2 are Lemon Pound Cake, photo 3 is a separate Chocolate Pudding recipe on the back of page 2").
- "source_photo_indices" — 1-based list of photos in the group that belong to THIS recipe. For one-recipe groups, list all photos. For multi-recipe splits, list only the photos that make up this recipe.
- "notes_to_reviewer" — anything Kate should know during review (illegible spots, missing yields, "ingredients are unusual — verify", etc.). Null if nothing notable.

Never invent content. Lucy's binder is a curated archive — accuracy beats completeness.`;

let _client: Anthropic | undefined;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

export type BinderParseResult = {
  recipes: BinderRecipe[];
  usage: { input_tokens: number; output_tokens: number };
};

export async function parseBinderGroup(args: {
  photos: { base64: string; mediaType: string }[];
}): Promise<BinderParseResult> {
  if (args.photos.length === 0) throw new Error('No photos in group.');

  const content: Anthropic.ContentBlockParam[] = [];
  for (let i = 0; i < args.photos.length; i++) {
    content.push({ type: 'text', text: `Photo ${i + 1} of ${args.photos.length}:` });
    content.push({
      type: 'image',
      source: {
        type:       'base64',
        media_type: args.photos[i].mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
        data:       args.photos[i].base64,
      },
    });
  }
  content.push({
    type: 'text',
    text:
      `You have ${args.photos.length} photo(s) from Aunt Lucy's binder. ` +
      `Return one recipe object per recipe identified in the photos.`,
  });

  // Scale output budget with photo count — bigger groups produce more
  // recipes and thus longer JSON. Cap at 16000 to stay under the
  // Anthropic SDK's "use streaming for long requests" threshold; for
  // groups larger than that the orchestrator chunks the group up
  // instead of asking for a giant single response.
  const maxTokens =
    args.photos.length >= 4  ? 16000 :
                                10000;

  const response = await client().messages.parse({
    model:      'claude-sonnet-4-6',
    max_tokens: maxTokens,
    thinking:   { type: 'adaptive' },
    output_config: {
      effort: 'medium',
      format: zodOutputFormat(BinderGroupSchema),
    },
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content }],
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error('Binder vision parser returned no structured output.');

  return {
    recipes: parsed.recipes,
    usage:   { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
  };
}

export const VALID_BINDER_SECTION_SLUGS = VALID_SECTION_SLUGS;
