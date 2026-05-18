import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { fetchFormOptions } from '@/lib/recipes/form-options';
import { fetchRecipeForEdit } from '@/lib/recipes/fetch-for-edit';
import { RecipeForm } from '@/components/recipe-form';

export const metadata = { title: 'Edit recipe' };
export const dynamic  = 'force-dynamic';

export default async function EditRecipePage({ params }: { params: { slug: string } }) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect(`/sign-in?next=${encodeURIComponent(`/recipes/${params.slug}/edit`)}`);
  }

  const db = supabaseAdmin();
  const { data: recipeRow } = await db
    .from('recipes')
    .select('id, contributor_id, status')
    .eq('slug', params.slug)
    .maybeSingle();
  if (!recipeRow) notFound();

  // Resolve the signed-in user's contributor row to check ownership.
  const { data: actor } = await db
    .from('contributors')
    .select('id, role')
    .ilike('email', session.user.email)
    .maybeSingle();
  const isAdmin = actor?.role === 'admin';
  const isOwner = !!actor && actor.id === recipeRow.contributor_id;
  if (!isAdmin && !isOwner) {
    // Bounce back to the public page with a flash message.
    redirect(`/recipes/${params.slug}?msg=not_allowed`);
  }

  const [forEdit, options] = await Promise.all([
    fetchRecipeForEdit(recipeRow.id),
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
        <Link href={`/recipes/${params.slug}`} className="hover:text-primary">← Back to recipe</Link>
      </p>
      <h1 className="font-serif text-3xl text-ink md:text-4xl">Edit recipe</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Current status: <span className="font-serif italic">{statusLabel[forEdit.status]}</span>
        {!isAdmin && isOwner && (
          <span className="ml-2">· You can edit this because you’re the contributor.</span>
        )}
        {isAdmin && !isOwner && (
          <span className="ml-2">· You can edit any recipe as admin.</span>
        )}
      </p>

      <RecipeForm
        options={options}
        initial={forEdit.draft}
        isAdmin={isAdmin}
        mode="edit"
        cancelHref={`/recipes/${params.slug}`}
      />
    </div>
  );
}
