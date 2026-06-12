import Link from 'next/link';
import { fetchListedContributors } from '@/lib/queries/contributors';
import { familyLineBySlug, FAMILY_BG } from '@/lib/family-lines';
import { SECTION_TEXT } from '@/lib/sections';
import { cn } from '@/lib/utils';

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

      {/* Brand-style colored boxes, name only — the color is the person's
          primary family line. Families and bio live on their page. People
          without a line get the cream tile. */}
      <ul className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {all.map((c) => {
          const line = c.primary_family_line ? familyLineBySlug(c.primary_family_line.slug) : undefined;
          return (
            <li key={c.id}>
              <Link
                href={`/contributors/${c.slug}`}
                className={cn(
                  'flex min-h-[120px] flex-col justify-end rounded-2xl p-5 card-hover',
                  line ? FAMILY_BG[line.color] : 'bg-cream',
                  line ? SECTION_TEXT[line.color] : 'text-ink',
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
