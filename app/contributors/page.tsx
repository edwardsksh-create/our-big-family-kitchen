import Link from 'next/link';
import { fetchAllContributors } from '@/lib/queries/contributors';

export const metadata = { title: 'Contributors' };
export const revalidate = 60;

export default async function ContributorsPage() {
  const all = await fetchAllContributors();
  // Hide pure-viewer stubs from the index unless they have any family line set
  // (a fresh stub still appears via its family-line page).
  const visible = all.filter((c) => c.role !== 'viewer' || c.family_lines.length > 0);

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">Contributors</p>
      <h1 className="font-serif text-4xl text-ink md:text-5xl">The cooks</h1>
      <p className="mt-3 max-w-prose text-ink-soft">
        Everyone who has cooked, written, photographed, or remembered.
      </p>

      <ul className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((c) => (
          <li key={c.id}>
            <Link
              href={`/contributors/${c.slug}`}
              className="block rounded-2xl border border-rule p-6 card-hover hover:border-ink"
            >
              <p className="font-serif text-xl text-ink">{c.name}</p>
              <p className="label mt-2">{c.role}</p>
              {c.family_lines.length > 0 && (
                <p className="mt-2 text-sm text-ink-soft">
                  {c.family_lines.map((f) => f.name).join(' · ')}
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
