import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { fetchFormOptions } from '@/lib/recipes/form-options';
import { fetchRecipeForEdit } from '@/lib/recipes/fetch-for-edit';
import { RecipeForm } from '@/components/recipe-form';
import {
  fetchPendingQueue,
  locateInQueue,
  parseSort,
  type QueueSort,
} from '@/lib/recipes/queue';
import { FAMILY } from '@/config/family';

export const metadata = { title: 'Review recipe' };
export const dynamic  = 'force-dynamic';

const SORT_LABEL: Record<QueueSort, string> = {
  newest:     'newest first',
  confidence: 'confidence (lowest first)',
};

export default async function AdminReviewPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { sort?: string; pos?: string; total?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect(`/sign-in?next=/admin/queue/${params.id}/review`);
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

  const [forEdit, options, pending] = await Promise.all([
    fetchRecipeForEdit(params.id),
    fetchFormOptions(session.user.email),
    fetchPendingQueue(),
  ]);
  if (!forEdit) notFound();

  const located = locateInQueue(pending, sort, params.id);

  // Position: prefer the URL param when it was passed (initial session
  // total stays stable as recipes get approved). Recompute from the
  // pending list when the URL didn't carry one (out-of-band visit).
  const urlPos = Number(searchParams.pos);
  const pos = Number.isFinite(urlPos) && urlPos > 0
    ? urlPos
    : located.pos ?? null;
  const urlTotal = Number(searchParams.total);
  const total = Number.isFinite(urlTotal) && urlTotal > 0
    ? urlTotal
    : located.total;

  // hasQueueContext means the form should auto-advance after approve/reject.
  // We require a pos so that the "session_complete=n=<pos>" hand-off carries
  // a meaningful number; an out-of-band visit with no URL params and a
  // recipe that's no longer pending falls back to the old non-advance flow.
  const hasQueueContext = pos !== null;

  const statusLabel: Record<typeof forEdit.status, string> = {
    draft:          'Draft',
    pending_review: 'Pending review',
    published:      'Published',
    rejected:       'Rejected',
  };

  return (
    <div className="mx-auto max-w-page px-6 py-12">
      <p className="label mb-3">
        <Link href={`/admin/queue?sort=${sort}`} className="hover:text-primary">Admin queue</Link>
        {' · '}
        Review
      </p>
      <h1 className="font-serif text-3xl text-ink md:text-4xl">Review recipe</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Current status: <span className="font-serif italic">{statusLabel[forEdit.status]}</span>
      </p>

      {hasQueueContext && (
        <p className="mt-1 text-sm text-ink-soft">
          Recipe <span className="font-serif italic">{pos}</span> of{' '}
          <span className="font-serif italic">{total}</span> in this session
          {' '}(sorted by <span className="font-serif italic">{SORT_LABEL[sort]}</span>).
        </p>
      )}

      <RecipeForm
        // key=recipe id forces a fresh mount when soft-navigating from one
        // review URL to the next. Without this, useState(initial) holds onto
        // the previous recipe's draft (including its source_photos!) and the
        // next Approve action posts stale data — the bug that lost photos
        // for ~11 binder recipes in the 2026-05-26 review session.
        key={params.id}
        options={options}
        initial={forEdit.draft}
        isAdmin
        mode="admin_review"
        queueContext={
          hasQueueContext
            ? {
                sort,
                pos: pos!,
                total,
                nextId: located.nextId,
              }
            : null
        }
      />
    </div>
  );
}
