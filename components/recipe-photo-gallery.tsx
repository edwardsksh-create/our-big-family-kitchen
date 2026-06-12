'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type GalleryPhoto = {
  id:      string;
  url:     string;
  caption: string | null;
};

/**
 * Grid of recipe photos (extra dish shots, source scans) with an in-page
 * lightbox — the same viewing pattern as the album, minus the metadata
 * block. Replaces the old target="_blank" raw-URL tabs, which dumped the
 * reader out of the archive onto a bare image.
 */
export function RecipePhotoGallery({
  photos,
  aspect = '4/3',
  altPrefix,
}: {
  photos: GalleryPhoto[];
  /** Grid tile aspect; source scans use a taller window. */
  aspect?: '4/3' | '4/5';
  altPrefix: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const open    = openIndex !== null ? photos[openIndex] ?? null : null;
  const hasPrev = openIndex !== null && openIndex > 0;
  const hasNext = openIndex !== null && openIndex < photos.length - 1;
  const goPrev  = () => { if (hasPrev) setOpenIndex((i) => (i as number) - 1); };
  const goNext  = () => { if (hasNext) setOpenIndex((i) => (i as number) + 1); };

  return (
    <>
      <ul className={`grid gap-3 ${aspect === '4/5' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        {photos.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setOpenIndex(i)}
              className="block w-full overflow-hidden rounded-2xl border border-rule"
              aria-label={`View ${p.caption || `${altPrefix} ${i + 1}`} full size`}
            >
              <div className={`relative w-full ${aspect === '4/5' ? 'aspect-[4/5]' : 'aspect-[4/3]'}`}>
                <Image
                  src={p.url}
                  alt={p.caption || `${altPrefix} ${i + 1}`}
                  fill
                  sizes="(min-width: 1024px) 30vw, 50vw"
                  className="object-cover"
                  loading="lazy"
                />
              </div>
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <Lightbox
          photo={open}
          alt={open.caption || `${altPrefix} ${(openIndex as number) + 1}`}
          onClose={() => setOpenIndex(null)}
          hasPrev={hasPrev}
          hasNext={hasNext}
          onPrev={goPrev}
          onNext={goNext}
        />
      )}
    </>
  );
}

function Lightbox({
  photo,
  alt,
  onClose,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: {
  photo: GalleryPhoto;
  alt: string;
  onClose: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')                { onClose(); return; }
      if (e.key === 'ArrowRight' && hasNext) { e.preventDefault(); onNext(); return; }
      if (e.key === 'ArrowLeft'  && hasPrev) { e.preventDefault(); onPrev(); return; }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasNext, hasPrev, onNext, onPrev, onClose]);

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
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;
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
        className="relative max-h-full w-full max-w-4xl rounded-2xl bg-paper p-4 shadow-2xl md:p-6"
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
        <div className="relative w-full" style={{ aspectRatio: '4/3' }}>
          <Image
            src={photo.url}
            alt={alt}
            fill
            sizes="(min-width: 1024px) 80vw, 100vw"
            className="object-contain"
          />
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
        {photo.caption && (
          <p className="mt-3 font-serif text-base italic text-ink">{photo.caption}</p>
        )}
      </div>
    </div>
  );
}
