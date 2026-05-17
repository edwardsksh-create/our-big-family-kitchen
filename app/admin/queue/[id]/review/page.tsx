import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { fetchFormOptions } from '@/lib/recipes/form-options';
import { fetchRecipeForEdit } from '@/lib/recipes/fetch-for-edit';
import { RecipeForm } from '@/components/recipe-form';

export const metadata = { title: 'Review recipe' };
export const dynamic  = 'force-dynamic';

export default async function AdminReviewPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) redirect(`/sign-in?next=/admin/queue/${params.id}/review`);
  if (session.user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-prose px-6 py-16 text-center">
        <p className="label mb-3">Admin</p>
        <h1 className="font-serif text-3xl text-ink">Admins only.</h1>
        <p className="mt-2 text-ink-soft">This page is just for Kate.</p>
      </div>
    );
  }

  const [forEdit, options] = await Promise.all([
    fetchRecipeForEdit(params.id),
    fetchFormOptions(session.user.email),
  ]);
  if (!forEdit) notFound();

  const statusLabel: Record<typeof forEdit.status, string> = {
    draft:          'Draft',
    pending_review: 'Pending review',
    published:      'Published',
    rejected:       'Rejected',
  };

  return (
    <div className="mx-auto max-w-page px-6 py-12">
      <p className="label mb-3">
        <Link href="/admin/queue" className="hover:text-primary">Admin queue</Link>
        {' · '}
        Review
      </p>
      <h1 className="font-serif text-3xl text-ink md:text-4xl">Review recipe</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Current status: <span className="font-serif italic">{statusLabel[forEdit.status]}</span>
      </p>

      <RecipeForm
        options={options}
        initial={forEdit.draft}
        isAdmin
        mode="admin_review"
      />
    </div>
  );
}
