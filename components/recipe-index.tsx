'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { RecipeIndexItem } from '@/lib/queries/recipes';
import { RecipeIndexGrid } from '@/components/recipe-index-card';
import { SECTIONS } from '@/lib/sections';
import { cn } from '@/lib/utils';

type SortKey = 'newest' | 'updated' | 'az' | 'type' | 'contributor';

type Filters = {
  section:    string; // section slug or ''
  contributor: string; // contributor slug or ''
  familyLine:  string; // family-line slug or ''
  readyToCook:    boolean;
  hasOriginal:    boolean;
  hasFamilyNote:  boolean;
  needsDetails:   boolean;
};

const EMPTY: Filters = {
  section: '', contributor: '', familyLine: '',
  readyToCook: false, hasOriginal: false, hasFamilyNote: false, needsDetails: false,
};

const SORT_LABELS: Record<SortKey, string> = {
  newest:      'Newest added',
  updated:     'Recently updated',
  az:          'A to Z',
  type:        'Recipe type',
  contributor: 'Contributor',
};

export function RecipeIndex({ recipes, now }: { recipes: RecipeIndexItem[]; now: number }) {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [sort,    setSort]    = useState<SortKey>('newest');

  const contributorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of recipes) {
      if (r.contributor && !seen.has(r.contributor.slug)) {
        seen.set(r.contributor.slug, r.contributor.display);
      }
    }
    return [...seen.entries()]
      .map(([slug, display]) => ({ slug, display }))
      .sort((a, b) => a.display.localeCompare(b.display));
  }, [recipes]);

  const familyLineOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of recipes) {
      if (r.family_line && !seen.has(r.family_line.slug)) {
        seen.set(r.family_line.slug, r.family_line.name);
      }
    }
    return [...seen.entries()]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [recipes]);

  const sectionOptions = useMemo(() => {
    const present = new Set(recipes.map((r) => r.section?.slug).filter(Boolean) as string[]);
    return SECTIONS.filter((s) => present.has(s.slug));
  }, [recipes]);

  const filtered = useMemo(() => {
    const filteredList = recipes.filter((r) => {
      if (filters.section     && r.section?.slug     !== filters.section)     return false;
      if (filters.contributor && r.contributor?.slug !== filters.contributor) return false;
      if (filters.familyLine  && r.family_line?.slug !== filters.familyLine)  return false;
      if (filters.readyToCook   && !(r.has_method && r.has_ingredients)) return false;
      if (filters.hasOriginal   && !r.has_source_photo) return false;
      if (filters.hasFamilyNote && !r.has_story) return false;
      if (filters.needsDetails) {
        const needs = !r.has_method || !r.has_story || r.tag_slugs.includes('needs-instructions') || r.tag_slugs.includes('low-confidence');
        if (!needs) return false;
      }
      return true;
    });
    return sortRecipes(filteredList, sort);
  }, [recipes, filters, sort]);

  const activeChips = describeChips(filters, sectionOptions, contributorOptions, familyLineOptions);
  const anyActive = activeChips.length > 0;

  return (
    <div>
      <div className="rounded-2xl border border-rule bg-cream/30 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            label="Recipe type"
            value={filters.section}
            onChange={(v) => setFilters((f) => ({ ...f, section: v }))}
            options={[{ value: '', label: 'All types' }, ...sectionOptions.map((s) => ({ value: s.slug, label: s.name }))]}
          />
          <Select
            label="Contributor"
            value={filters.contributor}
            onChange={(v) => setFilters((f) => ({ ...f, contributor: v }))}
            options={[{ value: '', label: 'Anyone' }, ...contributorOptions.map((c) => ({ value: c.slug, label: c.display }))]}
          />
          <Select
            label="Family line"
            value={filters.familyLine}
            onChange={(v) => setFilters((f) => ({ ...f, familyLine: v }))}
            options={[{ value: '', label: 'All families' }, ...familyLineOptions.map((f) => ({ value: f.slug, label: f.name }))]}
          />
          <Toggle label="Ready to cook"   on={filters.readyToCook}   onChange={(v) => setFilters((f) => ({ ...f, readyToCook: v }))} />
          <Toggle label="Has original page" on={filters.hasOriginal}   onChange={(v) => setFilters((f) => ({ ...f, hasOriginal: v }))} />
          <Toggle label="Has family note" on={filters.hasFamilyNote} onChange={(v) => setFilters((f) => ({ ...f, hasFamilyNote: v }))} />
          <Toggle label="Needs details"   on={filters.needsDetails}  onChange={(v) => setFilters((f) => ({ ...f, needsDetails: v }))} />

          <div className="ml-auto flex items-center gap-2">
            <Select
              label="Sort"
              value={sort}
              onChange={(v) => setSort(v as SortKey)}
              options={(Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({ value: k, label: SORT_LABELS[k] }))}
            />
          </div>
        </div>

        {anyActive && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-rule pt-3">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilters((f) => chip.clear(f))}
                className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper px-2.5 py-1 font-sans text-xs text-ink hover:border-ink"
              >
                {chip.label}
                <X size={12} aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFilters(EMPTY)}
              className="font-sans text-xs uppercase tracking-[0.12em] text-ink-soft hover:text-primary"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <p className="mt-4 text-sm text-ink-soft">
        {filtered.length} {filtered.length === 1 ? 'recipe' : 'recipes'}
      </p>

      <div className="mt-4">
        {filtered.length > 0 ? (
          <RecipeIndexGrid recipes={filtered} now={now} />
        ) : (
          <p className="rounded-2xl border border-dashed border-rule p-12 text-center font-serif italic text-ink-soft">
            No recipes match those filters.
          </p>
        )}
      </div>
    </div>
  );
}

function sortRecipes(recipes: RecipeIndexItem[], sort: SortKey): RecipeIndexItem[] {
  const arr = [...recipes];
  switch (sort) {
    case 'updated':
      arr.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      break;
    case 'az':
      arr.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'type':
      arr.sort((a, b) =>
        (a.section?.name ?? '').localeCompare(b.section?.name ?? '') ||
        a.title.localeCompare(b.title),
      );
      break;
    case 'contributor':
      arr.sort((a, b) =>
        (a.contributor?.display ?? '').localeCompare(b.contributor?.display ?? '') ||
        a.title.localeCompare(b.title),
      );
      break;
    case 'newest':
    default:
      arr.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
  }
  return arr;
}

function describeChips(
  filters: Filters,
  sections: { slug: string; name: string }[],
  contributors: { slug: string; display: string }[],
  familyLines: { slug: string; name: string }[],
) {
  const chips: { key: string; label: string; clear: (f: Filters) => Filters }[] = [];

  if (filters.section) {
    const s = sections.find((x) => x.slug === filters.section);
    chips.push({ key: 'section', label: `Type: ${s?.name ?? filters.section}`, clear: (f) => ({ ...f, section: '' }) });
  }
  if (filters.contributor) {
    const c = contributors.find((x) => x.slug === filters.contributor);
    chips.push({ key: 'contributor', label: `By ${c?.display ?? filters.contributor}`, clear: (f) => ({ ...f, contributor: '' }) });
  }
  if (filters.familyLine) {
    const fl = familyLines.find((x) => x.slug === filters.familyLine);
    chips.push({ key: 'familyLine', label: `Family: ${fl?.name ?? filters.familyLine}`, clear: (f) => ({ ...f, familyLine: '' }) });
  }
  if (filters.readyToCook)   chips.push({ key: 'ready',   label: 'Ready to cook',     clear: (f) => ({ ...f, readyToCook: false   }) });
  if (filters.hasOriginal)   chips.push({ key: 'orig',    label: 'Has original page', clear: (f) => ({ ...f, hasOriginal: false   }) });
  if (filters.hasFamilyNote) chips.push({ key: 'note',    label: 'Has family note',   clear: (f) => ({ ...f, hasFamilyNote: false }) });
  if (filters.needsDetails)  chips.push({ key: 'needs',   label: 'Needs details',     clear: (f) => ({ ...f, needsDetails: false  }) });

  return chips;
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-sm">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'rounded-full border border-rule bg-paper px-3 py-1.5 font-sans text-sm text-ink',
          'outline-none transition-colors hover:border-ink focus:border-ink focus:ring-2 focus:ring-ink/10',
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.value === '' ? `${label}: ${o.label}` : o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-sans text-sm transition-colors',
        on
          ? 'border-ink bg-ink text-paper'
          : 'border-rule bg-paper text-ink hover:border-ink',
      )}
    >
      {label}
    </button>
  );
}
