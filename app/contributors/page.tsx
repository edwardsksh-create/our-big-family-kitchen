import Link from 'next/link';
import { fetchAllContributors } from '@/lib/queries/contributors';

export const metadata = { title: 'Contributors' };
export const revalidate = 60;

export default async function ContributorsPage() {
  const all = await fetchAllContributors();

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">Contributors</p>
      <h1 className="font-serif text-4xl text-ink md:text-5xl">The cooks, keepers, and rememberers.</h1>
      <p className="mt-3 max-w-prose text-ink-soft">
        Some people cooked the recipes. Some wrote them down. Some scanned,
        photographed, adapted, or simply remembered where they came from. They
        all belong here.
      </p>

      <ul className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {all.map((c) => (
          <li key={c.id}>
            <Link
              href={`/contributors/${c.slug}`}
              className="block rounded-2xl border border-rule p-6 card-hover hover:border-ink"
            >
              <p className="font-serif text-xl text-ink">{c.name}</p>
              {(c.primary_family_line || c.secondary_family_line) && (
                <p className="mt-2 text-sm text-ink-soft">
                  {c.primary_family_line?.name}
                  {c.secondary_family_line && (
                    <span className="text-ink-soft/70"> · {c.secondary_family_line.name}</span>
                  )}
                </p>
              )}
              {c.bio && <p className="mt-3 text-sm text-ink-soft">{c.bio}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
