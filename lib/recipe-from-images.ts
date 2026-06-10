import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { RenderedPage } from '@/lib/pdf/render';
import { SECTIONS } from '@/lib/sections';
import { formatSourceAttribution } from '@/lib/recipes/source-attribution';

// One ingredient line, optionally grouped under a sub-header.
const IngredientGroupSchema = z.object({
  sub_header: z.string().nullable(),
  items:      z.array(z.string()),
});

const InstructionStepSchema = z.object({
  sub_header: z.string().nullable(),
  body:       z.string(),
});

const VALID_SECTION_SLUGS = SECTIONS.map((s) => s.slug);
const SectionSlugSchema = z.enum(VALID_SECTION_SLUGS as [string, ...string[]]);

const ExternalSourceSchema = z.object({
  author:  z.string().nullable(),
  source:  z.string().nullable(),
  is_book: z.boolean(),
});

const ParsedRecipeSchema = z.object({
  title:             z.string(),
  story:             z.string().nullable(),
  originally_from:   z.string().nullable(),
  external_source:   ExternalSourceSchema.nullable(),
  section_slug:      SectionSlugSchema.nullable(),
  ingredient_groups: z.array(IngredientGroupSchema),
  instruction_steps: z.array(InstructionStepSchema),
});

export const ParsedRecipeBatchSchema = z.object({
  recipes: z.array(ParsedRecipeSchema),
});

export type ParsedRecipeBatch  = z.infer<typeof ParsedRecipeBatchSchema>;
export type ParsedRecipeVision = z.infer<typeof ParsedRecipeSchema>;

const SYSTEM_PROMPT = `You extract structured recipes from scanned or photographed pages.

Pages may include handwriting, typed text, magazine scans, or a mix. Read the visible content carefully, preserve the cook's voice (don't paraphrase), and extract exactly the recipes the user describes — no more, no less.

Rules:
- "ingredient_groups" — preserve the source's grouping. If a page has "For the dough:" and "For the filling:" sub-headers, each group's sub_header should reflect that. If the source has no grouping, return one group with sub_header = null and all items in it.
- Keep ingredient lines as written ("1 cup flour", "2 sticks butter") — don't normalize units.
- "instruction_steps" — concrete, step-shaped. Each step's sub_header is null unless the source explicitly groups steps under a heading.
- If the source documents NO instructions (just ingredients), return an empty instruction_steps array. Do NOT invent steps.
- "section_slug" — pick the most appropriate slug from this list, or null if unsure:
  ${VALID_SECTION_SLUGS.join(', ')}
- "story" — any narrative the source author wrote around the recipe: where it came from, who taught it, personal notes addressed to family. PRESERVE these verbatim. Null if none.
- "external_source" — populate ONLY when the source explicitly attributes the recipe to a publication, website, cookbook, or named author outside the family.
  - "author" — named author/cook ("Sam Sifton", "Deb Perelman", "Ina Garten"), or null.
  - "source" — the publication, website, or cookbook title ("NYT Cooking", "Smitten Kitchen", "Barefoot Contessa"), or null.
  - "is_book" — true if "source" is a cookbook (book title); false for a publication, magazine, or website.
  - Set to null when the source is a family member, restaurant, or otherwise not an external publication/cookbook.
- "originally_from" — leave null when you populate external_source. The system formats it from those structured fields. Set it only for cases external_source can't capture (e.g. a restaurant name like "Holiday Inn, South Bend").

Do not invent content. If something isn't visible in the source, leave it out (or null).`;

let _client: Anthropic | undefined;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

export type VisionParseResult = {
  recipes: ParsedRecipeVision[];
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
};

export async function parseRecipesFromImages(args: {
  pages:      RenderedPage[];
  extraction: string; // file-specific guidance
}): Promise<VisionParseResult> {
  // Build the user-turn content: every page as an image block, then a text
  // block with the file-specific guidance.
  const content: Anthropic.ContentBlockParam[] = [];
  for (const page of args.pages) {
    content.push({
      type: 'image',
      source: {
        type:       'base64',
        media_type: page.mediaType,
        data:       page.base64,
      },
    });
  }
  content.push({
    type: 'text',
    text:
      args.extraction +
      '\n\nReturn the extracted recipes as a JSON object with a "recipes" array. ' +
      'Each recipe follows the structured-output schema.',
  });

  const response = await client().messages.parse({
    model:      'claude-sonnet-4-6',
    max_tokens: 16000,
    // Vision parsing of handwriting needs adaptive thinking to get good
    // results on the tricky pages. The total budget is small enough that this
    // doesn't blow up cost.
    thinking:   { type: 'adaptive' },
    output_config: {
      effort: 'medium',
      format: zodOutputFormat(ParsedRecipeBatchSchema),
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
  if (!parsed) throw new Error('Vision recipe parser returned no structured output.');

  return {
    recipes: parsed.recipes.map(applyHouseStyleSource),
    usage: {
      input_tokens:  response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}

function applyHouseStyleSource(r: ParsedRecipeVision): ParsedRecipeVision {
  if (!r.external_source) return r;
  const normalized = formatSourceAttribution({
    author: r.external_source.author,
    source: r.external_source.source,
    isBook: r.external_source.is_book,
  });
  if (normalized === null) return r;
  return { ...r, originally_from: normalized };
}
