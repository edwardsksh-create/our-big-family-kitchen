import Link from 'next/link';
import { type FamilyLine, FAMILY_BG } from '@/lib/family-lines';
import { cn } from '@/lib/utils';

export function FamilyLineCard({
  line,
  members,
  size = 'large',
}: {
  line: FamilyLine;
  members?: string[];
  size?: 'large' | 'small';
}) {
  const swatchClass = FAMILY_BG[line.color];

  return (
    <Link
      href={`/family-lines/${line.slug}`}
      className={cn(
        'group block rounded-2xl border border-rule bg-paper card-hover hover:border-ink hover:shadow-[0_12px_40px_-20px_rgba(42,37,34,0.35)]',
        size === 'large' ? 'p-8' : 'p-5',
      )}
    >
      <p className="label mb-2">Family line</p>
      {/* Name and members render in ink — the line's color appears only as
          the swatch dot. The light tokens (gold, sky, blush) fail contrast
          as text on paper, and names must be legible everywhere. */}
      <h3
        className={cn(
          'flex items-center gap-2.5 font-serif text-ink',
          size === 'large' ? 'text-3xl md:text-4xl' : 'text-2xl',
        )}
      >
        <span aria-hidden="true" className={cn('h-3 w-3 shrink-0 rounded-full', swatchClass)} />
        {line.name}
      </h3>

      {members && members.length > 0 ? (
        <p
          className={cn(
            'mt-3 text-ink',
            size === 'large' ? 'text-base' : 'text-sm',
          )}
        >
          {members.join(', ')}
        </p>
      ) : (
        <p
          className={cn(
            'mt-3 text-ink-soft italic',
            size === 'large' ? 'text-base' : 'text-sm',
          )}
        >
          No members yet
        </p>
      )}

      <p className="mt-6 label text-primary transition-transform duration-300 group-hover:translate-x-1">
        Browse →
      </p>
    </Link>
  );
}
