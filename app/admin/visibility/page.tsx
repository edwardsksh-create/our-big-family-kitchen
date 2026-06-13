import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getVisibility } from '@/lib/access';
import { VisibilityEditor } from '@/components/admin/visibility-editor';

export const metadata = { title: 'Visibility' };
export const dynamic = 'force-dynamic';

// Admin control for what logged-out visitors can see. Persists to
// site_settings; lib/access.ts reads it everywhere the site gates an area.
export default async function AdminVisibilityPage() {
  const session = await auth();
  if (!session?.user) redirect('/sign-in?next=/admin/visibility');
  if (session.user.role !== 'admin') redirect('/');

  const visibility = await getVisibility();

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">Admin</p>
      <h1 className="font-serif text-4xl text-ink md:text-5xl">Who can see what.</h1>
      <VisibilityEditor initial={visibility} />
    </div>
  );
}
