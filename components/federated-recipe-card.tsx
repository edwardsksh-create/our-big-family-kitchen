import { ExternalLink } from 'lucide-react';
import type { FederatedRecipe } from '@/lib/federated';
import { sectionBySlug, SECTION_BG, SECTION_TEXT } from '@/lib/sections';
import { cn } from '@/lib/utils';
import { FAMILY } from '@/config/family';

export function FederatedRecipeCard({
  recipe,
  showSectionBadge = false,
}: {
  recipe: FederatedRecipe;
  showSectionBadge?: boolean;
}) {
  const federation = FAMILY.federation;
  if (!federation) return null;
  const section = recipe.section_slug ? sectionBySlug(recipe.section_slug) : undefined;

  return (
    <a
      href={recipe.source_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex h-full flex-col justify-between gap-4 rounded-2xl border border-rule bg-paper p-5 card-hover hover:border-ink hover:shadow-[0_12px_40px_-20px_rgba(42,37,34,0.35)]"
    >
      <div>
        <div className="flex items-start gap-2">
          <h3 className="font-serif text-lg font-semibold leading-snug text-ink group-hover:text-primary md:text-xl">
            {recipe.title}
          </h3>
          <ExternalLink
            size={12}
            className="mt-1.5 shrink-0 text-ink-soft transition-transform duration-200 group-hover:-translate-y-px group-hover:text-primary"
            aria-hidden="true"
          />
        </div>
        {recipe.contributor_name && (
          <p className="mt-1 font-sans text-sm text-ink-soft">{recipe.contributor_name}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="font-serif text-xs italic text-primary">
          From {federation.archiveName}
        </span>
        {showSectionBadge && section && (
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 font-sans text-[10px] uppercase tracking-[0.12em]',
              SECTION_BG[section.color],
              SECTION_TEXT[section.color],
            )}
          >
            {section.name}
          </span>
        )}
      </div>

      <span className="sr-only">Opens at {federation.host} in a new tab.</span>
    </a>
  );
}
