import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { fetchFormOptions } from '@/lib/recipes/form-options';
import { AddViaPaste } from '@/components/add/add-via-paste';

export const metadata = { title: 'Paste a recipe' };

export default async function PastePage() {
  const session = await auth();
  if (!session?.user) redirect('/sign-in?next=/add/paste');
  const options = await fetchFormOptions(session.user.email);
  return (
    <div className="mx-auto max-w-page px-6 py-12">
      <p className="label mb-3">Add → Paste text</p>
      <h1 className="font-serif text-3xl text-ink md:text-4xl">Paste a recipe</h1>
      <p className="mt-3 max-w-prose text-ink-soft">
        Paste it as messy as you like. We’ll do a first pass at structuring it and
        drop you on the review screen where you can fix anything.
      </p>
      <AddViaPaste options={options} />
    </div>
  );
}
