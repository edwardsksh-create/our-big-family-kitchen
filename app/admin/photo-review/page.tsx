import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import {
  fetchFirstUnreviewedPhoto,
  fetchMostRecentlyReviewedPhoto,
  fetchPhotoReviewProgress,
  fetchAllPeopleForPicker,
  fetchAllRecipesForPicker,
  fetchOccasionTypes,
} from '@/lib/queries/family-photos';
import { PhotoReviewForm } from '@/components/admin/photo-review-form';

export const metadata = { title: 'Photo review' };
export const dynamic   = 'force-dynamic';

export default async function PhotoReviewPage() {
  const session = await auth();
  if (!session?.user) redirect('/sign-in?next=/admin/photo-review');
  if (session.user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-prose px-6 py-16">
        <h1 className="font-serif text-3xl text-ink">Admin only.</h1>
        <p className="mt-4 text-ink-soft">This screen is for Kate's review of family photos.</p>
      </div>
    );
  }

  const [photo, previous, progress, occasions, people, recipes] = await Promise.all([
    fetchFirstUnreviewedPhoto(),
    fetchMostRecentlyReviewedPhoto(),
    fetchPhotoReviewProgress(),
    fetchOccasionTypes(),
    fetchAllPeopleForPicker(),
    fetchAllRecipesForPicker(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <p className="label mb-1">Admin</p>
          <h1 className="font-serif text-3xl text-ink">Photo review</h1>
        </div>
        <p className="text-sm text-ink-soft">
          {progress.reviewed} of {progress.total} reviewed
          {progress.remaining > 0 && <> · {progress.remaining} remaining</>}
        </p>
      </header>

      {!photo ? (
        <div className="rounded-2xl border border-dashed border-rule p-12 text-center">
          <p className="font-serif italic text-2xl text-ink-soft">All caught up.</p>
          <p className="mt-2 text-sm text-ink-soft">No unreviewed photos left.</p>
          <p className="mt-6">
            <Link href="/admin" className="btn-ghost">← Back to admin</Link>
          </p>
        </div>
      ) : (
        <>
          <figure className="mb-8 overflow-hidden rounded-2xl border border-rule bg-paper">
            <div className="relative" style={{ aspectRatio: '4/3' }}>
              <Image
                src={photo.public_url}
                alt={photo.caption ?? 'Family photo'}
                fill
                priority
                sizes="(min-width: 768px) 800px, 100vw"
                className="object-contain"
              />
            </div>
          </figure>

          <PhotoReviewForm
            photo={photo}
            previous={previous}
            occasions={occasions}
            people={people}
            recipes={recipes}
          />
        </>
      )}
    </div>
  );
}
