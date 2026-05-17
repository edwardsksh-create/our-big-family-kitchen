import Link from 'next/link';
import type { NativeRecipeSummary } from '@/lib/queries/recipes';

export function NativeRecipeCard({ recipe }: { recipe: NativeRecipeSummary }) {
  return (
    <Link
      href={`/recipes/${recipe.slug}`}
      className="group flex h-full flex-col justify-between gap-4 rounded-2xl border border-rule bg-paper p-5 card-hover hover:border-ink hover:shadow-[0_12px_40px_-20px_rgba(42,37,34,0.35)]"
    >
      <div>
        <h3 className="font-serif text-lg font-semibold leading-snug text-ink group-hover:text-primary md:text-xl">
          {recipe.title}
        </h3>
        {recipe.contributor_name && (
          <p className="mt-1 font-sans text-sm text-ink-soft">{recipe.contributor_name}</p>
        )}
      </div>
      {recipe.section_name && (
        <span className="label text-ink-soft">{recipe.section_name}</span>
      )}
    </Link>
  );
}

export function NativeRecipeGrid({ recipes }: { recipes: NativeRecipeSummary[] }) {
  if (recipes.length === 0) return null;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {recipes.map((r) => (
        <li key={r.id}>
          <NativeRecipeCard recipe={r} />
        </li>
      ))}
    </ul>
  );
}
