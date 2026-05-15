import Link from 'next/link';
import type { FamilyLine } from '@/lib/family-lines';
import { cn } from '@/lib/utils';

export function FamilyLineCard({
  line,
  size = 'large',
}: {
  line: FamilyLine;
  size?: 'large' | 'small';
}) {
  return (
    <Link
      href={`/family-lines/${line.slug}`}
      className={cn(
        'group block rounded-2xl border border-rule bg-paper card-hover hover:border-ink hover:shadow-[0_12px_40px_-20px_rgba(42,37,34,0.35)]',
        size === 'large' ? 'p-8' : 'p-5',
      )}
    >
      <p className="label mb-2">{line.type === 'primary' ? 'Family line' : 'Recently joined'}</p>
      <h3
        className={cn(
          'font-serif text-ink',
          size === 'large' ? 'text-3xl md:text-4xl' : 'text-2xl',
        )}
      >
        {line.name}
      </h3>
      <p
        className={cn(
          'mt-3 text-ink-soft',
          size === 'large' ? 'text-base' : 'text-sm',
        )}
      >
        {line.blurb}
      </p>
      <p className="mt-6 label text-primary transition-transform duration-300 group-hover:translate-x-1">
        Browse →
      </p>
    </Link>
  );
}
