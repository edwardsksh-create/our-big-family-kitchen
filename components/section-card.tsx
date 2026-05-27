import Link from 'next/link';
import { type Section, SECTION_BG, SECTION_TEXT } from '@/lib/sections';
import { cn } from '@/lib/utils';

export function SectionCard({ section }: { section: Section }) {
  return (
    <Link
      href={`/sections/${section.slug}`}
      className={cn(
        'group flex aspect-[5/6] flex-col justify-end rounded-2xl p-5 card-hover',
        SECTION_BG[section.color],
        SECTION_TEXT[section.color],
      )}
    >
      <span className="font-serif text-2xl leading-tight md:text-3xl">
        {section.name}
      </span>
    </Link>
  );
}
