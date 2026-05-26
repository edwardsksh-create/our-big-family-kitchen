import { PRIMARY_LINES, SECONDARY_LINES } from '@/lib/family-lines';
import { FamilyLineCard } from '@/components/family-line-card';
import { fetchMemberNamesByFamilyLine } from '@/lib/queries/contributors';

export const revalidate = 60;

export const metadata = { title: 'Family lines' };

export default async function FamilyLinesIndexPage() {
  const membersByLine = await fetchMemberNamesByFamilyLine();

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">Six lines, one table</p>
      <h1 className="font-serif text-4xl leading-tight text-ink md:text-5xl">
        Family lines
      </h1>
      <p className="mt-4 max-w-prose text-lg text-ink-soft">
        The branches of family that share this kitchen. Pick a line to see whose
        recipes live there.
      </p>

      <section className="mt-12">
        <p className="label mb-5">Primary lines</p>
        <div className="grid gap-5 md:grid-cols-2">
          {PRIMARY_LINES.map((line) => (
            <FamilyLineCard
              key={line.slug}
              line={line}
              members={membersByLine[line.slug] ?? []}
              size="large"
            />
          ))}
        </div>
      </section>

      <section className="mt-12">
        <p className="label mb-5">And more recently</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {SECONDARY_LINES.map((line) => (
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
