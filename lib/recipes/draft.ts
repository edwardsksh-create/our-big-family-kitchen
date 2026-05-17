import type { ParsedRecipe } from '@/lib/recipe-parser';

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
  };
}
