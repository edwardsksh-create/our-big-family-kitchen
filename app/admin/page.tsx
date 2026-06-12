import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { fetchPhotoReviewProgress, countPhotosNeedingEditing } from '@/lib/queries/family-photos';

export const metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

// The admin's front hall — one place for the working tools, so the top nav
// stays clean (it shows a single "Admin" entry, admin-only).
export default async function AdminHomePage() {
  const session = await auth();
  if (!session?.user) redirect('/sign-in?next=/admin');
  if (session.user.role !== 'admin') redirect('/');

  const db = supabaseAdmin();
  const [{ count: pendingRecipes }, photoProgress, flagged] = await Promise.all([
    db.from('recipes').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
    fetchPhotoReviewProgress(),
    countPhotosNeedingEditing(),
  ]);

  const tools = [
    {
      href: '/admin/queue',
      title: 'Recipe queue',
      note: pendingRecipes
        ? `${pendingRecipes} waiting for review`
        : 'Nothing waiting',
    },
    {
      href: '/admin/photo-review',
      title: 'Photo review',
      note: photoProgress.remaining
        ? `${photoProgress.remaining} photos to review`
        : 'All caught up',
    },
    {
      href: '/admin/contributors',
      title: 'People',
      note: 'Contributors, invitations, publish rights',
    },
  ];

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">Admin</p>
      <h1 className="font-serif text-4xl text-ink md:text-5xl">The back kitchen.</h1>

      <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              className="group block min-h-[140px] rounded-2xl border border-rule bg-paper p-6 card-hover hover:border-ink hover:shadow-[0_12px_40px_-20px_rgba(42,37,34,0.35)]"
            >
              <h2 className="font-serif text-2xl text-ink group-hover:text-primary">{t.title}</h2>
              <p className="mt-2 text-sm text-ink-soft">{t.note}</p>
            </Link>
          </li>
        ))}
      </ul>

      {flagged > 0 && (
        <p className="mt-8 text-sm italic text-ink-soft">
          <Link href="/admin/photos/needs-editing" className="hover:text-primary">
            {flagged} photos still carry the old “needs editing” flag →
          </Link>
        </p>
      )}
    </div>
  );
}
