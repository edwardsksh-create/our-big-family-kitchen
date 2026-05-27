import Image from 'next/image';
import { notFound } from 'next/navigation';
import { fetchContributorBySlug } from '@/lib/queries/contributors';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { NativeRecipeSummary } from '@/lib/queries/recipes';
import { NativeRecipeGrid } from '@/components/native-recipe-card';
import { SECTIONS, SECTION_HEADING_TEXT } from '@/lib/sections';
import { contributorPhotoUrl } from '@/lib/storage/photos';
import { formatDisplayName } from '@/lib/contributors/display-name';
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

  const heroPhotoUrl = contributor.hero_photo_path
    ? contributorPhotoUrl(contributor.hero_photo_path)
    : null;

  const displayName = formatDisplayName({
    fullName:   contributor.name,
    nickname:   contributor.nickname,
    birth_name: contributor.birth_name,
  });

  return (
    <div className="mx-auto max-w-prose px-6 py-16">
      {heroPhotoUrl && (
        <figure className="mb-8 overflow-hidden rounded-2xl border border-rule md:max-w-[280px]">
          <Image
            src={heroPhotoUrl}
            alt={contributor.name}
            width={1200}
            height={1200}
            sizes="(min-width: 768px) 280px, 80vw"
            className="h-auto w-full"
          />
        </figure>
      )}

      <h1 className="font-serif text-3xl text-ink md:text-4xl">{displayName}</h1>
      {contributor.deceased && (
        <p className="mt-2 text-sm italic text-ink-soft/70">In loving memory</p>
      )}

      {contributor.bio && (
        <div className="prose-body mt-8 text-ink-soft">{contributor.bio}</div>
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
