'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { addComment, deleteComment } from '@/app/recipes/[slug]/comments/actions';
import { canDeleteComment, canPostComment, type CommentViewer } from '@/lib/recipes/comment-permissions';
import type { RecipeComment } from '@/lib/queries/recipe-comments';

type Props = {
  recipeId:   string;
  recipeSlug: string;
  comments:   RecipeComment[];
  viewer:     CommentViewer;
};

export function RecipeComments({ recipeId, recipeSlug, comments, viewer }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mayPost = canPostComment(viewer);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (body.length === 0) return;
    setError(null);
    startTransition(async () => {
      const res = await addComment({ recipeId, recipeSlug, body });
      if (!res.ok) {
        setError(humanError(res.error));
        return;
      }
      setDraft('');
      router.refresh();
    });
  }

  function onDelete(commentId: string) {
    if (!confirm('Delete this memory?')) return;
    startTransition(async () => {
      const res = await deleteComment({ commentId, recipeSlug });
      if (!res.ok) {
        setError(humanError(res.error));
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="mt-16" data-no-print>
      <h2 className="font-serif text-2xl text-ink">Family notes &amp; memories</h2>

      {comments.length === 0 ? (
        <p className="mt-4 font-serif italic text-ink-soft">
          No memories added yet — be the first.
        </p>
      ) : (
        <ul className="mt-6 space-y-5">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl border border-rule bg-paper p-5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-serif text-lg text-ink">
                  <Link href={`/contributors/${c.author.slug}`} className="hover:text-primary">
                    {c.author.displayName}
                  </Link>
                </p>
                <p className="text-xs text-ink-soft/70">{formatDate(c.createdAt)}</p>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-ink-soft">{c.body}</p>
              {canDeleteComment(viewer, { authorContributorId: c.authorContributorId }) && (
                <p className="mt-3">
                  <button
                    type="button"
                    onClick={() => onDelete(c.id)}
                    disabled={pending}
                    className="inline-flex items-center gap-1 text-xs italic text-ink-soft hover:text-accent disabled:opacity-50"
                  >
                    <Trash2 size={12} aria-hidden="true" />
                    Delete
                  </button>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {mayPost ? (
        <form onSubmit={onSubmit} className="mt-8 rounded-2xl border border-rule bg-cream/30 p-5">
          <p className="font-serif italic text-ink">
            Remember when this was served, who made it, or why people love it? Add it here.
          </p>
          <textarea
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setError(null); }}
            rows={4}
            placeholder="A short memory or note…"
            className="mt-3 w-full rounded-xl border border-rule bg-paper px-4 py-3 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              type="submit"
              disabled={pending || draft.trim().length === 0}
              className="rounded-full bg-primary px-4 py-2 font-sans text-sm font-medium text-paper transition-colors hover:bg-ink disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Add memory'}
            </button>
            {error && <p className="text-sm italic text-accent">{error}</p>}
          </div>
        </form>
      ) : viewer.contributorId === null ? (
        <p className="mt-6 text-sm italic text-ink-soft">
          <Link href={`/sign-in?next=/recipes/${recipeSlug}`} className="text-primary hover:underline">
            Sign in
          </Link>{' '}
          to add a memory.
        </p>
      ) : null}
    </section>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function humanError(code: string): string {
  switch (code) {
    case 'unauthorized':     return 'Sign in to post a memory.';
    case 'cannot_post':      return 'Your account isn’t set up for posting yet.';
    case 'invalid_body':     return 'Add something to your memory before saving.';
    case 'recipe_not_found': return 'That recipe is gone.';
    case 'forbidden':        return 'Only the author or Kate can delete this.';
    case 'comment_not_found':return 'That memory has already been removed.';
    default:                 return 'Couldn’t save — try again.';
  }
}
