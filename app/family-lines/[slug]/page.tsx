import { notFound } from 'next/navigation';
import { FAMILY_LINES, familyLineBySlug } from '@/lib/family-lines';
import { fetchAllFederatedRecipes, groupBySection } from '@/lib/queries/federated';
import { FederatedRecipesBySection } from '@/components/federated-recipe-list';

export const revalidate = 300;

export function generateStaticParams() {
  return FAMILY_LINES.map((f) => ({ slug: f.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const line = familyLineBySlug(params.slug);
  return { title: line ? `The ${line.name} family` : 'Family line' };
}

export default async function FamilyLinePage({ params }: { params: { slug: string } }) {
  const line = familyLineBySlug(params.slug);
  if (!line) notFound();

  const showFederation = line.slug === 'leusch';
  const groups = showFederation
    ? groupBySection(await fetchAllFederatedRecipes())
    : [];

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">{line.type === 'primary' ? 'Family line' : 'Recently joined'}</p>
      <h1 className="font-serif text-5xl leading-tight text-ink md:text-6xl">
        The {line.name} family
      </h1>
      <p className="mt-6 max-w-prose text-lg text-ink-soft">{line.blurb}</p>

      {showFederation && groups.length > 0 ? (
        <div className="mt-20">
          <FederatedRecipesBySection
            groups={groups}
            heading="From Aunt Laura’s 2003 cookbook"
            subheading="Every recipe links out to leuschfamilyrecipes.com, where the full text and scans live."
          />
        </div>
      ) : (
        <section className="mt-16">
          <h2 className="font-serif text-2xl text-ink">Recipes</h2>
          <div className="mt-6 rounded-2xl border border-dashed border-rule p-12 text-center">
            <p className="font-serif italic text-2xl text-ink-soft">No recipes yet.</p>
            <p className="mt-2 text-sm text-ink-soft">
              The first {line.name} recipes will appear here as they’re added.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
