import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { SECTIONS } from '@/lib/sections';
import { formatSourceAttribution } from '@/lib/recipes/source-attribution';

const Confidence = z.enum(['high', 'medium', 'low']);

const IngredientGroup = z.object({
  sub_header: z.string().nullable(),
  items:      z.array(z.string()),
});

const InstructionGroup = z.object({
  sub_header: z.string().nullable(),
  steps:      z.array(z.string()),
});

const VALID_SECTION_SLUGS = [
  ...SECTIONS.map((s) => s.slug),
  'uncategorized',
] as unknown as [string, ...string[]];

const ExternalSourceSchema = z.object({
  author:  z.string().nullable(),
  source:  z.string().nullable(),
  is_book: z.boolean(),
});

export const ParsedFromPhotosSchema = z.object({
  title:                          z.string(),
  title_confidence:               Confidence,
  alternate_titles:               z.array(z.string()).max(3).default([]),

  suggested_section:              z.enum(VALID_SECTION_SLUGS),
  suggested_section_confidence:   Confidence,

  originally_from:                z.string().nullable(),
  external_source:                ExternalSourceSchema.nullable(),
  story:                          z.string().nullable(),

  ingredients:                    z.array(IngredientGroup),
  instructions:                   z.array(InstructionGroup),

  kitchen_notes:                  z.array(z.string()).default([]),

  has_handwriting:                z.boolean(),
  overall_confidence:             Confidence,
  notes_to_reviewer:              z.string().nullable(),
});

export type ParsedFromPhotos = z.infer<typeof ParsedFromPhotosSchema>;

const SYSTEM_PROMPT = `You are a recipe transcription assistant for a family cookbook.

The user has uploaded one to five photos of a SINGLE recipe — typically a handwritten card, a cookbook page, a magazine clipping, or a phone snap of a typed recipe. Read every photo, then combine them into one structured recipe.

Rules:
- "title" — the recipe's name. Set "title_confidence" to "high" only when the title is clearly written. If multiple plausible titles appear, pick the most prominent and add the alternatives to "alternate_titles".
- "ingredients" — preserve grouping. If the source shows "For the dough:" then "For the filling:", each becomes a group with the matching sub_header. If there's no grouping, return one group with sub_header = null. Keep ingredient lines AS WRITTEN — don't normalize units ("1 stick butter" stays as is). Don't invent ingredients.
- "instructions" — concrete, step-shaped. If the source doesn't document instructions (ingredient-only recipes are real), return an empty array.
- "kitchen_notes" — preserve margin notes, personal annotations, asides ("don't forget to chill overnight!", "Mom's trick: …"). Each note is one string. Do NOT duplicate ingredients or instructions here.
- "external_source" — populate ONLY when the source explicitly attributes the recipe to a publication, website, cookbook, or named author OUTSIDE the family.
  - "author" — named author/cook ("Sam Sifton", "Ina Garten"), or null.
  - "source" — publication, website, or cookbook title ("NYT Cooking", "Barefoot Contessa"), or null.
  - "is_book" — true if "source" is a cookbook (book title); false for a publication, magazine, or website.
  - Set to null when the source is a family member or otherwise not an external publication/cookbook.
- "originally_from" — leave null when you populate external_source; the system formats it from the structured fields. Set it ONLY for cases external_source can't capture (e.g. a restaurant name, "Holiday Inn, South Bend").
- "story" — if the photo includes prose around the recipe (who taught it, when it became a tradition), capture it verbatim. Null otherwise.
- "suggested_section" — pick the closest fit from this list:
${[...SECTIONS.map((s) => `    ${s.slug} — ${s.name}`), '    uncategorized — if unsure'].join('\n')}
  Use "uncategorized" rather than guessing badly.
- Confidence calibration: when handwriting is hard to read, lower the relevant field's confidence rather than inventing. Set "overall_confidence" to the worst of the per-field confidences.
- If the photos clearly contain multiple separate recipes, pick the most prominent one and explain in "notes_to_reviewer".
- "has_handwriting" — true if any photo contains handwritten content.

Never invent content. If something isn't visible, leave it out or set it to null.`;

let _client: Anthropic | undefined;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

export type PhotoIntakeResult = {
  recipe: ParsedFromPhotos;
  usage: { input_tokens: number; output_tokens: number };
  cost_usd: number;
};

const PRICE_INPUT_PER_1M  = 3;   // Sonnet 4.6 input
const PRICE_OUTPUT_PER_1M = 15;  // Sonnet 4.6 output

export async function parseRecipeFromPhotoUrls(args: {
  photoUrls: string[];
}): Promise<PhotoIntakeResult> {
  if (args.photoUrls.length === 0) throw new Error('No photos given to vision parser.');

  const content: Anthropic.ContentBlockParam[] = [];
  for (const url of args.photoUrls) {
    content.push({
      type:   'image',
      source: { type: 'url', url },
    });
  }
  content.push({
    type: 'text',
    text:
      'Extract the recipe from these photos. Return a single object matching ' +
      'the structured-output schema. Use the confidence fields honestly — ' +
      'better a flagged "low" than a confident wrong guess.',
  });

  const response = await client().messages.parse({
    model:      'claude-sonnet-4-6',
    max_tokens: 8000,
    thinking:   { type: 'adaptive' },
    output_config: {
      effort: 'medium',
      format: zodOutputFormat(ParsedFromPhotosSchema),
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
  if (!parsed) throw new Error('Photo recipe parser returned no structured output.');

  const cost_usd =
    (response.usage.input_tokens  / 1_000_000) * PRICE_INPUT_PER_1M +
    (response.usage.output_tokens / 1_000_000) * PRICE_OUTPUT_PER_1M;

  return {
    recipe: applyHouseStyleSource(parsed),
    usage:  { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
    cost_usd,
  };
}

function applyHouseStyleSource(r: ParsedFromPhotos): ParsedFromPhotos {
  if (!r.external_source) return r;
  const normalized = formatSourceAttribution({
    author: r.external_source.author,
    source: r.external_source.source,
    isBook: r.external_source.is_book,
  });
  if (normalized === null) return r;
  return { ...r, originally_from: normalized };
}
