import Image from 'next/image';
import Link from 'next/link';
import { PRIMARY_LINES, SECONDARY_LINES } from '@/lib/family-lines';
import { SECTIONS } from '@/lib/sections';
import { FamilyLineCard } from '@/components/family-line-card';
import { SectionCard } from '@/components/section-card';
import { fetchFederatedCount } from '@/lib/queries/federated';

export const revalidate = 300;

export default async function HomePage() {
  const federatedCount = await fetchFederatedCount();

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
            <Link href="/family-lines/leusch" className="btn-primary">Browse Aunt Laura’s cookbook</Link>
            <Link href="/recipes"             className="btn-ghost">All recipes</Link>
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

      {/* Family lines */}
      <section className="py-16 md:py-20">
        <div className="mb-10 flex items-baseline justify-between">
          <h2 className="font-serif text-3xl text-ink md:text-4xl">Browse by family line</h2>
          <p className="label hidden md:block">Six lines, one table</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {PRIMARY_LINES.map((line) => (
            <FamilyLineCard key={line.slug} line={line} size="large" />
          ))}
        </div>

        <p className="label mt-12 mb-5">And more recently</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {SECONDARY_LINES.map((line) => (
            <FamilyLineCard key={line.slug} line={line} size="small" />
          ))}
        </div>
      </section>

      {/* Sections */}
      <section className="py-16 md:py-20">
        <div className="mb-10 flex items-baseline justify-between">
          <h2 className="font-serif text-3xl text-ink md:text-4xl">Browse by section</h2>
          <p className="label hidden md:block">A meal-day in 13 colors</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {SECTIONS.map((section) => (
            <SectionCard key={section.slug} section={section} />
          ))}
        </div>
      </section>

      {/* Latest contributions */}
      <section className="py-16 md:py-20">
        <h2 className="font-serif text-3xl text-ink md:text-4xl">Latest contributions</h2>
        <div className="mt-10 rounded-2xl border border-rule bg-paper p-10 md:p-14">
          <p className="font-serif italic text-primary">From Aunt Laura’s 2003 cookbook</p>
          <p className="mt-3 font-serif text-2xl leading-snug text-ink md:text-3xl">
            {federatedCount} {federatedCount === 1 ? 'recipe is' : 'recipes are'} here to start.
          </p>
          <p className="mt-3 max-w-prose text-ink-soft">
            The Leusch family cookbook — transcribed, photographed, and federated
            from leuschfamilyrecipes.com — sits at the heart of this kitchen.
            New recipes from the Sundys, Edwardses, Hongs, Quinns, and Branions
            will arrive here too.
          </p>
          <div className="mt-7">
            <Link href="/family-lines/leusch" className="btn-primary">
              Browse Aunt Laura’s cookbook →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
