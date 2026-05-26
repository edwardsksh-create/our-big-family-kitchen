import { fetchRecentPublishedRecipes } from '@/lib/queries/recipes';
import { fetchFederatedCount } from '@/lib/queries/federated';
import { NativeRecipeGrid } from '@/components/native-recipe-card';
import Link from 'next/link';

export const metadata = { title: 'Recipes' };
export const revalidate = 60;

export default async function RecipesIndexPage() {
  const [recent, recipes, federatedCount] = await Promise.all([
    fetchRecentPublishedRecipes(6),
    fetchRecentPublishedRecipes(60),
    fetchFederatedCount(),
  ]);

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">All recipes</p>
      <h1 className="font-serif text-4xl text-ink md:text-5xl">
        Everything in the kitchen so far.
      </h1>
      <p className="mt-4 max-w-prose text-lg text-ink-soft">
        Search, browse, or wander through the family recipe collection. Some
        recipes are polished and ready to cook; others are old cards, scanned
        pages, remembered favorites, or notes still waiting for someone in the
        family to fill in the details.
      </p>

      {recent.length > 0 && (
        <section className="mt-16">
          <h2 className="font-serif text-2xl text-ink md:text-3xl">Recently added</h2>
          <p className="mt-2 max-w-prose text-ink-soft">
            The newest recipes, notes, and remembered favorites that have been
            added to the kitchen.
          </p>
          <div className="mt-6">
            <NativeRecipeGrid recipes={recent} />
          </div>
        </section>
      )}

      <section className="mt-16">
        <h2 className="font-serif text-2xl text-ink md:text-3xl">All recipes</h2>
        {recipes.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-rule p-12 text-center">
            <p className="font-serif italic text-2xl text-ink-soft">No native recipes yet.</p>
            <p className="mt-2 text-sm text-ink-soft">
              Aunt Laura’s {federatedCount} recipes from the original collection are{' '}
              <Link href="/family-lines/leusch" className="text-primary underline decoration-rule underline-offset-4">here</Link>.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-10">
            <NativeRecipeGrid recipes={recipes} />
            <p className="text-sm text-ink-soft">
              Looking for the Leusch archive? Aunt Laura’s {federatedCount} recipes from the original collection are{' '}
              <Link href="/family-lines/leusch" className="text-primary underline decoration-rule underline-offset-4">here</Link>.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
