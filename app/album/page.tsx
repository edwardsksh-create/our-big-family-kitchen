import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AlbumClient } from '@/components/album-client';
import { fetchAllReviewedPhotos, fetchOccasionTypes } from '@/lib/queries/family-photos';

export const metadata = { title: 'Family archive' };
export const revalidate = 60;

export default async function AlbumPage() {
  const session = await auth();
  if (!session?.user) redirect('/sign-in?next=/album');

  const [photos, occasions] = await Promise.all([
    fetchAllReviewedPhotos(),
    fetchOccasionTypes(),
  ]);

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">Family archive</p>
      <h1 className="font-serif text-4xl leading-tight text-ink md:text-5xl">
        The kitchen across decades.
      </h1>
      <p className="mt-4 max-w-prose text-lg text-ink-soft">
        Photos of us cooking, gathering, and celebrating. Tap any photo to see
        who’s in it and what we were doing.
      </p>

      <div className="mt-12">
        {photos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-rule p-12 text-center">
            <p className="font-serif italic text-2xl text-ink-soft">
              The archive is being tagged.
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              Photos will appear here as Kate reviews and tags them.
            </p>
          </div>
        ) : (
          <AlbumClient photos={photos} occasions={occasions} />
        )}
      </div>
    </div>
  );
}
