import Link from 'next/link';
import { type FamilyLine, FAMILY_BG } from '@/lib/family-lines';
import { cn } from '@/lib/utils';

/** A family line on the /family-lines index: just the name, in ink, with
 *  the line's color as a swatch dot. No blurbs, no member lists — the
 *  line's own page carries the people. (A per-family photo slot is coming;
 *  the card will take it above the name.) */
export function FamilyLineCard({ line }: { line: FamilyLine }) {
  return (
    <Link
      href={`/family-lines/${line.slug}`}
      className="group flex items-center gap-3 rounded-2xl border border-rule bg-paper p-6 card-hover hover:border-ink hover:shadow-[0_12px_40px_-20px_rgba(42,37,34,0.35)]"
    >
      <span aria-hidden="true" className={cn('h-3 w-3 shrink-0 rounded-full', FAMILY_BG[line.color])} />
      <span className="font-serif text-2xl text-ink group-hover:text-primary md:text-3xl">
        {line.name}
      </span>
    </Link>
  );
}
