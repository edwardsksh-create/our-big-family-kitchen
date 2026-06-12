import { FAMILY_LINES } from '@/lib/family-lines';
import { FamilyLineCard } from '@/components/family-line-card';

export const metadata = { title: 'Family lines' };

export default function FamilyLinesIndexPage() {
  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <h1 className="font-serif text-4xl leading-tight text-ink md:text-5xl">
        Follow the recipes through the family.
      </h1>

      <section className="mt-12">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FAMILY_LINES.map((line) => (
            <FamilyLineCard key={line.slug} line={line} />
          ))}
        </div>
      </section>
    </div>
  );
}
