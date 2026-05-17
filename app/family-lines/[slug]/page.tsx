import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { notFound } from 'next/navigation';
import { FAMILY_LINES, familyLineBySlug } from '@/lib/family-lines';
import { fetchFederatedCount } from '@/lib/queries/federated';
import { fetchPublishedRecipesForFamilyLine } from '@/lib/queries/recipes';
import { fetchContributorsForFamilyLine } from '@/lib/queries/contributors';
import { NativeRecipeGrid } from '@/components/native-recipe-card';

export const revalidate = 60;

// Slugs of family lines that have a federated mirror at leuschfamilyrecipes.com.
// For now only the Leusch line federates.
const FEDERATED_LINES: Record<string, { siteUrl: string }> = {
  leusch: { siteUrl: 'https://leuschfamilyrecipes.com' },
};

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

  const federation = FEDERATED_LINES[line.slug];
  const [native, contributors, federatedCount] = await Promise.all([
    fetchPublishedRecipesForFamilyLine(line.slug),
    fetchContributorsForFamilyLine(line.slug),
    federation ? fetchFederatedCount() : Promise.resolve(0),
  ]);

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">{line.type === 'primary' ? 'Family line' : 'Recently joined'}</p>
      <h1 className="font-serif text-5xl leading-tight text-ink md:text-6xl">
        The {line.name} family
      </h1>
      <p className="mt-6 max-w-prose text-lg text-ink-soft">{line.blurb}</p>

      {/* Native recipes for this line */}
      {native.length > 0 ? (
        <section className="mt-16">
          <p className="label">Recipes from our families</p>
          <h2 className="font-serif mt-2 text-2xl text-ink">
            {native.length} {native.length === 1 ? 'recipe' : 'recipes'}
          </h2>
          <div className="mt-6">
            <NativeRecipeGrid recipes={native} />
          </div>
        </section>
      ) : !federation && contributors.length === 0 ? (
        <section className="mt-16">
          <h2 className="font-serif text-2xl text-ink">Recipes</h2>
          <div className="mt-6 rounded-2xl border border-dashed border-rule p-12 text-center">
            <p className="font-serif italic text-2xl text-ink-soft">No recipes yet.</p>
            <p className="mt-2 text-sm text-ink-soft">
              The first {line.name} recipes will appear here as they’re added.
            </p>
          </div>
        </section>
      ) : null}

      {/* Federated banner */}
      {federation && federatedCount > 0 && (
        <section className="mt-16">
          <a
            href={federation.siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-2xl border border-rule bg-paper p-8 card-hover hover:border-ink hover:shadow-[0_12px_40px_-20px_rgba(42,37,34,0.35)] md:p-12"
          >
            <p className="font-serif italic text-primary">From Aunt Laura’s 2003 cookbook</p>
            <h2 className="font-serif mt-2 text-3xl text-ink md:text-4xl">
              {federatedCount} recipes from this family line
            </h2>
            <p className="mt-3 max-w-prose text-ink-soft">
              The Leusch archive — every recipe with its full ingredients, story,
              and scans of the original page — lives at leuschfamilyrecipes.com.
            </p>
            <span className="btn-primary mt-7 inline-flex items-center gap-2">
              Browse Aunt Laura’s cookbook
              <ExternalLink size={14} aria-hidden="true" />
            </span>
            <span className="sr-only">Opens at leuschfamilyrecipes.com in a new tab.</span>
          </a>
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
                  <p className="label mt-1 text-ink-soft">
                    {c.role}{!c.joined_at && ' · stub'}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
