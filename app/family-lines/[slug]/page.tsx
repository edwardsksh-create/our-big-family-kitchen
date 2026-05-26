import { ExternalLink } from 'lucide-react';
import { notFound } from 'next/navigation';
import { FAMILY_LINES, familyLineBySlug, FAMILY_TEXT } from '@/lib/family-lines';
import { fetchFederatedCount } from '@/lib/queries/federated';
import { fetchPublishedRecipesForFamilyLine } from '@/lib/queries/recipes';
import { fetchContributorsForFamilyLine } from '@/lib/queries/contributors';
import { NativeRecipeGrid } from '@/components/native-recipe-card';
import { cn } from '@/lib/utils';

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
  return { title: line ? `${line.name} family recipes` : 'Family line' };
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

  const memberNames = [
    ...contributors.primary.map((c) => c.name),
    ...contributors.secondary.map((c) => c.name),
  ];
  const uniqueNames = [...new Set(memberNames)].sort();
  const colorClass = FAMILY_TEXT[line.color];

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">Family line</p>
      <h1 className={cn('font-serif text-5xl leading-tight md:text-6xl', colorClass)}>
        {line.name} family recipes
      </h1>
      <p className="mt-6 max-w-prose text-lg text-ink-soft">
        A collection of recipes connected to this branch of the family.
      </p>

      <p className="mt-8 max-w-prose text-base text-ink-soft">
        <span className="label mr-2 text-ink-soft">People included here:</span>
        {uniqueNames.length > 0 ? uniqueNames.join(', ') : 'Members coming soon.'}
      </p>

      {/* Recipes from this line */}
      <section className="mt-16">
        <h2 className={cn('font-serif text-3xl md:text-4xl', colorClass)}>
          Recipes from this line
        </h2>
        {native.length > 0 ? (
          <div className="mt-6">
            <NativeRecipeGrid recipes={native} />
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-rule p-12 text-center">
            <p className="font-serif italic text-2xl text-ink-soft">No recipes yet.</p>
            <p className="mt-2 text-sm text-ink-soft">
              The first {line.name} recipes will appear here as they’re added.
            </p>
          </div>
        )}
      </section>

      {/* Federated banner — Leusch only */}
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
    </div>
  );
}
