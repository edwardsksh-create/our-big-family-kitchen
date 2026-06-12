'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { Cropper, type ReactCropperElement } from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import { applyPhotoEdits } from '@/app/album/actions';

type AspectMode = 'free' | 'original' | 'square' | '4:3' | '3:2';

/** Admin crop & rotate — shared by the album lightbox and the review queue.
 *  Cropper.js under the hood: free-form crop by default (drag any edge or
 *  corner), aspect locks on demand, rotation in the same preview. Its
 *  getData contract — rotate first, then crop by x/y/width/height in the
 *  rotated image's natural pixels — is exactly what applyPhotoEdits does
 *  server-side. Non-destructive: the untouched original is always kept. */
export function PhotoEditor({ photoId, imageUrl, onDone }: { photoId: string; imageUrl: string; onDone: () => void }) {
  const router = useRouter();
  const cropperRef = useRef<ReactCropperElement>(null);
  const [aspectMode, setAspectMode] = useState<AspectMode>('free');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cropper() {
    return cropperRef.current?.cropper ?? null;
  }

  function rotate(deg: 90 | -90) {
    const c = cropper();
    if (!c) return;
    c.rotate(deg);
    c.setAspectRatio(NaN);
    // Cropper keeps the zoom scale through a rotation, so a sideways canvas
    // overflows the container and the crop box can't reach the whole image
    // (a save would silently crop it). Refit the rotated canvas into the
    // container, centered, then snap the crop box to the full frame.
    const cont = c.getContainerData();
    const nat  = c.getCanvasData(); // naturalWidth/Height are the ROTATED frame
    const scale = Math.min(cont.width / nat.naturalWidth, cont.height / nat.naturalHeight);
    const width  = nat.naturalWidth * scale;
    const height = nat.naturalHeight * scale;
    const left   = (cont.width - width) / 2;
    const top    = (cont.height - height) / 2;
    c.setCanvasData({ left, top, width, height });
    c.setCropBoxData({ left, top, width, height });
    setAspectMode('free');
  }

  function setAspect(mode: AspectMode) {
    setAspectMode(mode);
    const c = cropper();
    if (!c) return;
    const img = c.getImageData();
    const sideways = (((c.getData().rotate % 360) + 360) % 360) % 180 === 90;
    const natural = sideways
      ? img.naturalHeight / img.naturalWidth
      : img.naturalWidth / img.naturalHeight;
    const aspect =
      mode === 'square' ? 1
      : mode === '4:3'  ? 4 / 3
      : mode === '3:2'  ? 3 / 2
      : mode === 'original' ? natural
      : NaN; // free
    c.setAspectRatio(aspect);
  }

  function save() {
    const c = cropper();
    if (!c) return;
    setError(null);
    const d = c.getData(true);
    const rotation = (((d.rotate % 360) + 360) % 360) as 0 | 90 | 180 | 270;
    startTransition(async () => {
      const res = await applyPhotoEdits(photoId, {
        rotation,
        cropPixels: { x: d.x, y: d.y, width: d.width, height: d.height },
      });
      if (!res.ok) {
        setError(
          res.error === 'processing_failed'
            ? 'This photo can’t be edited here (HEIC originals can’t be processed).'
            : 'Couldn’t save the edit — try again.',
        );
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl bg-ink">
        <Cropper
          ref={cropperRef}
          src={imageUrl}
          style={{ height: 'min(60vh, 480px)', width: '100%' }}
          viewMode={0}
          autoCropArea={1}
          background={false}
          checkCrossOrigin={false}
          responsive
          guides
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-soft" data-no-print>
        <button type="button" disabled={pending} onClick={() => rotate(-90)}
          className="rounded-full border border-rule bg-paper px-3 py-1.5 hover:border-ink hover:text-ink disabled:opacity-50">
          ⟲ Left
        </button>
        <button type="button" disabled={pending} onClick={() => rotate(90)}
          className="rounded-full border border-rule bg-paper px-3 py-1.5 hover:border-ink hover:text-ink disabled:opacity-50">
          ⟳ Right
        </button>
        <div className="flex items-center gap-1.5">
          {(['free', 'original', 'square', '4:3', '3:2'] as AspectMode[]).map((m) => (
            <button key={m} type="button" disabled={pending} onClick={() => setAspect(m)}
              className={
                aspectMode === m
                  ? 'rounded-full border border-ink bg-ink px-2.5 py-1 text-xs text-paper'
                  : 'rounded-full border border-rule bg-paper px-2.5 py-1 text-xs text-ink-soft hover:border-ink'
              }>
              {m === 'free' ? 'Free' : m === 'original' ? 'Original' : m === 'square' ? 'Square' : m}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onDone} disabled={pending}
            className="rounded-full border border-rule bg-paper px-4 py-1.5 text-ink-soft hover:border-ink hover:text-ink disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={pending}
            className="rounded-full bg-primary px-4 py-1.5 text-paper hover:bg-ink disabled:opacity-50">
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm italic text-accent">{error}</p>}
      <p className="mt-2 font-serif text-xs italic text-ink-soft">
        Drag any edge or corner to crop freely. The untouched original is always kept — an edit can be undone later.
      </p>
    </div>
  );
}
