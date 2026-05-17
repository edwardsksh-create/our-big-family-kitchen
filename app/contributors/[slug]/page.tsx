import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchContributorBySlug } from '@/lib/queries/contributors';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { NativeRecipeSummary } from '@/lib/queries/recipes';
import { NativeRecipeGrid } from '@/components/native-recipe-card';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const c = await fetchContributorBySlug(params.slug);
  return { title: c?.name ?? 'Contributor' };
}

export default async function ContributorPage({ params }: { params: { slug: string } }) {
  const contributor = await fetchContributorBySlug(params.slug);
  if (!contributor) notFound();

  const db = supabaseAdmin();
  const { data: recipeRows } = await db
    .from('recipes')
    .select(`
      id, slug, title, published_at,
      contributor:contributors!recipes_contributor_id_fkey ( name, email ),
      section:sections!recipes_section_id_fkey ( slug, name ),
      primary_family_line:family_lines!recipes_primary_family_line_id_fkey ( slug )
    `)
    .eq('contributor_id', contributor.id)
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  type Raw = {
    id: string;
    slug: string | null;
    title: string;
    published_at: string;
    contributor: { name: string | null; email: string } | null;
    section: { slug: string; name: string } | null;
    primary_family_line: { slug: string } | null;
  };
  const recipes: NativeRecipeSummary[] = ((recipeRows ?? []) as unknown as Raw[])
    .filter((r) => r.slug)
    .map((r) => ({
      id:              r.id,
      slug:            r.slug as string,
      title:           r.title,
      published_at:    r.published_at,
      contributor_name: r.contributor?.name ?? r.contributor?.email.split('@')[0] ?? null,
      section_slug:     r.section?.slug ?? null,
      section_name:     r.section?.name ?? null,
      primary_family_line_slug: r.primary_family_line?.slug ?? null,
    }));

  const hasLineage = contributor.primary_family_line || contributor.secondary_family_line;

  return (
    <div className="mx-auto max-w-prose px-6 py-16">
      <p className="label mb-3">Contributor</p>
      <h1 className="font-serif text-4xl text-ink md:text-5xl">{contributor.name}</h1>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="label">{contributor.role}</span>
        {!contributor.joined_at && (
          <>
            <span className="text-ink-soft">·</span>
            <span className="text-ink-soft italic">Stub — not yet signed up</span>
          </>
        )}
      </div>

      {hasLineage && (
        <dl className="mt-6 grid gap-y-2 text-sm sm:grid-cols-[140px_1fr]">
          {contributor.primary_family_line && (
            <>
              <dt className="label">Primary</dt>
              <dd>
                <Link
                  href={`/family-lines/${contributor.primary_family_line.slug}`}
                  className="font-serif text-lg text-ink hover:text-primary"
                >
                  {contributor.primary_family_line.name}
                </Link>
              </dd>
            </>
          )}
          {contributor.secondary_family_line && (
            <>
              <dt className="label">Secondary</dt>
              <dd>
                <Link
                  href={`/family-lines/${contributor.secondary_family_line.slug}`}
                  className="text-ink-soft hover:text-primary"
                >
                  {contributor.secondary_family_line.name}
                </Link>
              </dd>
            </>
          )}
        </dl>
      )}

      {contributor.bio ? (
        <div className="prose-body mt-8 text-ink-soft">{contributor.bio}</div>
      ) : (
        <p className="mt-8 font-serif italic text-ink-soft">
          {contributor.joined_at
            ? 'A bio is on the way.'
            : 'A stub profile — recipes can be attributed here even before they sign up.'}
        </p>
      )}

      <h2 className="font-serif mt-16 text-2xl text-ink">Recipes</h2>
      {recipes.length === 0 ? (
        <p className="mt-3 font-serif italic text-ink-soft">None yet.</p>
      ) : (
        <div className="mt-6">
          <NativeRecipeGrid recipes={recipes} />
        </div>
      )}
    </div>
  );
}
