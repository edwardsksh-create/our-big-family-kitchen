import Image from 'next/image';
import Link from 'next/link';
import { type FamilyLine, FAMILY_BG } from '@/lib/family-lines';
import { SECTION_TEXT } from '@/lib/sections';
import { cn } from '@/lib/utils';

/** A family line on the /family-lines index. With a photo: the photo takes
 *  the box and the line's color becomes the name band beneath it. Without
 *  one: the full colored tile, as before. */
export function FamilyLineCard({ line }: { line: FamilyLine }) {
  if (line.photo) {
    return (
      <Link
        href={`/family-lines/${line.slug}`}
        className="group block overflow-hidden rounded-2xl border border-rule card-hover"
      >
        <div className="relative aspect-[4/3] w-full">
          <Image
            src={line.photo}
            alt={`The ${line.name} family`}
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
            className="object-cover"
          />
        </div>
        <div className={cn('p-4', FAMILY_BG[line.color], SECTION_TEXT[line.color])}>
          <span className="font-serif text-2xl leading-tight md:text-3xl">{line.name}</span>
        </div>
      </Link>
    );
  }
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
