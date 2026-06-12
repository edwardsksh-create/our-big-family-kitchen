import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AlbumClient } from '@/components/album-client';
import { AlbumUploadButton } from '@/components/album-upload-button';
import { fetchAllReviewedPhotos, fetchOccasionTypes } from '@/lib/queries/family-photos';
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
  const session = await auth();
  if (!session?.user?.email) redirect('/sign-in?next=/album');

  // Deep link from recipe / contributor photo strips: /album?photo=<id>
  // opens the lightbox on that photo. Bad or stale ids fall through to the
  // plain grid (AlbumClient ignores ids that aren't in the reviewed set).
  const initialPhotoId = searchParams.photo?.trim() || null;

  const db = supabaseAdmin();
  const [{ data: viewer }, photos, occasions] = await Promise.all([
    db.from('contributors').select('id, can_sign_in, can_edit_photos').ilike('email', session.user.email).maybeSingle(),
    fetchAllReviewedPhotos(),
    fetchOccasionTypes(),
  ]);

  const canUpload = !!viewer?.can_sign_in;
  const isAdmin = session.user.role === 'admin';
  const canEditPhotos = isAdmin || !!viewer?.can_edit_photos;
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
            occasions={occasions}
            initialPhotoId={initialPhotoId}
            isAdmin={isAdmin}
            canEditPhotos={canEditPhotos}
            viewer={commentViewer}
          />
        )}
      </div>
    </div>
  );
}
