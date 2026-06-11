// Pure helpers for the trusted-contributor tier on the recipe save flow.
// Kept outside lib/recipes/save.ts so the rules can be unit-tested without
// touching auth or the DB.

export type PublishContributorView = {
  isAdmin:    boolean;
  canPublish: boolean;
};

/**
 * Is this contributor entitled to publish a submission directly, bypassing
 * the admin review queue? Admin is always trusted; otherwise the
 * can_publish flag on the contributors row decides. Re-resolve this from
 * the DB at submit time — never trust a client-passed flag.
 */
export function canPublishDirectly(view: PublishContributorView): boolean {
  return view.isAdmin || view.canPublish;
}

export type RecipeStatus = 'draft' | 'pending_review' | 'published' | 'rejected';

/**
 * Decide the resulting status of a "submit for review" action, given who is
 * submitting. Trusted contributors get the same direct-publish outcome as
 * admin. Everyone else still goes to pending_review for Kate to approve.
 */
export function resolveSubmitForReviewStatus(view: PublishContributorView): RecipeStatus {
  return canPublishDirectly(view) ? 'published' : 'pending_review';
}
