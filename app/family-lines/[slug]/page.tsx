import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FAMILY_LINES, familyLineBySlug } from '@/lib/family-lines';
import { fetchAllFederatedRecipes, groupBySection } from '@/lib/queries/federated';
import { fetchPublishedRecipesForFamilyLine } from '@/lib/queries/recipes';
import { fetchContributorsForFamilyLine } from '@/lib/queries/contributors';
import { FederatedRecipesBySection } from '@/components/federated-recipe-list';
import { NativeRecipeGrid } from '@/components/native-recipe-card';

export const revalidate = 60;

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
  const [native, contributors, federatedGroups] = await Promise.all([
    fetchPublishedRecipesForFamilyLine(line.slug),
    fetchContributorsForFamilyLine(line.slug),
    showFederation ? fetchAllFederatedRecipes().then(groupBySection) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">{line.type === 'primary' ? 'Family line' : 'Recently joined'}</p>
      <h1 className="font-serif text-5xl leading-tight text-ink md:text-6xl">
        The {line.name} family
      </h1>
      <p className="mt-6 max-w-prose text-lg text-ink-soft">{line.blurb}</p>

      {/* Native recipes for this line */}
      {native.length > 0 && (
        <section className="mt-16">
          <p className="label">Recipes from our families</p>
          <h2 className="font-serif mt-2 text-2xl text-ink">
            {native.length} {native.length === 1 ? 'recipe' : 'recipes'}
          </h2>
          <div className="mt-6">
            <NativeRecipeGrid recipes={native} />
          </div>
        </section>
      )}

      {/* Family members */}
      {contributors.length > 0 && (
        <section className="mt-16">
          <p className="label">Family</p>
          <h2 className="font-serif mt-2 text-2xl text-ink">Contributors</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {contributors.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/contributors/${c.slug}`}
                  className="block rounded-2xl border border-rule p-5 card-hover hover:border-ink"
                >
                  <p className="font-serif text-lg text-ink">{c.name}</p>
                  <p className="label mt-1 text-ink-soft">{c.role}{!c.joined_at && ' · stub'}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Federated (Leusch only for now) */}
      {showFederation && federatedGroups.length > 0 && (
        <div className="mt-20">
          <FederatedRecipesBySection
            groups={federatedGroups}
            heading="From Aunt Laura’s 2003 cookbook"
            subheading="Every recipe links out to leuschfamilyrecipes.com, where the full text and scans live."
          />
        </div>
      )}

      {/* Empty state */}
      {native.length === 0 && contributors.length === 0 && !showFederation && (
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
