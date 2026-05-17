import { fetchRecentPublishedRecipes } from '@/lib/queries/recipes';
import { fetchFederatedCount } from '@/lib/queries/federated';
import { NativeRecipeGrid } from '@/components/native-recipe-card';
import Link from 'next/link';

export const metadata = { title: 'Recipes' };
export const revalidate = 60;

export default async function RecipesIndexPage() {
  const [recipes, federatedCount] = await Promise.all([
    fetchRecentPublishedRecipes(60),
    fetchFederatedCount(),
  ]);

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">Recipes</p>
      <h1 className="font-serif text-4xl text-ink md:text-5xl">All recipes</h1>

      {recipes.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-rule p-12 text-center">
          <p className="font-serif italic text-2xl text-ink-soft">No native recipes yet.</p>
          <p className="mt-2 text-sm text-ink-soft">
            Aunt Laura’s {federatedCount} federated recipes are{' '}
            <Link href="/family-lines/leusch" className="text-primary underline decoration-rule underline-offset-4">here</Link>.
          </p>
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          <NativeRecipeGrid recipes={recipes} />
          <p className="text-sm text-ink-soft">
            Looking for the Leusch archive? Aunt Laura’s {federatedCount} federated recipes are{' '}
            <Link href="/family-lines/leusch" className="text-primary underline decoration-rule underline-offset-4">here</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
