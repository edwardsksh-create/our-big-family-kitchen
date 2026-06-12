'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDisplayName } from '@/lib/contributors/display-name';
import { captionLead, joinNames } from '@/lib/photos/photo-caption';
import { addPhotoComment, deletePhotoComment, setHeroEligible, updatePhotoDetails } from '@/app/album/actions';
import { canDeleteComment, canPostComment, type CommentViewer } from '@/lib/recipes/comment-permissions';
import { PhotoEditor } from '@/components/photo-editor';
import type { FamilyPhotoFull, OccasionType } from '@/lib/queries/family-photos';

type PersonOption = { ref: string; label: string };

export function AlbumClient({
  photos,
  occasions,
  initialPhotoId = null,
  isAdmin = false,
  viewer,
}: {
  photos:    FamilyPhotoFull[];
  occasions: OccasionType[];
  /** Shows the admin-only hero toggle in the lightbox. The server action
   *  re-checks the role; this prop is display-only. */
  isAdmin?:  boolean;
  /** Comment permissions for the lightbox composer (server re-checks). */
  viewer:    CommentViewer | null;
  /** From /album?photo=<id> — recipe and contributor pages deep-link a
   *  specific photo. An id that isn't in the (reviewed) set simply doesn't
   *  open a lightbox: the find() below comes up empty and the grid shows. */
  initialPhotoId?: string | null;
}) {
  const [personRef, setPersonRef] = useState('');
  const [occasion,  setOccasion]  = useState('');
  const [decade,    setDecade]    = useState('');
  const [place,     setPlace]     = useState('');
  const [search,    setSearch]    = useState('');
  const [openPhotoId, setOpenPhotoId] = useState<string | null>(initialPhotoId);

  const personOptions: PersonOption[] = useMemo(() => {
    const m = new Map<string, string>();
    for (const photo of photos) {
      for (const p of photo.people) {
        const ref = `${p.person_type}:${p.id}`;
        if (!m.has(ref)) {
          m.set(ref, formatDisplayName({ fullName: p.name, nickname: p.nickname, birth_name: p.birth_name }));
        }
      }
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([ref, label]) => ({ ref, label }));
  }, [photos]);

  const placeOptions = useMemo(() => {
    const s = new Set<string>();
    for (const p of photos) if (p.place) s.add(p.place);
    return [...s].sort();
  }, [photos]);

  const decadeOptions = useMemo(() => {
    const s = new Set<string>();
    for (const p of photos) {
      const m = p.year?.match(/\b(19|20)(\d)/);
      if (m) s.add(`${m[1]}${m[2]}0s`);
    }
    return [...s].sort().reverse();
  }, [photos]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return photos.filter((p) => {
      if (personRef) {
        const has = p.people.some((x) => `${x.person_type}:${x.id}` === personRef);
        if (!has) return false;
      }
      if (occasion && !p.occasions.includes(occasion)) return false;
      if (decade) {
        const m = p.year?.match(/\b(19|20)(\d)/);
        const d = m ? `${m[1]}${m[2]}0s` : '';
        if (d !== decade) return false;
      }
      if (place && p.place !== place) return false;
      if (q) {
        const hay = [
          p.caption ?? '',
          p.place ?? '',
          p.additional_people ?? '',
          p.pets ?? '',
          ...p.people.map((x) => x.name),
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [photos, personRef, occasion, decade, place, search]);

  const openPhoto = openPhotoId ? photos.find((p) => p.id === openPhotoId) ?? null : null;

  // Keep the address bar in sync with the open photo so "how do I link to
  // this photo?" is just: copy the URL. replaceState avoids polluting the
  // back button with every lightbox click.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (openPhotoId) url.searchParams.set('photo', openPhotoId);
    else url.searchParams.delete('photo');
    window.history.replaceState(null, '', url);
  }, [openPhotoId]);

  // Position of the open photo inside the *filtered* set so next/prev paging
  // respects whichever filter is active. -1 when the open photo doesn't
  // belong to the filtered list (e.g. the user just typed a filter that
  // excludes it). In that case paging is disabled until they reset.
  const currentIndex = openPhoto ? filtered.findIndex((p) => p.id === openPhoto.id) : -1;
  const hasPrev      = currentIndex > 0;
  const hasNext      = currentIndex >= 0 && currentIndex < filtered.length - 1;
  const goPrev       = () => { if (hasPrev) setOpenPhotoId(filtered[currentIndex - 1].id); };
  const goNext       = () => { if (hasNext) setOpenPhotoId(filtered[currentIndex + 1].id); };

  return (
    <>
      <div className="mb-10 flex flex-wrap items-center gap-3">
        <select
          value={personRef}
          onChange={(e) => setPersonRef(e.target.value)}
          className="rounded-full border border-rule bg-paper px-3 py-1.5 text-sm"
        >
          <option value="">Anyone</option>
          {personOptions.map((p) => <option key={p.ref} value={p.ref}>{p.label}</option>)}
        </select>
        <select
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
          className="rounded-full border border-rule bg-paper px-3 py-1.5 text-sm"
        >
          <option value="">Any occasion</option>
          {occasions.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
        </select>
        <select
          value={decade}
          onChange={(e) => setDecade(e.target.value)}
          className="rounded-full border border-rule bg-paper px-3 py-1.5 text-sm"
        >
          <option value="">Any decade</option>
          {decadeOptions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        {placeOptions.length > 0 && (
          <select
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            className="rounded-full border border-rule bg-paper px-3 py-1.5 text-sm"
          >
            <option value="">Anywhere</option>
            {placeOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search captions and people…"
          className="ml-auto w-full rounded-full border border-rule bg-paper px-4 py-1.5 text-sm md:max-w-xs"
        />
        {(personRef || occasion || decade || place || search) && (
          <button
            type="button"
            onClick={() => { setPersonRef(''); setOccasion(''); setDecade(''); setPlace(''); setSearch(''); }}
            className="text-sm italic text-ink-soft hover:text-primary"
          >
            Clear
          </button>
        )}
      </div>

      <p className="label mb-6 text-ink-soft">
        {filtered.length} {filtered.length === 1 ? 'photo' : 'photos'}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-rule p-12 text-center">
          <p className="font-serif italic text-2xl text-ink-soft">No photos match those filters.</p>
        </div>
      ) : (
        // Decade headers between groups — the photos arrive sorted year-desc
        // (undated last), so scrolling reads as time travel. Captions and
        // metadata still live in the lightbox only; the grid stays a wall.
        <div className="space-y-12">
          {groupByDecade(filtered).map((group) => (
            <section key={group.label}>
              <h3 className="font-serif text-2xl text-ink">{group.label}</h3>
              <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {group.photos.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setOpenPhotoId(p.id)}
                      className="group block w-full overflow-hidden rounded-2xl border border-rule bg-paper"
                    >
                      <div className="relative aspect-[4/3] w-full">
                        <Image
                          src={p.public_url}
                          alt={p.caption ?? 'Family photo'}
                          fill
                          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                          className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                          loading="lazy"
                        />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {openPhoto && (
        <Lightbox
          photo={openPhoto}
          occasions={occasions}
          isAdmin={isAdmin}
          viewer={viewer}
          onClose={() => setOpenPhotoId(null)}
          hasPrev={hasPrev}
          hasNext={hasNext}
          onPrev={goPrev}
          onNext={goNext}
        />
      )}
    </>
  );
}

function decadeOf(year: string | null): string | null {
  const m = year?.match(/\b(19|20)(\d)/);
  return m ? `${m[1]}${m[2]}0s` : null;
}

/** Group an already-sorted (year desc, undated last) photo list into
 *  contiguous decade groups for the grid's section headers. */
function groupByDecade(photos: FamilyPhotoFull[]): { label: string; photos: FamilyPhotoFull[] }[] {
  const groups: { label: string; photos: FamilyPhotoFull[] }[] = [];
  for (const p of photos) {
    const label = decadeOf(p.year) ?? 'Undated';
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.photos.push(p);
    else groups.push({ label, photos: [p] });
  }
  return groups;
}

function Lightbox({
  photo,
  occasions,
  isAdmin,
  viewer,
  onClose,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: {
  photo: FamilyPhotoFull;
  occasions: OccasionType[];
  isAdmin: boolean;
  viewer: CommentViewer | null;
  onClose: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const occasionName = (slug: string) => occasions.find((o) => o.slug === slug)?.name ?? slug;
  const [editing, setEditing] = useState(false);
  // A fresh photo (paging) leaves edit mode.
  useEffect(() => { setEditing(false); }, [photo.id]);

  // Single keyboard listener for the lightbox lifetime: paging arrows +
  // Escape to close. Re-bound when handler identities change so the latest
  // hasPrev/hasNext from the parent's filtered-set computation is honored.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')         { onClose(); return; }
      if (e.key === 'ArrowRight' && hasNext) { e.preventDefault(); onNext(); return; }
      if (e.key === 'ArrowLeft'  && hasPrev) { e.preventDefault(); onPrev(); return; }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasNext, hasPrev, onNext, onPrev, onClose]);

  // Swipe detection. We only count it as a horizontal swipe when |Δx| clears
  // the SWIPE_THRESHOLD and the gesture is dominantly horizontal (avoids
  // hijacking the user's vertical scroll on tall metadata).
  const SWIPE_THRESHOLD = 50;
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (Math.abs(dy) > Math.abs(dx)) return;
    // Mobile-gallery convention: swipe LEFT (Δx negative) advances; swipe
    // RIGHT goes back.
    if (dx < 0 && hasNext) onNext();
    else if (dx > 0 && hasPrev) onPrev();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-full max-w-5xl overflow-y-auto rounded-2xl bg-paper p-4 shadow-2xl md:p-6"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full border border-rule bg-paper px-3 py-1 text-sm text-ink hover:bg-cream/40"
        >
          ×
        </button>

        {editing ? (
          <PhotoEditor photoId={photo.id} imageUrl={photo.public_url} onDone={() => setEditing(false)} />
        ) : (
        <>
        <div className="relative w-full" style={{ aspectRatio: '4/3' }}>
          <Image
            src={photo.public_url}
            alt={photo.caption ?? 'Family photo'}
            fill
            sizes="(min-width: 1024px) 80vw, 100vw"
            className="object-contain"
          />
          {/* Previous / next chevrons live INSIDE the image area so they
              vertically center on the photo regardless of metadata height
              below. Hidden at the ends of the filtered set so the visual
              chrome reflects what's actually reachable. */}
          {hasPrev && (
            <button
              type="button"
              onClick={onPrev}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-rule bg-paper/90 p-2 text-ink shadow-md hover:bg-paper md:left-4"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              onClick={onNext}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-rule bg-paper/90 p-2 text-ink shadow-md hover:bg-paper md:right-4"
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          )}
        </div>
        {/* Metadata composed as a photo-book caption line — "Thanksgiving
            1987, at Grandma's — Nancy, Laura, and Annie (and Biscuit)" —
            instead of labeled fields. People keep their contributor links. */}
        <div className="mt-4 space-y-2 text-sm text-ink-soft">
          {photo.caption && <p className="font-serif text-lg italic text-ink">{photo.caption}</p>}
          {(() => {
            const lead = captionLead({
              occasionNames: photo.occasions.map(occasionName),
              year:          photo.year,
              place:         photo.place,
            });
            const hasPeople = photo.people.length > 0 || !!photo.additional_people;
            if (!lead && !hasPeople && !photo.pets) return null;
            return (
              <p className="leading-relaxed">
                {lead}
                {lead && hasPeople && ' — '}
                {photo.people.map((p, i) => {
                  const formatted = formatDisplayName({ fullName: p.name, nickname: p.nickname, birth_name: p.birth_name });
                  const node = p.contributor_slug
                    ? <Link href={`/contributors/${p.contributor_slug}`} className="text-ink hover:text-primary">{formatted}</Link>
                    : <span className="text-ink">{formatted}</span>;
                  const isLast       = i === photo.people.length - 1;
                  const isSecondLast = i === photo.people.length - 2;
                  return (
                    <span key={`${p.person_type}:${p.id}`}>
                      {node}
                      {!isLast && (isSecondLast && !photo.additional_people
                        ? (photo.people.length > 2 ? ', and ' : ' and ')
                        : ', ')}
                    </span>
                  );
                })}
                {photo.additional_people && (
                  <span>
                    {photo.people.length > 0 && ', and '}
                    {photo.additional_people}
                  </span>
                )}
                {photo.pets && <span> (and {joinNames(photo.pets.split(/,\s*/))})</span>}
              </p>
            );
          })()}
          {photo.recipes.length > 0 && (
            <p className="font-serif italic">
              From this table:{' '}
              {photo.recipes.map((r, i) => (
                <span key={r.id}>
                  <Link href={`/recipes/${r.slug}`} className="not-italic text-primary hover:underline">{r.title}</Link>
                  {i < photo.recipes.length - 1 && ', '}
                </span>
              ))}
            </p>
          )}
          <PhotoComments photo={photo} viewer={viewer} />
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <DetailsEditor photo={photo} />
              <HeroToggle photo={photo} />
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="mt-3 rounded-full border border-rule bg-paper px-3 py-1 text-xs text-ink-soft hover:border-ink hover:text-ink"
              >
                Crop &amp; rotate
              </button>
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
/** Admin-only: opt this photo in/out of the public home-page hero rotation.
 *  Quiet hairline row at the bottom of the lightbox metadata. */
function HeroToggle({ photo }: { photo: FamilyPhotoFull }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const res = await setHeroEligible(photo.id, !photo.hero_eligible);
      if (!res.ok) {
        setError('Couldn’t save — try again.');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-rule pt-3" data-no-print>
      <span className="font-serif text-xs italic text-ink-soft">
        {photo.hero_eligible
          ? 'This photo appears on the home page.'
          : 'Not on the home page.'}
      </span>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="rounded-full border border-rule bg-paper px-3 py-1 text-xs text-ink-soft hover:border-ink hover:text-ink disabled:opacity-50"
      >
        {pending ? 'Saving…' : photo.hero_eligible ? 'Take it off' : 'Show on the home page'}
      </button>
      {error && <span className="text-xs italic text-accent">{error}</span>}
    </div>
  );
}

/** Memories on a photo — the same communal layer recipes have. */
function PhotoComments({ photo, viewer }: { photo: FamilyPhotoFull; viewer: CommentViewer | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mayPost = viewer ? canPostComment(viewer) : false;

  function post() {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const res = await addPhotoComment({ photoId: photo.id, body });
      if (!res.ok) { setError('Couldn’t save — try again.'); return; }
      setDraft('');
      router.refresh();
    });
  }
  function remove(commentId: string) {
    if (!confirm('Delete this memory?')) return;
    startTransition(async () => {
      const res = await deletePhotoComment(commentId);
      if (!res.ok) { setError('Couldn’t delete — try again.'); return; }
      router.refresh();
    });
  }

  if (photo.comments.length === 0 && !mayPost) return null;
  return (
    <div className="border-t border-rule pt-3">
      {photo.comments.length > 0 && (
        <ul className="space-y-3">
          {photo.comments.map((c) => (
            <li key={c.id}>
              <p className="text-ink">
                <span className="font-serif italic">“{c.body}\u201D</span>
                <span className="text-ink-soft"> — {c.author.displayName}</span>
                {viewer && canDeleteComment(viewer, { authorContributorId: c.authorContributorId }) && (
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    disabled={pending}
                    className="ml-2 text-xs italic text-ink-soft hover:text-accent disabled:opacity-50"
                  >
                    delete
                  </button>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
      {mayPost && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); post(); } }}
            placeholder="Remember this day? Add a memory…"
            className="min-w-[16rem] flex-1 rounded-full border border-rule bg-paper px-4 py-2 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
          />
          <button
            type="button"
            onClick={post}
            disabled={pending || draft.trim().length === 0}
            className="rounded-full bg-primary px-4 py-2 font-sans text-sm text-paper transition-colors hover:bg-ink disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Add memory'}
          </button>
          {error && <span className="text-sm italic text-accent">{error}</span>}
        </div>
      )}
    </div>
  );
}

/** Admin-only: fix caption / year / place in place. */
function DetailsEditor({ photo }: { photo: FamilyPhotoFull }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState(photo.caption ?? '');
  const [year, setYear] = useState(photo.year ?? '');
  const [place, setPlace] = useState(photo.place ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updatePhotoDetails(photo.id, { caption, year, place });
      if (!res.ok) { setError('Couldn’t save — try again.'); return; }
      router.refresh();
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setCaption(photo.caption ?? ''); setYear(photo.year ?? ''); setPlace(photo.place ?? ''); setOpen(true); }}
        className="mt-3 rounded-full border border-rule bg-paper px-3 py-1 text-xs text-ink-soft hover:border-ink hover:text-ink"
      >
        Edit details
      </button>
    );
  }
  return (
    <div className="mt-3 w-full space-y-2 rounded-xl border border-rule bg-cream/30 p-3">
      <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption"
        className="w-full rounded-lg border border-rule bg-paper px-3 py-1.5 text-sm" />
      <div className="flex flex-wrap gap-2">
        <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year"
          className="w-36 rounded-lg border border-rule bg-paper px-3 py-1.5 text-sm" />
        <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Place"
          className="min-w-[10rem] flex-1 rounded-lg border border-rule bg-paper px-3 py-1.5 text-sm" />
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={save} disabled={pending}
          className="rounded-full bg-primary px-4 py-1.5 text-sm text-paper hover:bg-ink disabled:opacity-50">
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={pending}
          className="rounded-full border border-rule bg-paper px-4 py-1.5 text-sm text-ink-soft hover:border-ink disabled:opacity-50">
          Cancel
        </button>
        {error && <span className="text-sm italic text-accent">{error}</span>}
      </div>
    </div>
  );
}
