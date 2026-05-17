import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

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

export const ParsedRecipeSchema = z.object({
  title:           z.string().describe('Recipe title.'),
  story:           z.string().nullable().describe(
    'Headnote, story, or notes about the recipe. Null if none.',
  ),
  originally_from: z.string().nullable().describe(
    'Source attribution if mentioned (a person, a cookbook, a website). Null otherwise.',
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
- "originally_from" captures source attribution the writer makes — a person's name, a cookbook, a website. Null if not mentioned.
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
  return parsed;
}
