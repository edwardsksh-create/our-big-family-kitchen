import { Suspense } from 'react';
import { fetchAllFederatedRecipes } from '@/lib/queries/federated';
import { toSearchableItems, rank, groupResultsBySection } from '@/lib/search';
import { SECTIONS } from '@/lib/sections';
import { FederatedRecipeCard } from '@/components/federated-recipe-card';
import type { FederatedRecipe } from '@/lib/federated';

export const metadata = { title: 'Search' };
export const revalidate = 60;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const query = (searchParams.q ?? '').trim();

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">Search</p>
      <h1 className="font-serif text-4xl text-ink md:text-5xl">
        {query ? <>Results for <span className="warm text-primary">“{query}”</span></> : 'Search the kitchen'}
      </h1>

      {!query ? (
        <p className="mt-6 max-w-prose text-ink-soft">
          Type a recipe name, an ingredient, or a contributor to find it. Right
          now this searches Aunt Laura’s 2003 cookbook. As family recipes get
          added, those will show up here too.
        </p>
      ) : (
        <Suspense fallback={<p className="mt-10 text-ink-soft">Searching…</p>}>
          <Results query={query} />
        </Suspense>
      )}
    </div>
  );
}

async function Results({ query }: { query: string }) {
  const recipes = await fetchAllFederatedRecipes();
  const items = toSearchableItems(recipes);
  const results = rank(items, query);
  const grouped = groupResultsBySection(results, SECTIONS);

  if (results.length === 0) {
    return (
      <div className="mt-12 rounded-2xl border border-dashed border-rule p-12 text-center">
        <p className="font-serif italic text-2xl text-ink-soft">No matches.</p>
        <p className="mt-2 text-sm text-ink-soft">
          Try a different word, or check the spelling.
        </p>
      </div>
    );
  }

  const recipeById = new Map(recipes.map((r) => [r.id, r]));

  return (
    <div className="mt-10 space-y-12">
      <p className="text-sm text-ink-soft">
        {results.length} {results.length === 1 ? 'result' : 'results'} — all from Aunt Laura’s 2003 cookbook.
      </p>
      {grouped.map((group) => (
        <section key={group.slug ?? 'other'}>
          <div className="mb-4 flex items-baseline gap-3">
            <h2 className="font-serif text-xl text-ink">{group.name}</h2>
            <span className="label">{group.results.length}</span>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.results.map((r) => {
              const federated = recipeById.get(r.id) as FederatedRecipe;
              return (
                <li key={r.id}>
                  <FederatedRecipeCard recipe={federated} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
