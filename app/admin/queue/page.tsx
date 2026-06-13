import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import {
  fetchPendingQueue,
  parseSort,
  sortQueue,
  type QueueSort,
} from '@/lib/recipes/queue';
import { FAMILY } from '@/config/family';

export const metadata = { title: 'Admin queue' };
export const dynamic   = 'force-dynamic';

const FLAG_TAG_SLUGS = new Set([
  'needs-instructions',
  'low-confidence',
  'possible-duplicate',
  'lucys-recipe-collection',
]);

const SORT_OPTIONS: { value: QueueSort; label: string }[] = [
  { value: 'newest',     label: 'Newest first' },
  { value: 'confidence', label: 'Confidence: lowest first' },
];

const SORT_LABEL: Record<QueueSort, string> = {
  newest:     'newest first',
  confidence: 'confidence (lowest first)',
};

export default async function AdminQueuePage({
  searchParams,
}: {
  searchParams: { sort?: string; session_complete?: string; n?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect('/sign-in?next=/admin/queue');
  if (session.user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-prose px-6 py-16 text-center">
        <p className="label mb-3">Admin</p>
        <h1 className="font-serif text-3xl text-ink">Admins only.</h1>
        <p className="mt-2 text-ink-soft">This page is just for {FAMILY.adminName}.</p>
      </div>
    );
  }

  const sort = parseSort(searchParams.sort);
  const rows = await fetchPendingQueue();
  const sorted = sortQueue(rows, sort);

  const sessionComplete = searchParams.session_complete === 'true';
  const reviewedCount = Number(searchParams.n);
  const showBanner = sessionComplete && Number.isFinite(reviewedCount) && reviewedCount > 0;

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">Admin</p>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-serif text-4xl text-ink md:text-5xl">Review queue</h1>
        <form method="get" className="flex items-center gap-2">
          <label htmlFor="sort" className="label">Sort</label>
          <select
            id="sort"
            name="sort"
            defaultValue={sort}
            className="rounded-md border border-rule bg-paper px-3 py-1.5 font-sans text-sm text-ink shadow-sm"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md border border-rule px-3 py-1.5 font-sans text-sm text-ink-soft hover:text-ink"
          >
            Apply
          </button>
        </form>
      </div>
      <p className="mt-3 max-w-prose text-ink-soft">
        Recipes contributors have submitted for review. Open one to review and publish.
      </p>

      {showBanner && (
        <div className="mt-6 rounded-2xl border border-rule bg-card-blush/40 p-5">
          <p className="font-serif text-xl text-ink">
            Queue complete — reviewed {reviewedCount} this session.
          </p>
          {sorted.length > 0 && (
            <p className="mt-1 text-sm text-ink-soft">
              {sorted.length} {sorted.length === 1 ? 'recipe' : 'recipes'} arrived while you were reviewing. Open one below to keep going.
            </p>
          )}
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-rule p-12 text-center">
          <p className="font-serif italic text-2xl text-ink-soft">Queue is empty.</p>
          <p className="mt-2 text-sm text-ink-soft">Nothing waiting on you right now.</p>
        </div>
      ) : (
        <table className="mt-10 w-full text-left">
          <thead>
            <tr className="label border-b border-rule">
              <th className="py-3">Title</th>
              <th className="py-3">Contributor</th>
              <th className="py-3">Section</th>
              <th className="py-3">Flags</th>
              <th className="py-3">Submitted</th>
              <th className="py-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const flags = r.tagSlugs.filter((s) => FLAG_TAG_SLUGS.has(s));
              const pos = i + 1;
              const reviewHref =
                `/admin/queue/${r.id}/review` +
                `?sort=${encodeURIComponent(sort)}` +
                `&pos=${pos}` +
                `&total=${sorted.length}`;
              return (
                <tr key={r.id} className="border-b border-rule">
                  <td className="py-3 font-serif text-ink">
                    {r.title}
                  </td>
                  <td className="py-3 text-ink-soft">
                    {r.contributor?.name ?? r.contributor?.email ?? '—'}
                  </td>
                  <td className="py-3 text-ink-soft">{r.section?.name ?? '—'}</td>
                  <td className="py-3">
                    {flags.length === 0 ? (
                      <span className="text-ink-soft">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {flags.map((slug) => (
                          <span
                            key={slug}
                            className="rounded-full bg-card-burgundy px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.12em] text-paper"
                          >
                            {slug.replace(/-/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-3 text-ink-soft">
                    {new Date(r.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                  </td>
                  <td className="py-3 space-x-4">
                    <Link
                      href={reviewHref}
                      className="text-primary underline decoration-rule underline-offset-4 hover:decoration-primary"
                    >
                      Review
                    </Link>
                    {r.slug && (
                      <Link
                        href={`/recipes/${r.slug}`}
                        className="text-ink-soft underline decoration-rule underline-offset-4 hover:text-primary"
                      >
                        Preview
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Tiny help so the sort label isn't a mystery — only meaningful when
          the queue has items. */}
      {sorted.length > 1 && (
        <p className="mt-6 text-sm text-ink-soft">
          Sorted by <span className="font-serif italic">{SORT_LABEL[sort]}</span>.
          Review advances through this order — change the sort here and reopen to
          re-order the rest of your session.
        </p>
      )}
    </div>
  );
}
