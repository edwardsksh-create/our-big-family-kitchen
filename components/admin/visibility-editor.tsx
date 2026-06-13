'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { SiteArea, VisibilityMap } from '@/lib/access';
import { saveVisibility } from '@/app/admin/visibility/actions';

type AreaCopy = { key: SiteArea; title: string; note: string };

// Order + copy for the four areas. Kept here (not config) because it's UI
// labelling, not behaviour.
const AREA_COPY: AreaCopy[] = [
  { key: 'recipes',      title: 'Recipes',      note: 'The recipe collection, plus the section pages and search.' },
  { key: 'family',       title: 'Family lines', note: 'The family-line pages and the family trees.' },
  { key: 'contributors', title: 'Contributors', note: 'The people pages — who’s added and cooked what.' },
  { key: 'album',        title: 'Photo album',  note: 'Family photos. The most personal corner of the site.' },
];

export function VisibilityEditor({ initial }: { initial: VisibilityMap }) {
  const router = useRouter();
  const [map, setMap] = useState<VisibilityMap>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError]   = useState<string | null>(null);
  const [saved, setSaved]   = useState(false);

  const dirty = AREA_COPY.some((a) => map[a.key] !== initial[a.key]);
  const allPrivate = AREA_COPY.every((a) => map[a.key] === 'private');

  function setArea(area: SiteArea, makePublic: boolean) {
    setSaved(false);
    setMap((m) => ({ ...m, [area]: makePublic ? 'public' : 'private' }));
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveVisibility(map);
      if (!result.ok) {
        setError(humanError(result.error));
        return;
      }
      setSaved(true);
      // Refresh so the header and any open page re-read the new visibility.
      router.refresh();
    });
  }

  return (
    <div className="mt-10 space-y-6">
      <p className="max-w-prose text-ink-soft">
        <span className="font-serif italic text-ink">Public</span> areas are open to
        anyone with the link — no sign-in. <span className="font-serif italic text-ink">Private</span>{' '}
        areas ask visitors to sign in first; view-only guests you invite from{' '}
        <span className="font-serif italic text-ink">/invite</span> can still see them.
        Adding, editing, and admin always require signing in, whatever you choose here.
      </p>

      <ul className="space-y-4">
        {AREA_COPY.map((a) => {
          const isPublic = map[a.key] === 'public';
          return (
            <li
              key={a.key}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rule bg-paper p-5"
            >
              <div className="min-w-0">
                <h2 className="font-serif text-xl text-ink">{a.title}</h2>
                <p className="mt-1 text-sm text-ink-soft">{a.note}</p>
              </div>
              <div className="flex shrink-0 overflow-hidden rounded-full border border-rule">
                <button
                  type="button"
                  onClick={() => setArea(a.key, false)}
                  aria-pressed={!isPublic}
                  className={`px-4 py-2 text-sm transition ${
                    !isPublic ? 'bg-ink text-paper' : 'bg-paper text-ink-soft hover:text-ink'
                  }`}
                >
                  Private
                </button>
                <button
                  type="button"
                  onClick={() => setArea(a.key, true)}
                  aria-pressed={isPublic}
                  className={`px-4 py-2 text-sm transition ${
                    isPublic ? 'bg-ink text-paper' : 'bg-paper text-ink-soft hover:text-ink'
                  }`}
                >
                  Public
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {allPrivate && (
        <p className="text-sm italic text-ink-soft">
          Everything is private — the whole site is a sign-in door. Guests reach it
          through a view-only invite link.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-6">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="btn-primary disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save visibility'}
        </button>
        {saved && !dirty && (
          <span className="font-serif text-sm italic text-ink-soft">Saved.</span>
        )}
        {dirty && !pending && (
          <span className="font-serif text-sm italic text-ink-soft">Unsaved changes.</span>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-rule bg-paper p-3 text-sm text-ink-soft">
          <span className="font-serif italic">{error}</span>
        </p>
      )}
    </div>
  );
}

function humanError(code: string): string {
  switch (code) {
    case 'unauthorized':   return 'You need to be signed in.';
    case 'admin_only':     return 'Admins only.';
    case 'bad_value':      return 'That didn’t look right — reload and try again.';
    case 'db_write_failed': return 'Save failed — try again in a moment.';
    default:               return 'Something went wrong.';
  }
}
