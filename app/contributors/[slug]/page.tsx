import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  return { title: params.slug.replace(/-/g, ' ') };
}

export default async function ContributorPage({ params }: { params: { slug: string } }) {
  const db = supabaseAdmin();
  const { data: contributors } = await db
    .from('contributors')
    .select('id, name, email, bio, role, joined_at');

  const contributor = (contributors ?? []).find((c) => {
    const display = c.name || c.email.split('@')[0];
    return slugify(display) === params.slug;
  });

  if (!contributor) notFound();
  const display = contributor.name || contributor.email.split('@')[0];

  return (
    <div className="mx-auto max-w-prose px-6 py-16">
      <p className="label mb-3">Contributor</p>
      <h1 className="font-serif text-4xl text-ink md:text-5xl">{display}</h1>
      <p className="label mt-3">{contributor.role}</p>

      {contributor.bio ? (
        <div className="prose-body mt-8 text-ink-soft">{contributor.bio}</div>
      ) : (
        <p className="mt-8 font-serif italic text-ink-soft">A bio is on the way.</p>
      )}

      <h2 className="font-serif mt-16 text-2xl text-ink">Recipes</h2>
      <p className="mt-2 font-serif italic text-ink-soft">None yet — first recipes coming soon.</p>
    </div>
  );
}
