import Link from 'next/link';
import { fetchListedContributors } from '@/lib/queries/contributors';
import { SECTION_BG, SECTION_TEXT, type SectionColorToken } from '@/lib/sections';
import { cn } from '@/lib/utils';

// The brand palette in a deliberate rotation. Nine colors over a 2/3/4
// column grid means no two neighbors repeat, horizontally or vertically.
const TILE_COLORS: SectionColorToken[] = [
  'burgundy', 'gold', 'sky', 'olive', 'mauve', 'slate', 'rose', 'navy', 'blush',
];

export const metadata = { title: 'Contributors' };
export const revalidate = 60;

export default async function ContributorsPage() {
  // Only people with ≥1 published recipe attributed to them (contributor_id)
  // are listed here. People who only appear in family structure or as
  // photo tags still exist (and show on /family-lines and /contributors/[slug]),
  // they just don't pad the public index.
  const all = await fetchListedContributors();

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">Contributors</p>
      <h1 className="font-serif text-4xl text-ink md:text-5xl">The cooks, keepers, and rememberers.</h1>
      <p className="mt-3 max-w-prose text-ink-soft">
        Some cooked. Some wrote things down. Some just remembered where a
        recipe came from.
      </p>

      {/* Brand-style colored boxes, name only — colors rotate through the
          full palette in display order (the deliberate mix), like the
          section tiles. Families and bio live on the person's page. */}
      <ul className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {all.map((c, i) => {
          const color = TILE_COLORS[i % TILE_COLORS.length];
          return (
            <li key={c.id}>
              <Link
                href={`/contributors/${c.slug}`}
                className={cn(
                  'flex min-h-[120px] flex-col justify-end rounded-2xl p-5 card-hover',
                  SECTION_BG[color],
                  SECTION_TEXT[color],
                )}
              >
                <span className="font-serif text-xl leading-tight md:text-2xl">{c.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
