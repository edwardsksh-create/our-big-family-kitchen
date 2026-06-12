import type { ParsedRecipe } from '@/lib/recipe-parser';
import type { ParsedFromPhotos } from '@/lib/photos/intake';

// The shape the review form holds in memory and posts back to the save action.
// "draft" because everything is optional; the save action validates required
// fields based on the action variant (draft / publish / submit_for_review).

export type IngredientRow = {
  id:         string; // client-side row id (uuid or `new:N`) — survives reorder
  sub_header: string;
  item_text:  string;
};

export type InstructionRow = {
  id:         string;
  sub_header: string;
  body:       string;
};

export type PhotoEntry = {
  // Server-set id if this photo already exists in the DB; absent if newly uploaded.
  id?:           string;
  storage_path: string;
  public_url:   string;
  /** Web-sized card derivative (thumbs/…); null when none could be generated. */
  thumb_path?:  string | null;
  photo_type:   'source' | 'dish';
  caption?:     string;
};

export type FieldConfidence = 'high' | 'medium' | 'low';

export type RecipeDraft = {
  // Persistent fields
  id?:                       string;
  title:                     string;
  contributor_id?:           string;
  originally_from?:          string;
  primary_family_line_id?:   string;
  secondary_family_line_id?: string;
  section_id?:               string;
  story?:                    string;
  ingredients:               IngredientRow[];
  instructions:              InstructionRow[];
  tags:                      string[]; // tag slugs or free-text names
  kitchen_notes:             string[];
  source_photos:             PhotoEntry[];
  dish_photos:               PhotoEntry[];
  // AI-only metadata for the review screen (not persisted). Set by photo intake.
  field_confidence?:         {
    title?:            FieldConfidence;
    suggested_section?: FieldConfidence;
    overall?:          FieldConfidence;
  };
  notes_to_reviewer?:        string;
  alternate_titles?:         string[];
};

let _idCounter = 0;
export function newRowId(): string {
  _idCounter += 1;
  return `new:${Date.now()}:${_idCounter}`;
}

export function emptyDraft(): RecipeDraft {
  return {
    title:        '',
    originally_from: '',
    story:        '',
    ingredients:  [{ id: newRowId(), sub_header: '', item_text: '' }],
    instructions: [{ id: newRowId(), sub_header: '', body: '' }],
    tags:         [],
    kitchen_notes: [],
    source_photos: [],
    dish_photos:   [],
  };
}

export function draftFromParsed(parsed: ParsedRecipe, opts?: { sourceUrl?: string }): RecipeDraft {
  const ingredients: IngredientRow[] = [];
  for (const group of parsed.ingredient_groups ?? []) {
    for (let i = 0; i < (group.items ?? []).length; i++) {
      ingredients.push({
        id:         newRowId(),
        sub_header: i === 0 ? (group.sub_header ?? '') : '',
        item_text:  group.items[i],
      });
    }
  }
  if (ingredients.length === 0) ingredients.push({ id: newRowId(), sub_header: '', item_text: '' });

  const instructions: InstructionRow[] = [];
  let lastSub: string | null = null;
  for (const step of parsed.instruction_steps ?? []) {
    const sub = step.sub_header ?? null;
    instructions.push({
      id:         newRowId(),
      sub_header: sub && sub !== lastSub ? sub : '',
      body:       step.body,
    });
    lastSub = sub;
  }
  if (instructions.length === 0) instructions.push({ id: newRowId(), sub_header: '', body: '' });

  return {
    title:           parsed.title ?? '',
    originally_from: parsed.originally_from ?? opts?.sourceUrl ?? '',
    story:           parsed.story ?? '',
    ingredients,
    instructions,
    tags:            [],
    kitchen_notes:   [],
    source_photos:   [],
    dish_photos:     [],
  };
}

export function draftFromPhotoParse(
  parsed: ParsedFromPhotos,
  uploadedPhotos: PhotoEntry[],
): RecipeDraft {
  const ingredients: IngredientRow[] = [];
  for (const group of parsed.ingredients ?? []) {
    for (let i = 0; i < (group.items ?? []).length; i++) {
      ingredients.push({
        id:         newRowId(),
        sub_header: i === 0 ? (group.sub_header ?? '') : '',
        item_text:  group.items[i],
      });
    }
  }
  if (ingredients.length === 0) ingredients.push({ id: newRowId(), sub_header: '', item_text: '' });

  const instructions: InstructionRow[] = [];
  let lastSub: string | null = null;
  for (const group of parsed.instructions ?? []) {
    for (const step of group.steps ?? []) {
      const sub = group.sub_header ?? null;
      instructions.push({
        id:         newRowId(),
        sub_header: sub && sub !== lastSub ? sub : '',
        body:       step,
      });
      lastSub = sub;
    }
  }
  if (instructions.length === 0) instructions.push({ id: newRowId(), sub_header: '', body: '' });

  return {
    title:           parsed.title,
    originally_from: parsed.originally_from ?? '',
    story:           parsed.story ?? '',
    ingredients,
    instructions,
    tags:            [],
    kitchen_notes:   parsed.kitchen_notes ?? [],
    source_photos:   uploadedPhotos.filter((p) => p.photo_type === 'source'),
    dish_photos:     uploadedPhotos.filter((p) => p.photo_type === 'dish'),
    field_confidence: {
      title:             parsed.title_confidence,
      suggested_section: parsed.suggested_section_confidence,
      overall:           parsed.overall_confidence,
    },
    notes_to_reviewer: parsed.notes_to_reviewer ?? undefined,
    alternate_titles:  parsed.alternate_titles ?? [],
  };
}
