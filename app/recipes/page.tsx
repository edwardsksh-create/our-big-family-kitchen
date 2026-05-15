import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/server';

export const metadata = { title: 'Recipes' };
export const revalidate = 60;

export default async function RecipesIndexPage() {
  const db = supabaseAdmin();
  const { data: recipes } = await db
    .from('recipes')
    .select('id, title, slug, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(60);

  const items = recipes ?? [];

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">Recipes</p>
      <h1 className="font-serif text-4xl text-ink md:text-5xl">All recipes</h1>

      {items.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-rule p-12 text-center">
          <p className="font-serif italic text-2xl text-ink-soft">No recipes yet.</p>
          <p className="mt-2 text-sm text-ink-soft">
            The kitchen is brand-new. Check back as families start contributing.
          </p>
        </div>
      ) : (
        <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => (
            <li key={r.id}>
              <Link
                href={r.slug ? `/recipes/${r.slug}` : '#'}
                className="block rounded-2xl border border-rule p-6 hover:border-ink card-hover"
              >
                <p className="font-serif text-xl text-ink">{r.title}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
