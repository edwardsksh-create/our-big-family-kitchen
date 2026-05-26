import { FAMILY_LINES } from '@/lib/family-lines';
import { FamilyLineCard } from '@/components/family-line-card';
import { fetchMemberNamesByFamilyLine } from '@/lib/queries/contributors';

export const revalidate = 60;

export const metadata = { title: 'Family lines' };

export default async function FamilyLinesIndexPage() {
  const membersByLine = await fetchMemberNamesByFamilyLine();

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">Family lines</p>
      <h1 className="font-serif text-4xl leading-tight text-ink md:text-5xl">
        Follow the recipes through the family.
      </h1>
      <p className="mt-4 max-w-prose text-lg text-ink-soft">
        Find recipes connected to each branch, along with the people who helped
        save, share, or remember them.
      </p>

      <section className="mt-12">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FAMILY_LINES.map((line) => (
            <FamilyLineCard
              key={line.slug}
              line={line}
              members={membersByLine[line.slug] ?? []}
              size="small"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
