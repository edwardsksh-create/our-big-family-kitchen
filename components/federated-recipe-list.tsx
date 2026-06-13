import type { FederatedRecipe, FederatedRecipeBySection } from '@/lib/federated';
import { FederatedRecipeCard } from '@/components/federated-recipe-card';
import { FAMILY } from '@/config/family';

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
  heading,
  subheading,
}: {
  groups: FederatedRecipeBySection[];
  heading?: string;
  subheading?: string;
}) {
  const federation = FAMILY.federation;
  const total = groups.reduce((acc, g) => acc + g.recipes.length, 0);
  if (!federation || total === 0) return null;
  const headingText = heading ?? `From ${federation.archiveName}`;

  return (
    <section className="space-y-12">
      <header>
        <h2 className="font-serif text-3xl text-ink md:text-4xl">{headingText}</h2>
        {subheading && <p className="mt-2 font-serif italic text-ink-soft">{subheading}</p>}
        <p className="mt-2 text-sm text-ink-soft">
          {total} {total === 1 ? 'recipe' : 'recipes'} — every card links out
          to {federation.collectionName}, where the full recipe lives.
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
