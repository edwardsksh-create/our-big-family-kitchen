import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@/auth';
import { SECTIONS } from '@/lib/sections';
import { SectionCard } from '@/components/section-card';
import { fetchFederatedCount } from '@/lib/queries/federated';
import { fetchRecentMemories } from '@/lib/queries/recipe-comments';
import { fetchRecipeIndex } from '@/lib/queries/recipes';
import { fetchRandomHeroPhoto, fetchRecentReviewedPhotos, type FamilyPhotoFull } from '@/lib/queries/family-photos';
import { captionLead } from '@/lib/photos/photo-caption';
import { RecipeIndexGrid } from '@/components/recipe-index-card';
import { ANONYMOUS_VIEWER } from '@/lib/recipes/badges';
import { FAMILY } from '@/config/family';
import { isAreaPublic } from '@/lib/access';

// Per-request: the home page shows only the areas a logged-out visitor is
// allowed to see (per FAMILY.visibility), plus everything once signed in.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await auth();
  const signedIn = !!session?.user;
  // What this visitor may see on the home page. Signed-in family see it all;
  // logged-out visitors see only the public areas.
  const showRecipes = isAreaPublic('recipes') || signedIn;
  const showAlbum   = isAreaPublic('album')   || signedIn;

  const [federatedCount, memories, recipes, albumPhotos, heroPhoto] = await Promise.all([
    fetchFederatedCount(),
    fetchRecentMemories(3),
    fetchRecipeIndex(),
    // Never fetch/show album photos (incl. the hero) to someone who can't
    // see the album — that's the most sensitive area.
    showAlbum ? fetchRecentReviewedPhotos(6) : Promise.resolve([] as FamilyPhotoFull[]),
    showAlbum ? fetchRandomHeroPhoto() : Promise.resolve(null),
  ]);
  const recent = recipes.slice(0, 3);

  // A fresh photo from the curated pool on every page load; the original
  // archival photo stands in whenever the pool is empty (never breaks).
  const heroSrc = heroPhoto?.public_url || FAMILY.heroFallback.src;
  const heroCaption = heroPhoto
    ? (heroPhoto.caption ?? captionLead({ occasionNames: [], year: heroPhoto.year, place: heroPhoto.place }))
    : FAMILY.heroFallback.caption;
  const heroAlt = heroCaption ?? 'A photo from the family archive.';

  return (
    <div className="mx-auto max-w-page px-6">
      {/* Hero */}
      <section className="grid gap-8 py-6 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-14 md:py-8">
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
            {showRecipes && <Link href="/recipes" className="btn-primary">Browse recipes</Link>}
            {showAlbum   && <Link href="/album"   className="btn-ghost">Open the album</Link>}
            {!showRecipes && !showAlbum && (
              <Link href="/sign-in" className="btn-primary">Sign in</Link>
            )}
          </div>
        </div>

        {/* One priority-loaded image (no carousel — kind to LCP and to
            readers), picked at random from the curated pool on each page
            load. The caption is the archive speaking — names, place, era. */}
        <figure className="order-1 md:order-2">
          <div className="relative aspect-[7/5] overflow-hidden rounded-3xl border border-rule">
            <Image
              src={heroSrc}
              alt={heroAlt}
              fill
              priority
              sizes="(min-width: 768px) 40vw, 100vw"
              className="object-cover"
            />
          </div>
          {heroCaption && (
            <figcaption className="mt-3 font-serif text-sm italic text-ink-soft">
              {heroCaption}
            </figcaption>
          )}
        </figure>
      </section>

      {/* ------------------------------------------------------------------
          The living layer: what the family added lately. Each section
          renders only when it has content — a quiet front hall, not a feed.
          ------------------------------------------------------------------ */}

      {/* Recently added recipes */}
      {showRecipes && recent.length > 0 && (
        <section className="py-5 md:py-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-serif text-2xl text-ink md:text-3xl">New in the kitchen</h2>
            <Link href="/recipes" className="font-serif text-sm italic text-ink-soft hover:text-primary">
              All recipes →
            </Link>
          </div>
          <div className="mt-5">
            <RecipeIndexGrid recipes={recent} viewer={ANONYMOUS_VIEWER} />
          </div>
        </section>
      )}

      {/* Album strip — shown to whoever can see the album. */}
      {showAlbum && albumPhotos.length > 0 && (
        <section className="py-5 md:py-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-serif text-2xl text-ink md:text-3xl">From the album</h2>
            <Link href="/album" className="font-serif text-sm italic text-ink-soft hover:text-primary">
              Open the album →
            </Link>
          </div>
          <ul className="mt-5 grid grid-cols-3 gap-3 md:grid-cols-6">
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

      {/* Recent family memories (memories live on recipes) */}
      {showRecipes && memories.length > 0 && (
        <section className="py-5 md:py-6">
          <h2 className="font-serif text-2xl text-ink md:text-3xl">Family memories</h2>
          <ul className="mt-6 max-w-prose space-y-7">
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

      {/* Browse by recipe type — demoted from the 16-tile grid to the same
          quiet pill row /recipes uses; browsing stays one click away without
          dominating the page. */}
      {showRecipes && (
        <section className="py-5 md:py-6">
          <h2 className="font-serif text-2xl text-ink md:text-3xl">Browse by recipe type</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {SECTIONS.map((section) => (
              <SectionCard key={section.slug} section={section} />
            ))}
          </div>
        </section>
      )}

      {/* The federated archive box (Kate's instance: Aunt Laura's archive) */}
      {showRecipes && FAMILY.federation && federatedCount > 0 && (
        <section className="pb-16 pt-2 md:pb-20">
          <div className="rounded-2xl border border-rule bg-paper p-6 md:p-8">
            <h2 className="font-serif text-2xl text-ink md:text-3xl">From {FAMILY.federation.archiveShortName}</h2>
            <p className="mt-3 max-w-prose text-ink-soft">
              {FAMILY.federation.homeBlurbLead},
              with {federatedCount} preserved recipes, scans, and stories.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <Link href={`/family-lines/${FAMILY.federation.lineSlugs[0]}`} className="btn-ghost">
                Browse {FAMILY.federation.collectionName}
              </Link>
              {FAMILY.foundingLetter && (
                <Link href="/about#letter" className="font-serif text-sm italic text-ink-soft hover:text-primary">
                  {FAMILY.foundingLetter.homeLinkText} →
                </Link>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
