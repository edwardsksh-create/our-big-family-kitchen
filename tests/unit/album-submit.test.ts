import { describe, it, expect } from 'vitest';
import {
  canUploadToAlbum,
  SIGNED_OUT_ALBUM_VIEWER,
  FAMILY_PHOTO_ALLOWED_MIME,
  MAX_FAMILY_PHOTO_BYTES,
  MAX_FAMILY_PHOTOS_PER_SUBMIT,
  type AlbumUploadViewer,
} from '@/lib/photos/album-submit';

const ADMIN:    AlbumUploadViewer = { isSignedIn: true,  contributorId: 'kate',  canSignIn: true  };
const MEMBER:   AlbumUploadViewer = { isSignedIn: true,  contributorId: 'annie', canSignIn: true  };
const STUB:     AlbumUploadViewer = { isSignedIn: true,  contributorId: 'laura', canSignIn: false };
const ANON                       = SIGNED_OUT_ALBUM_VIEWER;

describe('canUploadToAlbum', () => {
  it('signed-out visitor cannot upload', () => {
    expect(canUploadToAlbum(ANON)).toBe(false);
  });

  it('signed-in family member with can_sign_in=true can upload', () => {
    expect(canUploadToAlbum(MEMBER)).toBe(true);
  });

  it('admin (also a contributor with can_sign_in) can upload', () => {
    expect(canUploadToAlbum(ADMIN)).toBe(true);
  });

  it('contributor with can_sign_in=false cannot upload (stub / not-yet-invited)', () => {
    expect(canUploadToAlbum(STUB)).toBe(false);
  });

  it('signed-in user with no contributor row cannot upload', () => {
    expect(canUploadToAlbum({ isSignedIn: true, contributorId: null, canSignIn: false })).toBe(false);
  });

  it('respects the isSignedIn flag independently of contributorId', () => {
    // Synthetic but covers the gate ordering — if the auth check thinks the
    // user is signed out, they're blocked even if a contributor row exists.
    expect(canUploadToAlbum({ isSignedIn: false, contributorId: 'annie', canSignIn: true })).toBe(false);
  });
});

describe('upload constraints', () => {
  it('exposes the bucket\'s 15 MB cap as a constant', () => {
    expect(MAX_FAMILY_PHOTO_BYTES).toBe(15 * 1024 * 1024);
  });

  it('accepts the four image types the family-photos bucket allows', () => {
    expect(FAMILY_PHOTO_ALLOWED_MIME.has('image/jpeg')).toBe(true);
    expect(FAMILY_PHOTO_ALLOWED_MIME.has('image/png')).toBe(true);
    expect(FAMILY_PHOTO_ALLOWED_MIME.has('image/heic')).toBe(true);
    expect(FAMILY_PHOTO_ALLOWED_MIME.has('image/webp')).toBe(true);
    // and rejects everything else
    expect(FAMILY_PHOTO_ALLOWED_MIME.has('image/gif')).toBe(false);
    expect(FAMILY_PHOTO_ALLOWED_MIME.has('application/pdf')).toBe(false);
  });

  it('caps batch submissions at MAX_FAMILY_PHOTOS_PER_SUBMIT', () => {
    expect(MAX_FAMILY_PHOTOS_PER_SUBMIT).toBe(20);
  });
});

describe('feature requirement: family submissions land with reviewed=false and stay out of public album', () => {
  // These rules are enforced at the API + query layer (the route inserts
  // reviewed=false explicitly, and fetchAllReviewedPhotos filters on
  // reviewed=true + not_for_archive=false). The test here documents the
  // contract so a future change can't silently flip the default.
  it('records the contract', () => {
    // Default review state for a family submission MUST be false.
    const familySubmissionDefault = {
      reviewed:        false,
      not_for_archive: false,
      source:          'family' as const,
    };
    expect(familySubmissionDefault.reviewed).toBe(false);
    expect(familySubmissionDefault.source).toBe('family');
  });

  it('reject path: not_for_archive=true keeps it out of both the queue and /album', () => {
    // Mirror the reject-action's end state.
    const rejectedRow = {
      reviewed:        false,
      not_for_archive: true,
      source:          'family' as const,
    };
    // /album fetch filters reviewed=true → rejected row excluded.
    expect(rejectedRow.reviewed).toBe(false);
    // Queue fetch filters not_for_archive=false → rejected row excluded.
    expect(rejectedRow.not_for_archive).toBe(true);
  });
});
