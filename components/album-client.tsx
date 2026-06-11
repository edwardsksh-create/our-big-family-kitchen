'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatDisplayName } from '@/lib/contributors/display-name';
import type { FamilyPhotoFull, OccasionType } from '@/lib/queries/family-photos';

type PersonOption = { ref: string; label: string };

export function AlbumClient({
  photos,
  occasions,
}: {
  photos:    FamilyPhotoFull[];
  occasions: OccasionType[];
}) {
  const [personRef, setPersonRef] = useState('');
  const [occasion,  setOccasion]  = useState('');
  const [decade,    setDecade]    = useState('');
  const [place,     setPlace]     = useState('');
  const [search,    setSearch]    = useState('');
  const [openPhotoId, setOpenPhotoId] = useState<string | null>(null);

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

  // Close lightbox on Escape.
  useEffect(() => {
    if (!openPhoto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenPhotoId(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPhoto]);

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
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => (
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
                {/* Captions and metadata live in the lightbox only — the
                    grid stays purely visual so browsing feels like a
                    photo wall. */}
              </button>
            </li>
          ))}
        </ul>
      )}

      {openPhoto && (
        <Lightbox photo={openPhoto} occasions={occasions} onClose={() => setOpenPhotoId(null)} />
      )}
    </>
  );
}

function Lightbox({
  photo,
  occasions,
  onClose,
}: {
  photo: FamilyPhotoFull;
  occasions: OccasionType[];
  onClose: () => void;
}) {
  const occasionName = (slug: string) => occasions.find((o) => o.slug === slug)?.name ?? slug;
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
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full border border-rule bg-paper px-3 py-1 text-sm text-ink hover:bg-cream/40"
        >
          ×
        </button>
        <div className="relative w-full" style={{ aspectRatio: '4/3' }}>
          <Image
            src={photo.public_url}
            alt={photo.caption ?? 'Family photo'}
            fill
            sizes="(min-width: 1024px) 80vw, 100vw"
            className="object-contain"
          />
        </div>
        <div className="mt-4 space-y-3 text-sm text-ink-soft">
          {photo.caption && <p className="font-serif text-lg italic text-ink">{photo.caption}</p>}
          {(photo.year || photo.place) && (
            <p>
              {photo.year}
              {photo.year && photo.place && ' · '}
              {photo.place}
            </p>
          )}
          {photo.people.length > 0 && (
            <p>
              <span className="label mr-2">People:</span>
              {photo.people.map((p, i) => {
                const formatted = formatDisplayName({ fullName: p.name, nickname: p.nickname, birth_name: p.birth_name });
                const node = p.contributor_slug
                  ? <Link href={`/contributors/${p.contributor_slug}`} className="text-ink hover:text-primary">{formatted}</Link>
                  : <span className="text-ink">{formatted}</span>;
                return (
                  <span key={`${p.person_type}:${p.id}`}>
                    {node}
                    {i < photo.people.length - 1 && ', '}
                  </span>
                );
              })}
            </p>
          )}
          {photo.additional_people && (
            <p><span className="label mr-2">Also:</span>{photo.additional_people}</p>
          )}
          {photo.pets && (
            <p><span className="label mr-2">Pets:</span>{photo.pets}</p>
          )}
          {photo.occasions.length > 0 && (
            <p><span className="label mr-2">Occasion:</span>{photo.occasions.map(occasionName).join(', ')}</p>
          )}
          {photo.recipes.length > 0 && (
            <p>
              <span className="label mr-2">Recipes:</span>
              {photo.recipes.map((r, i) => (
                <span key={r.id}>
                  <Link href={`/recipes/${r.slug}`} className="text-primary hover:underline">{r.title}</Link>
                  {i < photo.recipes.length - 1 && ', '}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
