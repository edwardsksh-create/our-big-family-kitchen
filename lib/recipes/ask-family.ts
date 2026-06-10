// Pure helpers for the admin-only "Ask the family" flow on incomplete recipes.
// The page + form + send action use these to decide who can be a recipient,
// who to pre-select, and how to phrase the draft based on whether the
// recipient is the recipe's own contributor or someone else (e.g. asking a
// living sibling about a deceased contributor's recipe).

const STUB_EMAIL_SUFFIX = '@ourbigfamilykitchen.local';

export function isStubEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  return email.endsWith(STUB_EMAIL_SUFFIX);
}

export type EmailRecipient = {
  id:          string;
  displayName: string;
  email:       string;
};

export type AskFamilyContext = {
  /** All contributors in the system, with their formatted display names. */
  allContributors: {
    id:          string;
    displayName: string;
    email:       string | null;
  }[];
  /** The recipe's own contributor (always rendered in the "asking-on-behalf"
   *  copy when the recipient is someone else). */
  contributor: {
    id:          string;
    displayName: string;
    email:       string | null;
  } | null;
};

/**
 * Only contributors with a real (non-stub, non-null) email can receive the
 * ask — deceased family members or not-yet-invited people who only have a
 * placeholder address must not be picked. Sorted by display name.
 */
export function eligibleRecipients(ctx: AskFamilyContext): EmailRecipient[] {
  const out: EmailRecipient[] = [];
  for (const c of ctx.allContributors) {
    if (!c.email || isStubEmail(c.email)) continue;
    out.push({ id: c.id, displayName: c.displayName, email: c.email });
  }
  out.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return out;
}

/**
 * Default recipient: the recipe's own contributor when they have a real
 * email. Otherwise null — admin picks from the list manually.
 */
export function defaultRecipientId(ctx: AskFamilyContext): string | null {
  const c = ctx.contributor;
  if (!c || !c.email || isStubEmail(c.email)) return null;
  // Confirm they're in the eligible set (defense in depth).
  return eligibleRecipients(ctx).some((e) => e.id === c.id) ? c.id : null;
}

export type DraftParts = {
  recipientName:    string;
  contributorName:  string;
  recipeTitle:      string;
  recipeUrl:        string;
  /** True when the recipient IS the recipe's own contributor — toggles
   *  between the "your recipe" and "asking on their behalf" copy. */
  isRecipientTheContributor: boolean;
};

export type AskDraft = {
  subject:    string;
  bodyPlain:  string;
  bodyHtml:   string;
};

export function composeAskDraft(parts: DraftParts): AskDraft {
  const subject = 'A recipe on Our Big Family Kitchen needs your help';
  if (parts.isRecipientTheContributor) {
    return {
      subject,
      bodyPlain: buildContributorBodyPlain(parts),
      bodyHtml:  buildContributorBodyHtml(parts),
    };
  }
  return {
    subject,
    bodyPlain: buildOthersBodyPlain(parts),
    bodyHtml:  buildOthersBodyHtml(parts),
  };
}

function buildContributorBodyPlain(p: DraftParts): string {
  return `Hi ${p.recipientName}, I'm adding recipes to the collection on Our Big Family Kitchen and ${p.recipeTitle} is missing its preparation steps. Do you remember how you make it?

You can log-in to the site and edit the recipe here: ${p.recipeUrl}, or just reply to this email and I'll get that updated for you.

The rest of the family cooks will be so grateful!

Thanks,
Kate`;
}

function buildOthersBodyPlain(p: DraftParts): string {
  return `Hi ${p.recipientName}, I'm adding recipes to the collection on Our Big Family Kitchen and ${p.contributorName}'s ${p.recipeTitle} is missing its preparation steps. Do you remember how ${p.contributorName} made it?

You can log-in to the site and edit the recipe here: ${p.recipeUrl}, or just reply to this email and I'll get that updated for you.

The rest of the family cooks will be so grateful!

Thanks,
Kate`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildContributorBodyHtml(p: DraftParts): string {
  const e = escapeHtml;
  const url = encodeURI(p.recipeUrl);
  return [
    `<p>Hi ${e(p.recipientName)}, I'm adding recipes to the collection on <em>Our Big Family Kitchen</em> and ${e(p.recipeTitle)} is missing its preparation steps. Do you remember how you make it?</p>`,
    `<p>You can log-in to the site and edit the recipe here: <a href="${url}">${e(p.recipeUrl)}</a>, or just reply to this email and I'll get that updated for you.</p>`,
    `<p>The rest of the family cooks will be so grateful!</p>`,
    `<p>Thanks,<br>Kate</p>`,
  ].join('\n');
}

function buildOthersBodyHtml(p: DraftParts): string {
  const e = escapeHtml;
  const url = encodeURI(p.recipeUrl);
  return [
    `<p>Hi ${e(p.recipientName)}, I'm adding recipes to the collection on <em>Our Big Family Kitchen</em> and ${e(p.contributorName)}'s ${e(p.recipeTitle)} is missing its preparation steps. Do you remember how ${e(p.contributorName)} made it?</p>`,
    `<p>You can log-in to the site and edit the recipe here: <a href="${url}">${e(p.recipeUrl)}</a>, or just reply to this email and I'll get that updated for you.</p>`,
    `<p>The rest of the family cooks will be so grateful!</p>`,
    `<p>Thanks,<br>Kate</p>`,
  ].join('\n');
}
