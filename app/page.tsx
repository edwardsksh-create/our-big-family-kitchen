import Image from 'next/image';
import Link from 'next/link';
import { SECTIONS } from '@/lib/sections';
import { SectionCard } from '@/components/section-card';
import { NativeRecipeGrid } from '@/components/native-recipe-card';
import { fetchFederatedCount } from '@/lib/queries/federated';
import { fetchRecentPublishedRecipes } from '@/lib/queries/recipes';

export const revalidate = 60;

export default async function HomePage() {
  const [federatedCount, recent] = await Promise.all([
    fetchFederatedCount(),
    fetchRecentPublishedRecipes(6),
  ]);

  return (
    <div className="mx-auto max-w-page px-6">
      {/* Hero */}
      <section className="grid gap-10 py-16 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-16 md:py-24">
        <div className="order-2 md:order-1">
          <p className="label mb-4">A living family cookbook</p>
          <h1 className="font-serif text-4xl leading-[1.05] tracking-tight text-ink md:text-6xl">
            The recipes we make, remember, and pass around.
          </h1>
          <p className="mt-6 max-w-prose text-lg text-ink-soft">
            Many family lines, one shared recipe collection. This is where the old
            casseroles, handwritten cards, holiday staples, weeknight saves, and
            “wait, who has that recipe?” favorites can live side by side.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/recipes"  className="btn-primary">Browse recipes</Link>
            <Link href="/sections" className="btn-ghost">Explore by recipe type</Link>
          </div>
        </div>

        <div className="relative order-1 aspect-[7/5] overflow-hidden rounded-3xl border border-rule md:order-2">
          <Image
            src="/hero/leusch-sisters-thanksgiving.jpg"
            alt="Nancy, Laura, and Annie in the Quinn kitchen on Thanksgiving, 1980s."
            fill
            priority
            sizes="(min-width: 768px) 40vw, 100vw"
            className="object-cover"
          />
        </div>
      </section>

      {/* Browse by recipe type */}
      <section className="py-16 md:py-20">
        <h2 className="font-serif text-3xl text-ink md:text-4xl">Browse by recipe type</h2>
        <p className="mt-3 max-w-prose text-ink-soft">
          Find what fits the moment: breakfast, dinner, dessert, sides, snacks, and more.
        </p>
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {SECTIONS.map((section) => (
            <SectionCard key={section.slug} section={section} />
          ))}
        </div>
      </section>

      {/* Recently added */}
      {recent.length > 0 && (
        <section className="py-16 md:py-20">
          <h2 className="font-serif text-3xl text-ink md:text-4xl">Recently added</h2>
          <p className="mt-3 max-w-prose text-ink-soft">
            The newest recipes, notes, and remembered favorites added to the kitchen.
          </p>
          <div className="mt-8">
            <NativeRecipeGrid recipes={recent} />
          </div>
        </section>
      )}

      {/* From Aunt Laura’s archive */}
      {federatedCount > 0 && (
        <section className="pb-20 md:pb-24">
          <div className="rounded-2xl border border-rule bg-paper p-6 md:p-8">
            <h2 className="font-serif text-2xl text-ink md:text-3xl">From Aunt Laura’s archive</h2>
            <p className="mt-3 max-w-prose text-ink-soft">
              The original Leusch family cookbook lives at leuschfamilyrecipes.com,
              with {federatedCount} preserved recipes, scans, and stories.
            </p>
            <Link href="/family-lines/leusch" className="btn-ghost mt-5 inline-flex">
              Browse Aunt Laura’s original collection
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
