import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { formatSourceAttribution } from '@/lib/recipes/source-attribution';
import { applyHouseStyleToParsedRecipe } from '@/lib/recipes/house-style';

// Output schema for parsed recipes. Kept conservative — we don't try to
// extract quantities into a structured format; the human can clean up the
// raw `item_text` lines on the review screen.

export const ParsedIngredientGroupSchema = z.object({
  sub_header: z.string().nullable().describe(
    'Optional section heading like "For the dough:" or null when not present.',
  ),
  items: z
    .array(z.string())
    .describe('Each ingredient line as it would appear in a recipe, e.g. "1 cup flour".'),
});

export const ParsedInstructionStepSchema = z.object({
  sub_header: z.string().nullable().describe(
    'Optional section heading like "Make the dough:" or null when not present.',
  ),
  body: z.string().describe('The instruction text for this step.'),
});

// Structured form of external attribution. Populated only when the source
// explicitly attributes the recipe to a person, publication, site, or
// cookbook outside the family. Family recipes (attributed via contributor_id)
// leave this null.
export const ExternalSourceSchema = z.object({
  author:  z.string().nullable().describe('Named author/cook (e.g. "Sam Sifton"), or null.'),
  source:  z.string().nullable().describe('Publication, website, or cookbook title (e.g. "NYT Cooking", "Barefoot Contessa"), or null.'),
  is_book: z.boolean().describe('True if "source" names a cookbook (book title); false for a publication, magazine, or website.'),
});

export const ParsedRecipeSchema = z.object({
  title:           z.string().describe('Recipe title.'),
  story:           z.string().nullable().describe(
    'Headnote, story, or notes about the recipe. Null if none.',
  ),
  originally_from: z.string().nullable().describe(
    'Leave null when external_source is populated; the system formats this from the structured fields. Set only when source is mentioned in a form too freeform for external_source to capture.',
  ),
  external_source: ExternalSourceSchema.nullable().describe(
    'Structured external attribution. Null for family recipes with no external source.',
  ),
  ingredient_groups: z.array(ParsedIngredientGroupSchema).describe(
    'Ingredients, optionally grouped under sub-headers.',
  ),
  instruction_steps: z.array(ParsedInstructionStepSchema).describe(
    'Instructions, optionally grouped under sub-headers.',
  ),
});

export type ParsedRecipe = z.infer<typeof ParsedRecipeSchema>;

const SYSTEM_PROMPT = `You extract structured recipes from messy text (pasted from notes, emails, blog posts, etc.).

Goals:
- Capture the title, the story/notes, the ingredients, and the instructions.
- Preserve the cook's voice — keep their phrasing in the story; keep ingredient lines as written ("1 cup flour" not "1c flour", but don't normalize "1 stick butter" into "8 tbsp").
- Use sub-headers (e.g. "For the dough:", "Make the filling:") when the source clearly groups items; otherwise leave sub_header as null.
- "external_source" captures attribution to a source OUTSIDE the family — a publication, website, cookbook, or named author. Populate only when the source explicitly attributes the recipe to such a source.
  - "author" — the named cook/author when present (e.g. "Sam Sifton", "Deb Perelman", "Ina Garten"), or null.
  - "source" — the publication, website, or cookbook title (e.g. "NYT Cooking", "Smitten Kitchen", "Barefoot Contessa"), or null.
  - "is_book" — true if "source" is a cookbook (book title); false if it's a publication, magazine, or website.
  - Set external_source to null when no external source is mentioned (e.g. a family recipe with no external attribution).
- "originally_from" — leave null when you populate external_source. The system formats it from those structured fields.
- "story" captures any prose around the recipe: where it came from, who taught it, how it's changed. Null if there isn't any.

Do not invent content. If something isn't in the source, leave it out (or null).
Do not summarize or paraphrase instructions. Keep them concrete and step-shaped.`;

let _client: Anthropic | undefined;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

export async function parseRecipeFromText(text: string): Promise<ParsedRecipe> {
  // Recipe parsing is an extraction task — use Sonnet 4.6 (user-specified)
  // with low effort. The system prompt is reused across calls so it's worth
  // caching; the user content is the only thing that varies per request.
  const response = await client().messages.parse({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    thinking: { type: 'disabled' },
    output_config: {
      effort: 'low',
      format: zodOutputFormat(ParsedRecipeSchema),
    },
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Extract the recipe from the text below.\n\n---\n${text}\n---`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error('Recipe parser returned no structured output.');
  }
  return applyHouseStyleToParsedRecipe(applyHouseStyleSource(parsed));
}

/**
 * If the parser populated `external_source`, format `originally_from` from
 * the structured fields per house style. Leaves `originally_from` alone
 * otherwise (LLMs occasionally lean on the legacy field for edge cases).
 * Pure — exported for the JSON-LD path and vision parsers, both of which
 * also funnel through the same canonicalization.
 */
export function applyHouseStyleSource<T extends ParsedRecipe>(parsed: T): T {
  if (!parsed.external_source) return parsed;
  const normalized = formatSourceAttribution({
    author: parsed.external_source.author,
    source: parsed.external_source.source,
    isBook: parsed.external_source.is_book,
  });
  if (normalized === null) return parsed;
  return { ...parsed, originally_from: normalized };
}
