// Pure permission helpers for the family memories on recipe pages. Kept
// outside the server-action and query files so the rules can be unit-tested
// without touching the DB.

export type CommentViewer = {
  isAdmin:       boolean;
  contributorId: string | null;
  canSignIn:     boolean;
};

export const SIGNED_OUT_COMMENT_VIEWER: CommentViewer = {
  isAdmin:       false,
  contributorId: null,
  canSignIn:     false,
};

/**
 * Who can post a memory? Any signed-in family member with can_sign_in=true.
 * Admin is a contributor too, so they qualify automatically. Signed-out
 * visitors and view-only stub accounts cannot.
 */
export function canPostComment(viewer: CommentViewer): boolean {
  if (!viewer.contributorId) return false;
  return viewer.canSignIn || viewer.isAdmin;
}

/**
 * Who can delete a given memory? The author of the comment, or any admin.
 * Everyone else (including other signed-in family members) sees no delete
 * affordance on it.
 */
export function canDeleteComment(
  viewer:           CommentViewer,
  comment:          { authorContributorId: string },
): boolean {
  if (viewer.isAdmin) return true;
  if (!viewer.contributorId) return false;
  return viewer.contributorId === comment.authorContributorId;
}
