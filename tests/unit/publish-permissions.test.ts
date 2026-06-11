import { describe, it, expect } from 'vitest';
import {
  canPublishDirectly,
  resolveSubmitForReviewStatus,
  type PublishContributorView,
} from '@/lib/recipes/publish-permissions';

const KATE_ADMIN:   PublishContributorView = { isAdmin: true,  canPublish: false };
const KATE_ADMIN_T: PublishContributorView = { isAdmin: true,  canPublish: true  };
const ANNIE_TRUSTED:   PublishContributorView = { isAdmin: false, canPublish: true  };
const REGULAR_CONTRIB: PublishContributorView = { isAdmin: false, canPublish: false };

describe('canPublishDirectly', () => {
  it('admin is always trusted, regardless of the flag', () => {
    expect(canPublishDirectly(KATE_ADMIN)).toBe(true);
    expect(canPublishDirectly(KATE_ADMIN_T)).toBe(true);
  });

  it('non-admin with can_publish=true is trusted', () => {
    expect(canPublishDirectly(ANNIE_TRUSTED)).toBe(true);
  });

  it('non-admin with can_publish=false is NOT trusted', () => {
    expect(canPublishDirectly(REGULAR_CONTRIB)).toBe(false);
  });
});

describe('resolveSubmitForReviewStatus — trusted-tier outcome', () => {
  it('admin submission lands as published', () => {
    expect(resolveSubmitForReviewStatus(KATE_ADMIN)).toBe('published');
  });

  it('trusted-contributor submission lands as published', () => {
    expect(resolveSubmitForReviewStatus(ANNIE_TRUSTED)).toBe('published');
  });

  it('regular-contributor submission lands in pending_review (existing behavior)', () => {
    expect(resolveSubmitForReviewStatus(REGULAR_CONTRIB)).toBe('pending_review');
  });
});

describe('feature requirement: can_publish grants only the publish-skipping outcome — nothing else', () => {
  // These tests document the contract so a later refactor doesn't quietly
  // expand can_publish into a broader admin proxy.
  it('does not derive admin from can_publish', () => {
    // A trusted contributor is NOT admin; canPublishDirectly() must remain
    // the only place the two are aliased, and only for the submit outcome.
    expect(ANNIE_TRUSTED.isAdmin).toBe(false);
    expect(canPublishDirectly(ANNIE_TRUSTED)).toBe(true);
  });

  it('returns the same publish-now outcome shape as admin', () => {
    // Both admin and trusted resolve to the same exact status string —
    // 'published' — there's no separate "trusted-published" state.
    expect(resolveSubmitForReviewStatus(ANNIE_TRUSTED))
      .toBe(resolveSubmitForReviewStatus(KATE_ADMIN));
  });
});
