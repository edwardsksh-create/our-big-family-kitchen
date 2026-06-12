import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';
import { PrintTrigger } from '@/components/print-trigger';
import { sectionBySlug } from '@/lib/sections';
import { FAMILY } from '@/config/family';

export const dynamic = 'force-dynamic';

type RecipeRow = {
  id: string;
  title: string;
  originally_from: string | null;
  status: string;
  contributor:         { name: string | null; email: string } | null;
  primary_family_line: { name: string } | null;
  section:             { slug: string; name: string } | null;
};

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const db = supabaseAdmin();
  const { data } = await db
    .from('recipes')
    .select('title')
    .eq('slug', params.slug)
    .maybeSingle();
  return { title: data?.title ? `${data.title} — print` : 'Print recipe' };
}

export default async function RecipePrintPage({ params }: { params: { slug: string } }) {
  const db = supabaseAdmin();
  const { data } = await db
    .from('recipes')
    .select(`
      id, title, originally_from, status,
      contributor:contributors!recipes_contributor_id_fkey ( name, email ),
      primary_family_line:family_lines!recipes_primary_family_line_id_fkey ( name ),
      section:sections!recipes_section_id_fkey ( slug, name )
    `)
    .eq('slug', params.slug)
    .maybeSingle();

  const recipe = data as RecipeRow | null;
  if (!recipe) notFound();
  if (recipe.status !== 'published') notFound();

  const [{ data: ingredients }, { data: instructions }] = await Promise.all([
    db.from('ingredients').select('sub_header, item_text, sort_order').eq('recipe_id', recipe.id).order('sort_order'),
    db.from('instructions').select('sub_header, body, sort_order').eq('recipe_id', recipe.id).order('sort_order'),
  ]);

  const contributorName = recipe.contributor?.name || recipe.contributor?.email.split('@')[0] || null;
  // Two columns for ingredient lists longer than 15 lines.
  const useTwoColumns = (ingredients ?? []).length > 15;
  const sectionDisplayName = recipe.section
    ? (sectionBySlug(recipe.section.slug)?.name ?? recipe.section.name)
    : null;

  return (
    <>
      <PrintTrigger />
      <div className="print-page mx-auto max-w-prose px-6 py-12 print:px-0 print:py-0">
        {/* Screen-only return link — hidden when printing. */}
        <p className="mb-6 text-sm print:hidden">
          <Link href={`/recipes/${params.slug}`} className="font-serif italic text-ink-soft hover:text-primary">
            ← Back to the recipe
          </Link>
        </p>

        <header className="print-header">
          <h1 className="font-serif text-4xl leading-tight text-primary md:text-5xl print:text-3xl">
            {recipe.title}
          </h1>

          <p className="mt-2 text-sm text-ink-soft print:mt-1">
            {contributorName && <>By {contributorName}</>}
            {recipe.originally_from && (
              <>{contributorName ? ' · ' : ''}Originally from {recipe.originally_from}</>
            )}
          </p>

          {(recipe.primary_family_line || sectionDisplayName) && (
            <p className="mt-1 text-xs italic text-ink-soft">
              {recipe.primary_family_line?.name}
              {recipe.primary_family_line && sectionDisplayName && ' · '}
              {sectionDisplayName}
            </p>
          )}
        </header>

        <section className="recipe-ingredients mt-8 print:mt-6">
          <h2 className="font-serif text-2xl text-ink print:text-xl">Ingredients</h2>
          <ul
            className={
              'mt-3 space-y-0.5 text-ink ' +
              (useTwoColumns ? 'print:columns-2 print:gap-6' : '')
            }
          >
            {(ingredients ?? []).map((i, idx, arr) => {
              const showSub = !!i.sub_header && i.sub_header !== arr[idx - 1]?.sub_header;
              return (
                <li key={idx} className="print-keep">
                  {showSub && (
                    <p className="mt-3 font-serif text-base italic text-primary print:mt-2">
                      {i.sub_header}
                    </p>
                  )}
                  <span>{i.item_text}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="recipe-instructions mt-8 print:mt-6">
          <h2 className="font-serif text-2xl text-ink print:text-xl">Method</h2>
          {(instructions ?? []).length === 0 ? (
            <p className="mt-3 italic text-ink-soft">Method not documented.</p>
          ) : (
            <ol className="mt-3 list-decimal space-y-3 pl-5 text-ink">
              {(instructions ?? []).map((i, idx, arr) => {
                const showSub = !!i.sub_header && i.sub_header !== arr[idx - 1]?.sub_header;
                return (
                  <li key={idx} className="print-keep">
                    {showSub && (
                      <p className="mb-1 -ml-5 font-serif text-base italic text-primary">{i.sub_header}</p>
                    )}
                    <span>{i.body}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <footer className="print-footer mt-12 text-center text-xs italic text-ink-soft print:mt-8">
          From {FAMILY.siteName} · {FAMILY.domain}
        </footer>
      </div>
    </>
  );
}
