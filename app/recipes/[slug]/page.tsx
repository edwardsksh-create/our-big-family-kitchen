import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const db = supabaseAdmin();
  const { data } = await db
    .from('recipes')
    .select('title')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .maybeSingle();
  return { title: data?.title ?? 'Recipe' };
}

export default async function RecipePage({ params }: { params: { slug: string } }) {
  const db = supabaseAdmin();

  const { data: recipe } = await db
    .from('recipes')
    .select(`
      id, title, slug, story, originally_from, published_at,
      contributor:contributors!recipes_contributor_id_fkey ( id, name, email ),
      primary_family_line:family_lines!recipes_primary_family_line_id_fkey   ( slug, name ),
      secondary_family_line:family_lines!recipes_secondary_family_line_id_fkey ( slug, name ),
      section:sections!recipes_section_id_fkey ( slug, name )
    `)
    .eq('slug', params.slug)
    .eq('status', 'published')
    .maybeSingle();

  if (!recipe) notFound();

  const [{ data: ingredients }, { data: instructions }] = await Promise.all([
    db.from('ingredients').select('sub_header, item_text, sort_order').eq('recipe_id', recipe.id).order('sort_order'),
    db.from('instructions').select('sub_header, body, sort_order').eq('recipe_id', recipe.id).order('sort_order'),
  ]);

  return (
    <article className="mx-auto max-w-prose px-6 py-16">
      <p className="label mb-3">{(recipe as any).section?.name}</p>
      <h1 className="font-serif text-4xl text-ink md:text-5xl">{recipe.title}</h1>

      {recipe.story && (
        <div className="prose-body mt-6 font-serif italic text-ink-soft">{recipe.story}</div>
      )}

      <section className="mt-10">
        <h2 className="font-serif text-2xl text-ink">Ingredients</h2>
        <ul className="mt-4 space-y-1 text-ink-soft">
          {ingredients?.map((i, idx) => (
            <li key={idx}>{i.item_text}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl text-ink">Method</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-ink-soft">
          {instructions?.map((i, idx) => (
            <li key={idx}>{i.body}</li>
          ))}
        </ol>
      </section>
    </article>
  );
}
