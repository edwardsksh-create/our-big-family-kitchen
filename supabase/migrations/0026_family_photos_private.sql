-- Make the family-photos bucket PRIVATE.
--
-- The /album gallery it backs is sign-in-only, but 0017 created the bucket
-- public with a world-readable policy — so unreviewed uploads and "deleted"
-- rejections were fetchable by anyone holding a URL. Serving now goes
-- through short-lived signed URLs generated server-side for each render
-- (lib/storage/photos.ts → familyPhotoSignedUrls). The service-role key
-- bypasses RLS, so uploads/rotation/deletion keep working with no policy.

update storage.buckets set public = false where id = 'family-photos';

drop policy if exists "family-photos public read" on storage.objects;
