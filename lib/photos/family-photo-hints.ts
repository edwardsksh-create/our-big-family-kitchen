// AI vision hints for family-photo intake.
//
// Runs at bulk-upload time. Output is stored in family_photos.ai_hints (JSONB)
// and rendered on the /admin/photo-review screen as a *suggestion* for the
// human reviewer — nothing is auto-tagged. Kate confirms every tag.

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const OCCASION_SLUGS = [
  'easter', 'mothers-day', 'fathers-day', 'first-communion', 'graduation',
  'baby-shower', 'birthday', 'backyard-holidays', 'halloween', 'thanksgiving',
  'christmas', 'new-years', 'wedding', 'anniversary', 'vacation', 'memorial',
  'sunday-dinner', 'casual-gathering', 'cooking-lesson',
] as const;

export const FamilyPhotoHintsSchema = z.object({
  estimated_year:            z.string().describe("e.g. '1995-2000' based on clothing, photo quality, visible tech"),
  estimated_year_confidence: z.enum(['high', 'medium', 'low']),
  person_count:              z.number().int().nonnegative(),
  visible_occasion_clues:    z.array(z.string()).describe('e.g. "Christmas tree", "birthday cake", "Thanksgiving turkey"'),
  probable_occasions:        z.array(z.enum(OCCASION_SLUGS)),
  food_visible:              z.array(z.string()).describe('recognizable food items on tables, counters, plates'),
  setting:                   z.string().describe('indoor kitchen, outdoor patio, dining room, etc.'),
  date_stamp_visible:        z.string().nullable().describe('printed date stamp text visible in a corner, or null'),
  notes:                     z.string().describe('anything else relevant for the human reviewer'),
});

export type FamilyPhotoHints = z.infer<typeof FamilyPhotoHintsSchema>;

const SYSTEM_PROMPT = `You are looking at a family photo from an archive. Generate structured hints to help a human reviewer tag the photo.

Guidelines:
- Estimate the year from clothing styles, hair, photo quality (grain, color cast, aspect ratio), and any visible technology or printed dates.
- If you spot a date stamp in a corner of the print (common on 35mm prints from the 80s and 90s), report it verbatim in date_stamp_visible.
- Identify occasions only when there are clear visual cues — a Christmas tree, a wedding dress, a graduation cap, etc. Don't guess. The probable_occasions list must be a subset of: ${OCCASION_SLUGS.join(', ')}.
- Note food on the table only if visibly identifiable.
- Setting should be short and concrete ("indoor kitchen", "outdoor patio", "restaurant booth").

Keep tone factual. The human will decide what to actually tag.`;

let _client: Anthropic | undefined;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY.');
  _client = new Anthropic({ apiKey });
  return _client;
}

// We can't call the SDK's `messages.parse({ output_config: ... })` helper
// here without importing the helper, and the binder-intake module does so by
// referencing it from a relative path. Re-importing here keeps the call
// shape consistent across modules.
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

export async function generateFamilyPhotoHints(args: {
  imageBytes: Buffer;
  mimeType:   'image/jpeg' | 'image/png' | 'image/webp';
}): Promise<{ hints: FamilyPhotoHints; usage: { input_tokens: number; output_tokens: number } }> {
  const response = await client().messages.parse({
    model:      'claude-sonnet-4-6',
    max_tokens: 2000,
    thinking:   { type: 'adaptive' },
    output_config: {
      effort: 'medium',
      format: zodOutputFormat(FamilyPhotoHintsSchema),
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
        content: [
          {
            type: 'image',
            source: {
              type:        'base64',
              media_type:  args.mimeType,
              data:        args.imageBytes.toString('base64'),
            },
          },
          {
            type: 'text',
            text: 'Generate hints for this family photo.',
          },
        ],
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error('Family-photo vision parser returned no structured output.');
  return {
    hints: parsed,
    usage: {
      input_tokens:  response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}
