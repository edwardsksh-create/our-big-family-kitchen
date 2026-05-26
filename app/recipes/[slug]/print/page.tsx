import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';
import { PrintTrigger } from '@/components/print-trigger';
import { publicUrl } from '@/lib/storage/photos';
import { publicStatusNotes } from '@/lib/recipes/status-notes';
import { sectionBySlug } from '@/lib/sections';

export const dynamic = 'force-dynamic';

type RecipeRow = {
  id: string;
  title: string;
  story: string | null;
  originally_from: string | null;
  status: string;
  contributor:         { name: string | null; email: string } | null;
  primary_family_line: { name: string } | null;
  section:             { slug: string; name: string } | null;
};

type PhotoRow = {
  id: string;
  url: string | null;
  storage_path: string | null;
  caption: string | null;
  photo_type: 'source' | 'dish';
  sort_order: number;
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

export default async function RecipePrintPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { style?: string };
}) {
  const isFull = searchParams.style === 'full';
  const db = supabaseAdmin();
  const { data } = await db
    .from('recipes')
    .select(`
      id, title, story, originally_from, status,
      contributor:contributors!recipes_contributor_id_fkey ( name, email ),
      primary_family_line:family_lines!recipes_primary_family_line_id_fkey ( name ),
      section:sections!recipes_section_id_fkey ( slug, name )
    `)
    .eq('slug', params.slug)
    .maybeSingle();

  const recipe = data as RecipeRow | null;
  if (!recipe) notFound();
  if (recipe.status !== 'published') notFound();

  const [{ data: ingredients }, { data: instructions }, { data: tagJoins }, { data: photoRows }] = await Promise.all([
    db.from('ingredients').select('sub_header, item_text, sort_order').eq('recipe_id', recipe.id).order('sort_order'),
    db.from('instructions').select('sub_header, body, sort_order').eq('recipe_id', recipe.id).order('sort_order'),
    isFull
      ? db.from('recipe_tags').select('tag:tags!recipe_tags_tag_id_fkey(slug, name)').eq('recipe_id', recipe.id)
      : Promise.resolve({ data: [] as { tag: { slug: string; name: string } | null }[] }),
    isFull
      ? db.from('photos').select('id, url, storage_path, caption, photo_type, sort_order').eq('recipe_id', recipe.id).eq('photo_type', 'source').order('sort_order')
      : Promise.resolve({ data: [] as PhotoRow[] }),
  ]);

  const contributorName = recipe.contributor?.name || recipe.contributor?.email.split('@')[0] || null;
  // Two columns for ingredient lists longer than 15 lines.
  const useTwoColumns = (ingredients ?? []).length > 15;
  const sectionDisplayName = recipe.section
    ? (sectionBySlug(recipe.section.slug)?.name ?? recipe.section.name)
    : null;

  const tagSlugs = ((tagJoins ?? []) as unknown as { tag: { slug: string; name: string } | null }[])
    .map((j) => j.tag?.slug).filter(Boolean) as string[];
  const statusNotes = isFull ? publicStatusNotes(tagSlugs) : [];

  const sourcePhotos = ((photoRows ?? []) as PhotoRow[])
    .map((p) => ({ id: p.id, url: p.storage_path ? publicUrl(p.storage_path) : (p.url ?? ''), caption: p.caption }))
    .filter((p) => p.url);

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

        {isFull && statusNotes.length > 0 && (
          <div className="mt-6 space-y-3 print:mt-4">
            {statusNotes.map((note, i) => (
              <p key={i} className="rounded-xl border border-rule bg-cream/30 px-4 py-3 text-sm italic leading-relaxed text-ink-soft">
                {note}
              </p>
            ))}
          </div>
        )}

        {isFull && recipe.story && (
          <section className="prose-body recipe-story mt-6 italic text-ink-soft print:mt-4">
            <h2 className="not-italic font-serif text-xl text-ink print:text-lg">Family note</h2>
            <p className="mt-2">{recipe.story}</p>
          </section>
        )}

        <section className="recipe-ingredients mt-8 print:mt-6">
          <h2 className="font-serif text-2xl text-ink print:text-xl">Ingredients</h2>
          <ul
            className={
              'mt-3 space-y-0.5 text-ink ' +
              (useTwoColumns ? 'print:columns-2 print:gap-6' : '')
            }
          >
            {(ingredients ?? []).map((i, idx) => (
              <li key={idx} className="print-keep">
                {i.sub_header && (
                  <p className="mt-3 font-serif text-base italic text-primary print:mt-2">
                    {i.sub_header}
                  </p>
                )}
                <span>{i.item_text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="recipe-instructions mt-8 print:mt-6">
          <h2 className="font-serif text-2xl text-ink print:text-xl">Method</h2>
          {(instructions ?? []).length === 0 ? (
            <p className="mt-3 italic text-ink-soft">Method not documented.</p>
          ) : (
            <ol className="mt-3 list-decimal space-y-3 pl-5 text-ink">
              {(instructions ?? []).map((i, idx) => (
                <li key={idx} className="print-keep">
                  {i.sub_header && (
                    <p className="mb-1 -ml-5 font-serif text-base italic text-primary">{i.sub_header}</p>
                  )}
                  <span>{i.body}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {isFull && sourcePhotos.length > 0 && (
          <section className="mt-8 print:mt-6">
            <h2 className="font-serif text-2xl text-ink print:text-xl">Original page</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 print:grid-cols-1">
              {sourcePhotos.map((p, i) => (
                <li key={p.id} className="overflow-hidden rounded-2xl border border-rule print:rounded-none print:border-0">
                  <div className="relative aspect-[4/5] w-full">
                    <Image
                      src={p.url}
                      alt={p.caption || `Original page ${i + 1}`}
                      fill
                      sizes="(min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="print-footer mt-12 text-center text-xs italic text-ink-soft print:mt-8">
          From Our Big Family Kitchen · bigfamilykitchen.com
        </footer>
      </div>
    </>
  );
}
