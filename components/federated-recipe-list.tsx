import type { FederatedRecipe, FederatedRecipeBySection } from '@/lib/federated';
import { FederatedRecipeCard } from '@/components/federated-recipe-card';

export function FederatedRecipeGrid({
  recipes,
  showSectionBadge = false,
}: {
  recipes: FederatedRecipe[];
  showSectionBadge?: boolean;
}) {
  if (recipes.length === 0) return null;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {recipes.map((r) => (
        <li key={r.id}>
          <FederatedRecipeCard recipe={r} showSectionBadge={showSectionBadge} />
        </li>
      ))}
    </ul>
  );
}

export function FederatedRecipesBySection({
  groups,
  heading = 'From Aunt Laura’s 2003 cookbook',
  subheading,
}: {
  groups: FederatedRecipeBySection[];
  heading?: string;
  subheading?: string;
}) {
  const total = groups.reduce((acc, g) => acc + g.recipes.length, 0);
  if (total === 0) return null;

  return (
    <section className="space-y-12">
      <header>
        <h2 className="font-serif text-3xl text-ink md:text-4xl">{heading}</h2>
        {subheading && <p className="mt-2 font-serif italic text-ink-soft">{subheading}</p>}
        <p className="mt-2 text-sm text-ink-soft">
          {total} {total === 1 ? 'recipe' : 'recipes'} — every card links out
          to Aunt Laura&rsquo;s original collection, where the full recipe lives.
        </p>
      </header>

      {groups.map((group) => (
        <div key={group.slug}>
          <div className="mb-4 flex items-baseline gap-3">
            <h3 className="font-serif text-xl text-ink">{group.name}</h3>
            <span className="label">{group.recipes.length}</span>
          </div>
          <FederatedRecipeGrid recipes={group.recipes} />
        </div>
      ))}
    </section>
  );
}
