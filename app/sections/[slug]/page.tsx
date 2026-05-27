import { notFound, redirect } from 'next/navigation';
import { SECTIONS, sectionBySlug, SECTION_BG, SECTION_TEXT, SECTION_BLURBS, LEGACY_SECTION_REDIRECTS } from '@/lib/sections';
import { cn } from '@/lib/utils';
import { fetchFederatedRecipesForSection } from '@/lib/queries/federated';
import { fetchPublishedRecipesForSection } from '@/lib/queries/recipes';
import { FederatedRecipeGrid } from '@/components/federated-recipe-list';
import { NativeRecipeGrid } from '@/components/native-recipe-card';

export const revalidate = 60;

export function generateStaticParams() {
  return SECTIONS.map((s) => ({ slug: s.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const section = sectionBySlug(params.slug);
  return { title: section?.name ?? 'Section' };
}

export default async function SectionPage({ params }: { params: { slug: string } }) {
  const legacyTarget = LEGACY_SECTION_REDIRECTS[params.slug];
  if (legacyTarget) redirect(`/sections/${legacyTarget}`);

  const section = sectionBySlug(params.slug);
  if (!section) notFound();

  const [federated, native] = await Promise.all([
    fetchFederatedRecipesForSection(section.slug),
    fetchPublishedRecipesForSection(section.slug),
  ]);

  return (
    <div>
      <header className={cn('w-full', SECTION_BG[section.color], SECTION_TEXT[section.color])}>
        <div className="mx-auto max-w-page px-6 py-20">
          <h1 className="font-serif text-5xl leading-tight md:text-6xl">{section.name}</h1>
          {SECTION_BLURBS[section.slug] && (
            <p
              className="mt-6 max-w-prose text-lg"
              style={{ color: 'inherit', opacity: 0.88 }}
            >
              {SECTION_BLURBS[section.slug]}
            </p>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-page space-y-16 px-6 py-16">
        {native.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl text-ink">{native.length} {native.length === 1 ? 'recipe' : 'recipes'}</h2>
            <div className="mt-6">
              <NativeRecipeGrid recipes={native} />
            </div>
          </section>
        )}

        {federated.length > 0 ? (
          <section>
            <h2 className="font-serif text-2xl text-ink">From Aunt Laura’s 2003 cookbook</h2>
            <p className="mt-2 max-w-prose text-sm text-ink-soft">
              {federated.length} {federated.length === 1 ? 'recipe' : 'recipes'} — each links to the full version at leuschfamilyrecipes.com.
            </p>
            <div className="mt-6">
              <FederatedRecipeGrid recipes={federated} />
            </div>
          </section>
        ) : native.length === 0 ? (
          <section>
            <h2 className="font-serif text-2xl text-ink">Recipes</h2>
            <div className="mt-6 rounded-2xl border border-dashed border-rule p-12 text-center">
              <p className="font-serif italic text-2xl text-ink-soft">No recipes yet.</p>
              <p className="mt-2 text-sm text-ink-soft">
                This section is waiting for its first recipe.
              </p>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
