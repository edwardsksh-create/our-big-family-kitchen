import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { fetchFormOptions } from '@/lib/recipes/form-options';
import { RecipeForm } from '@/components/recipe-form';
import { emptyDraft } from '@/lib/recipes/draft';

export const metadata = { title: 'Enter manually' };

export default async function ManualPage() {
  const session = await auth();
  if (!session?.user) redirect('/sign-in?next=/add/manual');
  const options = await fetchFormOptions(session.user.email);
  const draft = emptyDraft();
  if (options.currentContributor) {
    draft.contributor_id          = options.currentContributor.id;
    draft.primary_family_line_id  = options.currentContributor.primary_family_line_id ?? undefined;
  }
  return (
    <div className="mx-auto max-w-page px-6 py-12">
      <p className="label mb-3">Add → Enter manually</p>
      <h1 className="font-serif text-3xl text-ink md:text-4xl">Add a recipe</h1>
      <RecipeForm options={options} initial={draft} isAdmin={(session.user.role ?? '') === 'admin'} />
    </div>
  );
}
