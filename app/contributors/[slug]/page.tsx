import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchContributorBySlug } from '@/lib/queries/contributors';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { NativeRecipeSummary } from '@/lib/queries/recipes';
import { NativeRecipeGrid } from '@/components/native-recipe-card';
import { SECTIONS, SECTION_HEADING_TEXT } from '@/lib/sections';
import { contributorPhotoUrl } from '@/lib/storage/photos';
import { cn } from '@/lib/utils';

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

  const heroPhotoUrl = contributor.hero_photo_path
    ? contributorPhotoUrl(contributor.hero_photo_path)
    : null;

  return (
    <div className="mx-auto max-w-prose px-6 py-16">
      {heroPhotoUrl && (
        <figure className="mb-10 overflow-hidden rounded-2xl border border-rule">
          <Image
            src={heroPhotoUrl}
            alt={contributor.name}
            width={1200}
            height={1200}
            sizes="(min-width: 768px) 600px, 100vw"
            className="h-auto w-full"
          />
        </figure>
      )}
      <p className="label mb-3">Contributor</p>
      <h1 className="font-serif text-4xl text-ink md:text-5xl">{contributor.name}</h1>

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
        <p className="mt-8 font-serif italic text-ink-soft">A bio is on the way.</p>
      )}

      <h2 className="font-serif mt-16 text-2xl text-ink">Recipes</h2>
      {recipes.length === 0 ? (
        <p className="mt-3 font-serif italic text-ink-soft">No recipes published yet.</p>
      ) : (
        <div className="mt-8 space-y-12">
          {SECTIONS.map((section) => {
            const inSection = recipes.filter((r) => r.section_slug === section.slug);
            if (inSection.length === 0) return null;
            return (
              <section key={section.slug}>
                <h3
                  className={cn(
                    'font-serif text-2xl md:text-3xl',
                    SECTION_HEADING_TEXT[section.color],
                  )}
                >
                  {section.name}
                </h3>
                <p className="label mt-1 text-ink-soft">
                  {inSection.length} {inSection.length === 1 ? 'recipe' : 'recipes'}
                </p>
                <div className="mt-5">
                  <NativeRecipeGrid recipes={inSection} />
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
