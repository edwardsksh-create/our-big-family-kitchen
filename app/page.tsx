import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@/auth';
import { SECTIONS, SECTION_BG, SECTION_TEXT } from '@/lib/sections';
import { cn } from '@/lib/utils';
import { fetchFederatedCount } from '@/lib/queries/federated';
import { fetchRecentMemories } from '@/lib/queries/recipe-comments';
import { fetchRecipeIndex } from '@/lib/queries/recipes';
import { fetchRecentReviewedPhotos, type FamilyPhotoFull } from '@/lib/queries/family-photos';
import { fetchOccasionSlugsWithContent } from '@/lib/queries/occasions';
import { RecipeIndexGrid } from '@/components/recipe-index-card';
import { ANONYMOUS_VIEWER } from '@/lib/recipes/badges';

// The few editorial doorways into occasion pages — major gatherings only,
// and each link renders only when its page has something behind it.
const MAJOR_OCCASIONS = [
  { slug: 'thanksgiving',  name: 'Thanksgiving'  },
  { slug: 'christmas',     name: 'Christmas'     },
  { slug: 'sunday-dinner', name: 'Sunday Dinner' },
];

// Per-request: the album strip is shown only to signed-in family (the album
// itself is sign-in-only), so the page reads the session. The data sections
// are small and the queries are the same ones the index pages already run.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await auth();
  const signedIn = !!session?.user;

  const [federatedCount, memories, recipes, albumPhotos, occasionsWithContent] = await Promise.all([
    fetchFederatedCount(),
    fetchRecentMemories(3),
    fetchRecipeIndex(),
    signedIn ? fetchRecentReviewedPhotos(6) : Promise.resolve([] as FamilyPhotoFull[]),
    fetchOccasionSlugsWithContent(),
  ]);
  const recent = recipes.slice(0, 3);
  const holidayDoorways = MAJOR_OCCASIONS.filter((o) => occasionsWithContent.has(o.slug));

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
            <Link href="/album"    className="btn-ghost">Open the album</Link>
          </div>
        </div>

        <figure className="order-1 md:order-2">
          <div className="relative aspect-[7/5] overflow-hidden rounded-3xl border border-rule">
            <Image
              src="/hero/leusch-sisters-thanksgiving.jpg"
              alt="Nancy, Laura, and Annie in the Quinn kitchen on Thanksgiving, 1980s."
              fill
              priority
              sizes="(min-width: 768px) 40vw, 100vw"
              className="object-cover"
            />
          </div>
          {/* The caption is the archive speaking — names, place, era — so it
              gets the site's quiet italic-serif provenance treatment rather
              than living only in the alt text. */}
          <figcaption className="mt-3 font-serif text-sm italic text-ink-soft">
            Nancy, Laura, and Annie in the Quinn kitchen on Thanksgiving, 1980s.
          </figcaption>
        </figure>
      </section>

      {/* ------------------------------------------------------------------
          The living layer: what the family added lately. Each section
          renders only when it has content — a quiet front hall, not a feed.
          ------------------------------------------------------------------ */}

      {/* Recent family memories */}
      {memories.length > 0 && (
        <section className="py-14 md:py-16">
          <h2 className="font-serif text-2xl text-ink md:text-3xl">Family memories</h2>
          <ul className="mt-8 max-w-prose space-y-8">
            {memories.map((m) => (
              <li key={m.id}>
                <blockquote className="font-serif text-lg italic leading-relaxed text-ink">
                  “{m.body.length > 180 ? `${m.body.slice(0, 180).trimEnd()}…` : m.body}”
                </blockquote>
                <p className="mt-2 text-sm text-ink-soft">
                  — {m.author.displayName}, on{' '}
                  <Link href={`/recipes/${m.recipe.slug}`} className="text-primary hover:underline">
                    {m.recipe.title}
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recently added recipes */}
      {recent.length > 0 && (
        <section className="py-14 md:py-16">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-serif text-2xl text-ink md:text-3xl">New in the kitchen</h2>
            <Link href="/recipes" className="font-serif text-sm italic text-ink-soft hover:text-primary">
              All recipes →
            </Link>
          </div>
          <div className="mt-8">
            <RecipeIndexGrid recipes={recent} viewer={ANONYMOUS_VIEWER} />
          </div>
        </section>
      )}

      {/* Album strip — family only, like the album itself. */}
      {signedIn && albumPhotos.length > 0 && (
        <section className="py-14 md:py-16">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-serif text-2xl text-ink md:text-3xl">From the album</h2>
            <Link href="/album" className="font-serif text-sm italic text-ink-soft hover:text-primary">
              The kitchen across decades →
            </Link>
          </div>
          <ul className="mt-8 grid grid-cols-3 gap-3 md:grid-cols-6">
            {albumPhotos.map((p) => (
              <li key={p.id} className="overflow-hidden rounded-2xl border border-rule bg-paper">
                <Link href={`/album?photo=${p.id}`} className="block">
                  <div className="relative aspect-square w-full">
                    <Image
                      src={p.public_url}
                      alt={p.caption ?? 'Family photo'}
                      fill
                      sizes="(min-width: 768px) 16vw, 33vw"
                      className="object-cover"
                      loading="lazy"
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The holiday tables — a few doorways into the occasion pages. */}
      {holidayDoorways.length > 0 && (
        <section className="py-14 md:py-16">
          <h2 className="font-serif text-2xl text-ink md:text-3xl">The holiday tables</h2>
          <p className="mt-3 max-w-prose text-ink-soft">
            The food, photographs, and memories of the days we gather.
          </p>
          <ul className="mt-6 flex flex-wrap gap-3">
            {holidayDoorways.map((o) => (
              <li key={o.slug}>
                <Link href={`/occasions/${o.slug}`} className="btn-ghost">
                  {o.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Browse by recipe type — demoted from the 16-tile grid to the same
          quiet pill row /recipes uses; browsing stays one click away without
          dominating the page. */}
      <section className="py-14 md:py-16">
        <h2 className="font-serif text-2xl text-ink md:text-3xl">Browse by recipe type</h2>
        <ul className="mt-6 flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/sections/${s.slug}`}
                className={cn(
                  'inline-flex items-center rounded-full px-4 py-2 font-serif text-sm transition-transform card-hover md:text-base',
                  SECTION_BG[s.color],
                  SECTION_TEXT[s.color],
                )}
              >
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* From Aunt Laura’s archive */}
      {federatedCount > 0 && (
        <section className="pb-20 pt-2 md:pb-24">
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
