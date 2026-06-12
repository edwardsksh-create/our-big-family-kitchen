import Link from 'next/link';
import { type FamilyLine, FAMILY_BG } from '@/lib/family-lines';
import { SECTION_TEXT } from '@/lib/sections';
import { cn } from '@/lib/utils';

/** A family line on the /family-lines index: the line's color as a full
 *  box (the site's colored-tile language), name set in the per-token
 *  ink/paper text color the section tiles already use — text ON color is
 *  contrast-safe; it was color-as-text-on-paper that failed. When Kate's
 *  per-family photos arrive, the photo takes the box and the color becomes
 *  a band or frame. */
export function FamilyLineCard({ line }: { line: FamilyLine }) {
  return (
    <Link
      href={`/family-lines/${line.slug}`}
      className={cn(
        'group flex min-h-[140px] flex-col justify-end rounded-2xl p-6 card-hover',
        FAMILY_BG[line.color],
        SECTION_TEXT[line.color],
      )}
    >
      <span className="font-serif text-2xl leading-tight md:text-3xl">
        {line.name}
      </span>
    </Link>
  );
}
