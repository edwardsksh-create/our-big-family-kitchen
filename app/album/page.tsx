import { auth } from '@/auth';
import { AlbumClient } from '@/components/album-client';
import { AlbumUploadButton } from '@/components/album-upload-button';
import {
  fetchAllPeopleForPicker,
  fetchOccasionTypes,
  fetchReviewedPhotoById,
  fetchReviewedPhotoCount,
  fetchReviewedPhotosPage,
  type PickerPerson,
} from '@/lib/queries/family-photos';
import { supabaseAdmin } from '@/lib/supabase/server';

export const metadata = { title: 'Family archive' };
// Per-request because the upload affordance depends on the signed-in viewer's
// can_sign_in flag, which doesn't fit the static ISR model.
export const dynamic = 'force-dynamic';

export default async function AlbumPage({
  searchParams,
}: {
  searchParams: { photo?: string };
}) {
  // The album is publicly viewable — no sign-in wall. A session, when present,
  // only unlocks the write affordances (upload, comment, edit); anonymous
  // visitors get a read-only grid. It stays out of robots/sitemap so it's
  // public-by-link rather than crawlable (see app/robots.ts).
  const session = await auth();
  const viewerEmail = session?.user?.email ?? null;

  // Deep link from recipe / contributor photo strips: /album?photo=<id>
  // opens the lightbox on that photo. Bad or stale ids fall through to the
  // plain grid (AlbumClient ignores ids that aren't in the reviewed set).
  const initialPhotoId = searchParams.photo?.trim() || null;

  const db = supabaseAdmin();
  // First page only — the client streams the rest in the background, so the
  // archive can grow past four digits without the page paying for all of it
  // up front.
  const [viewer, photos, totalCount, occasions] = await Promise.all([
    viewerEmail
      ? db
          .from('contributors')
          .select('id, can_sign_in, can_edit_photos')
          .ilike('email', viewerEmail)
          .maybeSingle()
          .then(({ data }) => data)
      : Promise.resolve(null),
    fetchReviewedPhotosPage(0),
    fetchReviewedPhotoCount(),
    fetchOccasionTypes(),
  ]);

  // A deep-linked photo may live past the first page; fetch it directly so
  // the lightbox opens immediately instead of waiting for its page to stream.
  const extraPhoto =
    initialPhotoId && !photos.some((p) => p.id === initialPhotoId)
      ? await fetchReviewedPhotoById(initialPhotoId)
      : null;

  const canUpload = !!viewer?.can_sign_in;
  const isAdmin = session?.user?.role === 'admin';
  const canEditPhotos = isAdmin || !!viewer?.can_edit_photos;
  // The people picker is only needed by photo editors; spare everyone
  // else the payload.
  const people: PickerPerson[] = canEditPhotos ? await fetchAllPeopleForPicker() : [];
  const commentViewer = viewer
    ? { isAdmin, contributorId: viewer.id, canSignIn: !!viewer.can_sign_in }
    : null;

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="label mb-3">Family album</p>
          <h1 className="font-serif text-4xl leading-tight text-ink md:text-5xl">
            The kitchen across decades.
          </h1>
        </div>
        {canUpload && <AlbumUploadButton />}
      </div>

      <p className="mt-4 max-w-prose text-lg text-ink-soft">
        Photos of us cooking, gathering, and celebrating. Tap any photo to see
        who&rsquo;s in it and what we were doing.
      </p>

      <div className="mt-12">
        {photos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-rule p-12 text-center">
            <p className="font-serif italic text-2xl text-ink-soft">
              The first photos are on their way.
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              Check back soon.
            </p>
          </div>
        ) : (
          <AlbumClient
            photos={photos}
            totalCount={totalCount}
            extraPhoto={extraPhoto}
            occasions={occasions}
            initialPhotoId={initialPhotoId}
            isAdmin={isAdmin}
            canEditPhotos={canEditPhotos}
            people={people}
            viewer={commentViewer}
          />
        )}
      </div>
    </div>
  );
}
