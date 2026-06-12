import Image from 'next/image';
import Link from 'next/link';
import type { RecipeIndexItem } from '@/lib/queries/recipes';
import { badgesFor, type Badge, type Viewer } from '@/lib/recipes/badges';
import { cn } from '@/lib/utils';

export function RecipeIndexCard({ recipe, viewer, now }: { recipe: RecipeIndexItem; viewer: Viewer; now?: number }) {
  const badges = badgesFor(recipe, viewer, now);
  const subline = [recipe.contributor?.display, recipe.section?.name].filter(Boolean).join(' · ');
  const thirdLine =
    recipe.family_line?.name ??
    (recipe.originally_from && !/aunt laura/i.test(recipe.originally_from)
      ? `Originally from ${recipe.originally_from}`
      : null);

  const image = recipe.card_image;

  return (
    <Link
      href={`/recipes/${recipe.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-rule bg-paper card-hover hover:border-ink hover:shadow-[0_12px_40px_-20px_rgba(42,37,34,0.35)]"
    >
      {/* Card photo: the dish when one exists, else a detail crop of the
          first source scan — handwriting is the photography for heritage
          recipes. Scans crop from the top, where the card's own title
          usually sits; one consistent 3:2 window keeps the grid calm.
          No image → the text-only card below stands on its own. */}
      {image && (
        <div className="relative aspect-[3/2] w-full border-b border-rule">
          <Image
            src={image.url}
            alt=""
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
            className={cn(
              'object-cover',
              image.kind === 'source' && 'object-top',
            )}
            loading="lazy"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col justify-between gap-4 p-5">
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
      </div>
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

export function RecipeIndexGrid({ recipes, viewer, now }: { recipes: RecipeIndexItem[]; viewer: Viewer; now?: number }) {
  if (recipes.length === 0) return null;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {recipes.map((r) => (
        <li key={r.id}>
          <RecipeIndexCard recipe={r} viewer={viewer} now={now} />
        </li>
      ))}
    </ul>
  );
}
