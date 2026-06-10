import { describe, it, expect } from 'vitest';
import {
  canPostComment,
  canDeleteComment,
  SIGNED_OUT_COMMENT_VIEWER,
  type CommentViewer,
} from '@/lib/recipes/comment-permissions';

const SIGNED_OUT: CommentViewer = SIGNED_OUT_COMMENT_VIEWER;

const KATE_ADMIN:           CommentViewer = { isAdmin: true,  contributorId: 'kate',   canSignIn: true };
const ANNIE_CAN_SIGN_IN:    CommentViewer = { isAdmin: false, contributorId: 'annie',  canSignIn: true };
const LIZZIE_CAN_SIGN_IN:   CommentViewer = { isAdmin: false, contributorId: 'lizzie', canSignIn: true };
const VIEWER_NO_SIGNIN:     CommentViewer = { isAdmin: false, contributorId: 'regina', canSignIn: false };

describe('canPostComment', () => {
  it('signed-out visitor cannot post', () => {
    expect(canPostComment(SIGNED_OUT)).toBe(false);
  });

  it('admin can post', () => {
    expect(canPostComment(KATE_ADMIN)).toBe(true);
  });

  it('signed-in contributor with can_sign_in=true can post', () => {
    expect(canPostComment(ANNIE_CAN_SIGN_IN)).toBe(true);
    expect(canPostComment(LIZZIE_CAN_SIGN_IN)).toBe(true);
  });

  it('signed-in contributor with can_sign_in=false cannot post', () => {
    expect(canPostComment(VIEWER_NO_SIGNIN)).toBe(false);
  });
});

describe('canDeleteComment', () => {
  const annieComment    = { authorContributorId: 'annie' };
  const lauraComment    = { authorContributorId: 'laura-deceased' }; // attributed to a deceased contributor's row

  it('signed-out visitor cannot delete anyone\'s comment', () => {
    expect(canDeleteComment(SIGNED_OUT, annieComment)).toBe(false);
  });

  it('admin can delete any comment — including ones on a deceased-contributor recipe', () => {
    expect(canDeleteComment(KATE_ADMIN, annieComment)).toBe(true);
    expect(canDeleteComment(KATE_ADMIN, lauraComment)).toBe(true);
  });

  it('comment author can delete their own', () => {
    expect(canDeleteComment(ANNIE_CAN_SIGN_IN, annieComment)).toBe(true);
  });

  it('other signed-in family member cannot delete someone else\'s comment', () => {
    expect(canDeleteComment(LIZZIE_CAN_SIGN_IN, annieComment)).toBe(false);
  });

  it('viewer without can_sign_in cannot delete (they could never have posted anyway)', () => {
    expect(canDeleteComment(VIEWER_NO_SIGNIN, annieComment)).toBe(false);
  });
});

describe('feature requirement: comments work on recipes by deceased / stub contributors', () => {
  // The "deceased contributor recipe" case is enforced at the action layer
  // (only the COMMENTER's permission matters; the recipe's contributor isn't
  // consulted). These tests assert the rule by construction — a signed-in
  // commenter is allowed regardless of who the recipe is attributed to.
  it('a signed-in member can post on any recipe; the recipe-contributor identity is irrelevant to permission', () => {
    expect(canPostComment(ANNIE_CAN_SIGN_IN)).toBe(true);
    // Whether the recipe belongs to Aunt Laura (deceased), Aunt Sue (deceased),
    // or any living family member doesn't enter the decision — canPostComment
    // depends solely on the viewer.
  });
});
