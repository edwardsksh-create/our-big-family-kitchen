import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { fetchFormOptions } from '@/lib/recipes/form-options';
import { AddViaUrl } from '@/components/add/add-via-url';

export const metadata = { title: 'Add from a URL' };

export default async function UrlPage() {
  const session = await auth();
  if (!session?.user) redirect('/sign-in?next=/add/url');
  const options = await fetchFormOptions(session.user.email);
  const isAdmin = session.user.role === 'admin';
  return (
    <div className="mx-auto max-w-page px-6 py-12">
      <p className="label mb-3">Add → From a URL</p>
      <h1 className="font-serif text-3xl text-ink md:text-4xl">Add from a URL</h1>
      <p className="mt-3 max-w-prose text-ink-soft">
        Paste a recipe link — we’ll pull the title, ingredients, and steps. Works
        best for sites with structured recipe data (NYT Cooking, Smitten Kitchen,
        Serious Eats, most food blogs).
      </p>
      <AddViaUrl options={options} isAdmin={isAdmin} />
    </div>
  );
}
