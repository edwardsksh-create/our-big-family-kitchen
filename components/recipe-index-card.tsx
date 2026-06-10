import Link from 'next/link';
import type { RecipeIndexItem } from '@/lib/queries/recipes';
import { badgesFor, type Badge } from '@/lib/recipes/badges';
import { cn } from '@/lib/utils';

export function RecipeIndexCard({ recipe, now }: { recipe: RecipeIndexItem; now?: number }) {
  const badges = badgesFor(recipe, now);
  const subline = [recipe.contributor?.display, recipe.section?.name].filter(Boolean).join(' · ');
  const thirdLine =
    recipe.family_line?.name ??
    (recipe.originally_from && !/aunt laura/i.test(recipe.originally_from)
      ? `Originally from ${recipe.originally_from}`
      : null);

  return (
    <Link
      href={`/recipes/${recipe.slug}`}
      className="group flex h-full flex-col justify-between gap-4 rounded-2xl border border-rule bg-paper p-5 card-hover hover:border-ink hover:shadow-[0_12px_40px_-20px_rgba(42,37,34,0.35)]"
    >
      <div>
        <h3 className="font-serif text-lg font-semibold leading-snug text-ink group-hover:text-primary md:text-xl">
          {recipe.title}
        </h3>
        {subline && (
          <p className="mt-1 font-sans text-sm text-ink-soft">{subline}</p>
        )}
        {thirdLine && (
          <p className="mt-0.5 font-sans text-xs italic text-ink-soft/80">{thirdLine}</p>
        )}
      </div>
      {badges.length > 0 && (
        <ul className="-mb-1 flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <li key={b.key}>
              <BadgePill badge={b} />
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}

function BadgePill({ badge }: { badge: Badge }) {
  // Two visual treatments — affirmative state vs. awaiting-input — distinct
  // enough to read at a glance but using the existing palette tokens.
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-sans text-[10px] uppercase tracking-[0.1em]',
        badge.kind === 'affirmative'
          ? 'border-rule bg-cream/40 text-ink-soft'
          : 'border-accent/40 bg-accent/10 text-accent',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          badge.kind === 'affirmative' ? 'bg-ink-soft/60' : 'bg-accent',
        )}
      />
      {badge.label}
    </span>
  );
}

export function RecipeIndexGrid({ recipes, now }: { recipes: RecipeIndexItem[]; now?: number }) {
  if (recipes.length === 0) return null;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {recipes.map((r) => (
        <li key={r.id}>
          <RecipeIndexCard recipe={r} now={now} />
        </li>
      ))}
    </ul>
  );
}
