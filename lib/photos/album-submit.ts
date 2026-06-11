// Permission + size constants for /album family-submitted uploads.
// Pure values so they're unit-testable and can be referenced from the API
// endpoint and the client UI without dragging in server-only deps.

export type AlbumUploadViewer = {
  isSignedIn:    boolean;
  contributorId: string | null;
  canSignIn:     boolean;
};

export const SIGNED_OUT_ALBUM_VIEWER: AlbumUploadViewer = {
  isSignedIn:    false,
  contributorId: null,
  canSignIn:     false,
};

/** Per the family-photos bucket policy (migration 0017): 15MB cap per file. */
export const MAX_FAMILY_PHOTO_BYTES = 15 * 1024 * 1024;

/** Image types the family-photos bucket accepts. */
export const FAMILY_PHOTO_ALLOWED_MIME = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
]);

/** Hard cap on photos per submission to keep one POST sane. */
export const MAX_FAMILY_PHOTOS_PER_SUBMIT = 20;

/**
 * Who can upload to /album? Signed-in family members with can_sign_in=true.
 * Signed-out visitors and view-only stub accounts cannot. (Admin counts —
 * they're a contributor too.)
 */
export function canUploadToAlbum(viewer: AlbumUploadViewer): boolean {
  if (!viewer.isSignedIn) return false;
  if (!viewer.contributorId) return false;
  return viewer.canSignIn;
}
