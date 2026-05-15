import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

export const metadata = { title: 'Contributors' };
export const revalidate = 60;

export default async function ContributorsPage() {
  const db = supabaseAdmin();
  const { data: contributors } = await db
    .from('contributors')
    .select('id, email, name, bio, role')
    .neq('role', 'viewer')
    .order('joined_at', { ascending: true, nullsFirst: false });

  const items = contributors ?? [];

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">Contributors</p>
      <h1 className="font-serif text-4xl text-ink md:text-5xl">The cooks</h1>
      <p className="mt-3 max-w-prose text-ink-soft">
        Everyone who has cooked, written, photographed, or remembered.
      </p>

      <ul className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => {
          const display = c.name || c.email.split('@')[0];
          const slug = slugify(display);
          return (
            <li key={c.id}>
              <Link
                href={`/contributors/${slug}`}
                className="block rounded-2xl border border-rule p-6 card-hover hover:border-ink"
              >
                <p className="font-serif text-xl text-ink">{display}</p>
                <p className="label mt-2">{c.role}</p>
                {c.bio && <p className="mt-3 text-sm text-ink-soft">{c.bio}</p>}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
