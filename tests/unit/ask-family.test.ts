import { describe, it, expect } from 'vitest';
import {
  isStubEmail,
  eligibleRecipients,
  defaultRecipientId,
  composeAskDraft,
  type AskFamilyContext,
} from '@/lib/recipes/ask-family';

const ANNIE = { id: 'annie', displayName: "Annie 'Nannie' Sundy",   email: 'annie@example.com' };
const KATE  = { id: 'kate',  displayName: 'Kate Edwards',           email: 'kate@example.com' };
const LAURA = { id: 'laura', displayName: 'Laura Leusch',           email: 'stub+laura-leusch@ourbigfamilykitchen.local' };
const NULL_EMAIL = { id: 'nu', displayName: 'Null Mail Person',     email: null };

describe('isStubEmail', () => {
  it('treats null/empty as stub-equivalent for recipient eligibility', () => {
    expect(isStubEmail(null)).toBe(true);
    expect(isStubEmail(undefined)).toBe(true);
    expect(isStubEmail('')).toBe(true);
  });
  it('flags the placeholder local domain', () => {
    expect(isStubEmail('stub+x@ourbigfamilykitchen.local')).toBe(true);
    expect(isStubEmail('person@ourbigfamilykitchen.local')).toBe(true);
  });
  it('accepts real addresses', () => {
    expect(isStubEmail('annie@example.com')).toBe(false);
    expect(isStubEmail('annie+sundy@gmail.com')).toBe(false);
  });
});

describe('eligibleRecipients', () => {
  it('returns only contributors with a real email', () => {
    const ctx: AskFamilyContext = {
      allContributors: [ANNIE, KATE, LAURA, NULL_EMAIL],
      contributor: LAURA,
    };
    const out = eligibleRecipients(ctx);
    expect(out.map((r) => r.id)).toEqual(['annie', 'kate']); // alphabetical by display name
    expect(out.find((r) => r.id === 'laura')).toBeUndefined();
    expect(out.find((r) => r.id === 'nu')).toBeUndefined();
  });

  it('sorts alphabetically by display name', () => {
    const ctx: AskFamilyContext = {
      allContributors: [
        { id: 'z', displayName: 'Zelda Hill',   email: 'z@x.com' },
        { id: 'a', displayName: 'Annie Sundy',  email: 'a@x.com' },
        { id: 'm', displayName: 'Mary Hogan',   email: 'm@x.com' },
      ],
      contributor: null,
    };
    expect(eligibleRecipients(ctx).map((r) => r.displayName))
      .toEqual(['Annie Sundy', 'Mary Hogan', 'Zelda Hill']);
  });
});

describe('defaultRecipientId', () => {
  it('returns the contributor id when they have a real email', () => {
    const ctx: AskFamilyContext = {
      allContributors: [ANNIE, KATE],
      contributor: ANNIE,
    };
    expect(defaultRecipientId(ctx)).toBe('annie');
  });

  it('returns null when the recipe\'s contributor only has a stub email', () => {
    const ctx: AskFamilyContext = {
      allContributors: [ANNIE, LAURA],
      contributor: LAURA,
    };
    expect(defaultRecipientId(ctx)).toBeNull();
  });

  it('returns null when the contributor email is null', () => {
    const ctx: AskFamilyContext = {
      allContributors: [ANNIE, NULL_EMAIL],
      contributor: NULL_EMAIL,
    };
    expect(defaultRecipientId(ctx)).toBeNull();
  });

  it('returns null when the recipe has no contributor at all', () => {
    const ctx: AskFamilyContext = {
      allContributors: [ANNIE],
      contributor: null,
    };
    expect(defaultRecipientId(ctx)).toBeNull();
  });
});

describe('composeAskDraft — contributor-is-recipient template', () => {
  const draft = composeAskDraft({
    recipientName:    'Annie Sundy',
    contributorName:  'Annie Sundy',
    recipeTitle:      'Best Jicama Coleslaw',
    recipeUrl:        'https://bigfamilykitchen.com/recipes/best-jicama-coleslaw',
    isRecipientTheContributor: true,
  });

  it('uses the "your recipe" phrasing — "how you make it"', () => {
    expect(draft.bodyPlain).toContain('Do you remember how you make it?');
    expect(draft.bodyPlain).not.toContain("Annie Sundy's"); // contributor name not in body
  });

  it('addresses the recipient by name', () => {
    expect(draft.bodyPlain.startsWith('Hi Annie Sundy,')).toBe(true);
  });

  it('mentions Our Big Family Kitchen and the recipe title', () => {
    expect(draft.bodyPlain).toContain('Our Big Family Kitchen');
    expect(draft.bodyPlain).toContain('Best Jicama Coleslaw');
  });

  it('signs off from Kate', () => {
    expect(draft.bodyPlain.trimEnd().endsWith('Thanks,\nKate')).toBe(true);
  });

  it('uses the standard editable subject', () => {
    expect(draft.subject).toBe('A recipe on Our Big Family Kitchen needs your help');
  });

  it('emits an HTML version with italicized brand and a clickable link', () => {
    expect(draft.bodyHtml).toContain('<em>Our Big Family Kitchen</em>');
    expect(draft.bodyHtml).toContain('<a href="https://bigfamilykitchen.com/recipes/best-jicama-coleslaw"');
  });
});

describe('composeAskDraft — asking-on-behalf-of template', () => {
  const draft = composeAskDraft({
    recipientName:    'Annie Sundy',
    contributorName:  'Laura Leusch',
    recipeTitle:      'Corn Pudding',
    recipeUrl:        'https://bigfamilykitchen.com/recipes/corn-pudding',
    isRecipientTheContributor: false,
  });

  it('names the original contributor in possessive form before the recipe', () => {
    expect(draft.bodyPlain).toContain("Laura Leusch's Corn Pudding is missing its preparation steps");
  });

  it('asks how the original contributor made it', () => {
    expect(draft.bodyPlain).toContain('Do you remember how Laura Leusch made it?');
  });

  it('still addresses the chosen recipient', () => {
    expect(draft.bodyPlain.startsWith('Hi Annie Sundy,')).toBe(true);
  });

  it('escapes the contributor name in the HTML body', () => {
    const dr = composeAskDraft({
      recipientName:   'Annie Sundy',
      contributorName: "Lucy <Gal> O'Brien",
      recipeTitle:     'Pie',
      recipeUrl:       'https://bigfamilykitchen.com/recipes/pie',
      isRecipientTheContributor: false,
    });
    // The contributor name has its angle brackets and apostrophe escaped;
    // the possessive "'s" that follows is a literal string in the template,
    // so its apostrophe stays as a raw character (still HTML-safe).
    expect(dr.bodyHtml).toContain("Lucy &lt;Gal&gt; O&#39;Brien's Pie");
    expect(dr.bodyHtml).not.toContain("<Gal>"); // raw tags must not leak
  });
});
