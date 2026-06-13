import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import {
  fetchUnreviewedPhotoById,
  fetchAllUnreviewedPhotos,
  fetchMostRecentlyReviewedPhoto,
  fetchPhotoReviewProgress,
  fetchPhotoReviewSourceCounts,
  fetchAllPeopleForPicker,
  fetchAllRecipesForPicker,
  fetchOccasionTypes,
  countPhotosNeedingEditing,
} from '@/lib/queries/family-photos';
import { PhotoReviewForm } from '@/components/admin/photo-review-form';
import { FAMILY } from '@/config/family';

export const metadata = { title: 'Photo review' };
export const dynamic   = 'force-dynamic';

export default async function PhotoReviewPage({
  searchParams,
}: {
  searchParams: { source?: string; photo?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect('/sign-in?next=/admin/photo-review');
  if (session.user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-prose px-6 py-16">
        <h1 className="font-serif text-3xl text-ink">Admin only.</h1>
        <p className="mt-4 text-ink-soft">This screen is for {FAMILY.adminName}’s review of family photos.</p>
      </div>
    );
  }

  const filterSource: 'family' | null = searchParams.source === 'family' ? 'family' : null;

  // ?photo= jumps the queue to a chosen photo (from the picker grid below);
  // a stale id falls back to queue order.
  const requested = searchParams.photo
    ? await fetchUnreviewedPhotoById(searchParams.photo)
    : null;

  const [queue, previous, progress, sourceCounts, occasions, people, recipes, flaggedCount] = await Promise.all([
    fetchAllUnreviewedPhotos(filterSource ? { source: filterSource } : undefined),
    fetchMostRecentlyReviewedPhoto(),
    fetchPhotoReviewProgress(),
    fetchPhotoReviewSourceCounts(),
    fetchOccasionTypes(),
    fetchAllPeopleForPicker(),
    fetchAllRecipesForPicker(),
    countPhotosNeedingEditing(),
  ]);
  const photo = requested ?? queue[0] ?? null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <p className="label mb-1">Admin</p>
          <h1 className="font-serif text-3xl text-ink">Photo review</h1>
        </div>
        <div className="text-right text-sm text-ink-soft">
          <p>
            {progress.reviewed} of {progress.total} reviewed
            {progress.remaining > 0 && <> · {progress.remaining} remaining</>}
          </p>
          {flaggedCount > 0 && (
            <p className="mt-1">
              <Link href="/admin/photos/needs-editing" className="font-serif italic hover:text-primary">
                {flaggedCount} flagged for editing →
              </Link>
            </p>
          )}
        </div>
      </header>

      {/* Queue filter — lets Kate batch through family submissions without
          interleaving them with archive imports. */}
      <nav className="mb-6 flex flex-wrap items-center gap-2" data-no-print>
        <Link
          href="/admin/photo-review"
          className={
            'rounded-full border px-3 py-1.5 font-sans text-sm transition-colors ' +
            (filterSource === null
              ? 'border-ink bg-ink text-paper'
              : 'border-rule bg-paper text-ink hover:border-ink')
          }
        >
          All ({sourceCounts.all})
        </Link>
        <Link
          href="/admin/photo-review?source=family"
          className={
            'rounded-full border px-3 py-1.5 font-sans text-sm transition-colors ' +
            (filterSource === 'family'
              ? 'border-ink bg-ink text-paper'
              : 'border-rule bg-paper text-ink hover:border-ink')
          }
        >
          Family submissions ({sourceCounts.family})
        </Link>
      </nav>

      {!photo ? (
        <div className="rounded-2xl border border-dashed border-rule p-12 text-center">
          <p className="font-serif italic text-2xl text-ink-soft">All caught up.</p>
          <p className="mt-2 text-sm text-ink-soft">No unreviewed photos left.</p>
          <p className="mt-6">
            <Link href="/admin" className="btn-ghost">← Back to admin</Link>
          </p>
        </div>
      ) : (
        <PhotoReviewForm
          photo={photo}
          previous={previous}
          occasions={occasions}
          people={people}
          recipes={recipes}
          filterSource={filterSource}
        />
      )}

      {/* The waiting queue, browsable — tap any photo to review it next
          instead of taking them strictly in order. */}
      {queue.length > 1 && (
        <section className="mt-14">
          <p className="label mb-4 text-ink-soft">
            Waiting in the queue ({queue.length}) — tap any photo to jump to it
          </p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {queue.map((p) => {
              const isCurrent = photo?.id === p.id;
              const href = `/admin/photo-review?photo=${p.id}${filterSource ? '&source=family' : ''}`;
              return (
                <li key={p.id}>
                  <Link
                    href={href}
                    aria-current={isCurrent ? 'true' : undefined}
                    className={
                      'block overflow-hidden rounded-xl border ' +
                      (isCurrent
                        ? 'border-ink ring-2 ring-ink ring-offset-2 ring-offset-paper'
                        : 'border-rule hover:border-ink')
                    }
                  >
                    <div className="relative aspect-square w-full">
                      <Image
                        src={p.public_url}
                        alt={p.caption ?? 'Waiting photo'}
                        fill
                        sizes="(min-width: 768px) 16vw, 33vw"
                        className="object-cover"
                        loading="lazy"
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
