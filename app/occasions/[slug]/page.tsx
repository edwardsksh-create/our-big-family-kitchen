import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchOccasionBySlug, fetchRecipeIdsForOccasion } from '@/lib/queries/occasions';
import { fetchPhotosForOccasion } from '@/lib/queries/family-photos';
import { fetchMemoriesForRecipes } from '@/lib/queries/recipe-comments';
import { fetchRecipeIndex } from '@/lib/queries/recipes';
import { RecipeIndexGrid } from '@/components/recipe-index-card';
import { ANONYMOUS_VIEWER } from '@/lib/recipes/badges';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const occasion = await fetchOccasionBySlug(params.slug);
  return { title: occasion ? `${occasion.name}, around our table` : 'Occasion' };
}

// One occasion's food, photos, and voices on a single page — the archive's
// answer to "what does Thanksgiving look like in this family?". Every
// section is content-gated; an occasion with nothing yet 404s rather than
// rendering an empty shell.
export default async function OccasionPage({ params }: { params: { slug: string } }) {
  const occasion = await fetchOccasionBySlug(params.slug);
  if (!occasion) notFound();

  const [recipeIds, photos] = await Promise.all([
    fetchRecipeIdsForOccasion(occasion.slug),
    fetchPhotosForOccasion(occasion.slug, 12),
  ]);

  // Resolve recipe cards through the index query, which already computes
  // the card-with-image data; filter to this occasion's published set.
  const idSet = new Set(recipeIds);
  const recipes = idSet.size > 0
    ? (await fetchRecipeIndex()).filter((r) => idSet.has(r.id))
    : [];

  if (recipes.length === 0 && photos.length === 0) notFound();

  const memories = await fetchMemoriesForRecipes(recipes.map((r) => r.id), 4);

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">Around our table</p>
      <h1 className="font-serif text-5xl leading-tight text-ink md:text-6xl">{occasion.name}</h1>
      <p className="mt-6 max-w-prose font-serif text-lg italic text-ink-soft">
        The dishes we bring, the photographs we kept, and the things we remember.
      </p>

      {recipes.length > 0 && (
        <section className="mt-16">
          <h2 className="font-serif text-3xl text-ink md:text-4xl">On the table</h2>
          <div className="mt-6">
            <RecipeIndexGrid recipes={recipes} viewer={ANONYMOUS_VIEWER} />
          </div>
        </section>
      )}

      {photos.length > 0 && (
        <section className="mt-16">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-serif text-3xl text-ink md:text-4xl">From the album</h2>
            <Link href="/album" className="font-serif text-sm italic text-ink-soft hover:text-primary">
              The kitchen across decades →
            </Link>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {photos.map((p) => (
              <li key={p.id} className="overflow-hidden rounded-2xl border border-rule bg-paper">
                <Link href={`/album?photo=${p.id}`} className="block">
                  <div className="relative aspect-[4/3] w-full">
                    <Image
                      src={p.public_url}
                      alt={p.caption ?? 'Family photo'}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
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

      {memories.length > 0 && (
        <section className="mt-16">
          <h2 className="font-serif text-3xl text-ink md:text-4xl">What we remember</h2>
          <ul className="mt-8 max-w-prose space-y-8">
            {memories.map((m) => (
              <li key={m.id}>
                <blockquote className="font-serif text-lg italic leading-relaxed text-ink">
                  “{m.body.length > 220 ? `${m.body.slice(0, 220).trimEnd()}…` : m.body}”
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
    </div>
  );
}
