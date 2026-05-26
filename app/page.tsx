import Image from 'next/image';
import Link from 'next/link';
import { FAMILY_LINES } from '@/lib/family-lines';
import { SECTIONS } from '@/lib/sections';
import { FamilyLineCard } from '@/components/family-line-card';
import { SectionCard } from '@/components/section-card';
import { NativeRecipeGrid } from '@/components/native-recipe-card';
import { fetchFederatedCount } from '@/lib/queries/federated';
import { fetchRecentPublishedRecipes } from '@/lib/queries/recipes';
import { fetchMemberNamesByFamilyLine } from '@/lib/queries/contributors';

export const revalidate = 60;

export default async function HomePage() {
  const [federatedCount, recent, membersByLine] = await Promise.all([
    fetchFederatedCount(),
    fetchRecentPublishedRecipes(6),
    fetchMemberNamesByFamilyLine(),
  ]);

  return (
    <div className="mx-auto max-w-page px-6">
      {/* Hero */}
      <section className="grid gap-10 py-16 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-16 md:py-24">
        <div>
          <p className="label mb-4">A living cookbook</p>
          <h1 className="font-serif text-4xl leading-[1.05] tracking-tight text-ink md:text-6xl">
            Recipes from our families, <span className="warm text-primary">kept and growing</span>.
          </h1>
          <p className="mt-6 max-w-prose text-lg text-ink-soft">
            Six family lines. One shared kitchen. A place where the old casseroles
            and the new weeknight dinners can sit on the same shelf.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/recipes"      className="btn-primary">All recipes</Link>
            <Link href="/family-lines" className="btn-ghost">Browse by family</Link>
          </div>
        </div>

        <div className="relative aspect-[5/6] overflow-hidden rounded-3xl border border-rule">
          <Image
            src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1200&q=80"
            alt="A warm kitchen counter at the start of dinner."
            fill
            priority
            sizes="(min-width: 768px) 40vw, 100vw"
            className="object-cover"
          />
        </div>
      </section>

      {/* Sections */}
      <section className="py-16 md:py-20">
        <div className="mb-10 flex items-baseline justify-between">
          <h2 className="font-serif text-3xl text-ink md:text-4xl">Browse by section</h2>
          <p className="label hidden md:block">A meal-day in 16 colors</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {SECTIONS.map((section) => (
            <SectionCard key={section.slug} section={section} />
          ))}
        </div>
      </section>

      {/* Latest contributions */}
      {recent.length > 0 && (
        <section className="py-16 md:py-20">
          <h2 className="font-serif text-3xl text-ink md:text-4xl">Latest contributions</h2>
          <div className="mt-8">
            <NativeRecipeGrid recipes={recent} />
          </div>
        </section>
      )}

      {/* Family lines — demoted below sections + latest */}
      <section className="py-12 md:py-16">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="font-serif text-2xl text-ink md:text-3xl">Browse by family</h2>
          <p className="label hidden md:block">Six lines, one table</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FAMILY_LINES.map((line) => (
            <FamilyLineCard
              key={line.slug}
              line={line}
              members={membersByLine[line.slug] ?? []}
              size="small"
            />
          ))}
        </div>
      </section>

      {/* Federated archive — quieter reference, well below the hero */}
      {federatedCount > 0 && (
        <section className="pb-20 md:pb-24">
          <div className="rounded-2xl border border-rule bg-paper p-6 md:p-8">
            <p className="font-serif italic text-primary">From the archive</p>
            <p className="mt-2 max-w-prose text-ink-soft">
              {federatedCount} more recipes from the Leusch archive — federated from{' '}
              leuschfamilyrecipes.com.
            </p>
            <Link href="/family-lines/leusch" className="mt-4 inline-flex label text-primary hover:underline">
              Browse Aunt Laura’s original collection of family recipes →
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
