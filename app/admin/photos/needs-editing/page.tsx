import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { fetchPhotosNeedingEditing } from '@/lib/queries/family-photos';

export const metadata = { title: 'Photos needing editing' };
export const dynamic   = 'force-dynamic';

export default async function PhotosNeedingEditingPage() {
  const session = await auth();
  if (!session?.user) redirect('/sign-in?next=/admin/photos/needs-editing');
  if (session.user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-prose px-6 py-16">
        <h1 className="font-serif text-3xl text-ink">Admin only.</h1>
      </div>
    );
  }

  const photos = await fetchPhotosNeedingEditing();

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <p className="label mb-1">Admin</p>
          <h1 className="font-serif text-3xl text-ink">Photos needing editing</h1>
        </div>
        <p className="text-sm text-ink-soft">
          {photos.length} flagged
        </p>
      </header>

      <p className="mb-8">
        <Link href="/admin/photo-review" className="font-serif italic text-ink-soft hover:text-primary">
          ← Back to photo review
        </Link>
      </p>

      {photos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-rule p-12 text-center">
          <p className="font-serif italic text-2xl text-ink-soft">Nothing flagged.</p>
          <p className="mt-2 text-sm text-ink-soft">Photos flagged during review will appear here.</p>
        </div>
      ) : (
        <ul className="space-y-6">
          {photos.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-2xl border border-rule bg-paper">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="relative aspect-[4/3] w-full shrink-0 sm:w-64">
                  <Image
                    src={p.public_url}
                    alt={p.caption ?? 'Family photo'}
                    fill
                    sizes="(min-width: 640px) 256px, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 p-4">
                  {p.caption && <p className="font-serif text-lg text-ink">{p.caption}</p>}
                  <p className="mt-1 text-sm text-ink-soft">
                    {[p.year, p.place].filter(Boolean).join(' · ') || 'No year/place yet'}
                  </p>
                  {p.editing_note && (
                    <p className="mt-3 rounded-xl border border-rule bg-cream/30 px-3 py-2 text-sm italic text-ink-soft">
                      {p.editing_note}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-ink-soft/70">
                    {p.reviewed ? 'Tagged and flagged for editing' : 'Flagged for editing (not yet tagged)'}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
