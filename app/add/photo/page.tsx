import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { fetchFormOptions } from '@/lib/recipes/form-options';
import { AddViaPhoto } from '@/components/add/add-via-photo';

export const metadata = { title: 'Upload a photo' };
export const dynamic  = 'force-dynamic';

export default async function PhotoIntakePage() {
  const session = await auth();
  if (!session?.user) redirect('/sign-in?next=/add/photo');
  const options = await fetchFormOptions(session.user.email);
  const isAdmin = session.user.role === 'admin';
  return (
    <div className="mx-auto max-w-page px-6 py-12">
      <p className="label mb-3">Add → Upload a photo</p>
      <h1 className="font-serif text-3xl text-ink md:text-4xl">Upload a photo of your recipe</h1>
      <p className="mt-3 max-w-prose text-ink-soft">
        Take a photo or choose from your phone. We’ll do the rest.
      </p>
      <AddViaPhoto options={options} isAdmin={isAdmin} />
    </div>
  );
}
