'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { applyPhotoEdits } from '@/app/album/actions';

type AspectMode = 'original' | 'square' | '4:3' | '3:2';

/** Admin crop & rotate — shared by the album lightbox and the review queue. The cropper reports the crop
 *  rectangle in rotated-image pixels; the server (applyPhotoEdits) rotates
 *  then extracts, so what you frame is what you get. Non-destructive: the
 *  untouched original is always kept. */
export function PhotoEditor({ photoId, imageUrl, onDone }: { photoId: string; imageUrl: string; onDone: () => void }) {
  const router = useRouter();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [aspectMode, setAspectMode] = useState<AspectMode>('original');
  const [mediaAspect, setMediaAspect] = useState(4 / 3);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sideways = rotation === 90 || rotation === 270;
  const aspect =
    aspectMode === 'square' ? 1
    : aspectMode === '4:3'  ? 4 / 3
    : aspectMode === '3:2'  ? 3 / 2
    : (sideways ? 1 / mediaAspect : mediaAspect);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await applyPhotoEdits(photoId, {
        rotation,
        cropPixels: areaPixels
          ? { x: areaPixels.x, y: areaPixels.y, width: areaPixels.width, height: areaPixels.height }
          : null,
      });
      if (!res.ok) {
        setError(
          res.error === 'processing_failed'
            ? 'This photo can\u2019t be edited here (HEIC originals can\u2019t be processed).'
            : 'Couldn\u2019t save the edit \u2014 try again.',
        );
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div>
      <div className="relative w-full overflow-hidden rounded-xl bg-ink" style={{ height: 'min(60vh, 480px)' }}>
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_area, pixels) => setAreaPixels(pixels)}
          onMediaLoaded={(size) => setMediaAspect(size.naturalWidth / size.naturalHeight)}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-soft" data-no-print>
        <button type="button" disabled={pending} onClick={() => setRotation((r) => (((r + 270) % 360) as 0 | 90 | 180 | 270))}
          className="rounded-full border border-rule bg-paper px-3 py-1.5 hover:border-ink hover:text-ink disabled:opacity-50">
          ⟲ Left
        </button>
        <button type="button" disabled={pending} onClick={() => setRotation((r) => (((r + 90) % 360) as 0 | 90 | 180 | 270))}
          className="rounded-full border border-rule bg-paper px-3 py-1.5 hover:border-ink hover:text-ink disabled:opacity-50">
          ⟳ Right
        </button>
        <label className="flex items-center gap-2">
          Zoom
          <input type="range" min={1} max={3} step={0.05} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))} className="accent-[#8D2842]" />
        </label>
        <div className="flex items-center gap-1.5">
          {(['original', 'square', '4:3', '3:2'] as AspectMode[]).map((m) => (
            <button key={m} type="button" disabled={pending} onClick={() => setAspectMode(m)}
              className={
                aspectMode === m
                  ? 'rounded-full border border-ink bg-ink px-2.5 py-1 text-xs text-paper'
                  : 'rounded-full border border-rule bg-paper px-2.5 py-1 text-xs text-ink-soft hover:border-ink'
              }>
              {m === 'original' ? 'Original' : m === 'square' ? 'Square' : m}
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
            {pending ? 'Saving\u2026' : 'Save'}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm italic text-accent">{error}</p>}
      <p className="mt-2 font-serif text-xs italic text-ink-soft">
        The untouched original is always kept \u2014 an edit can be undone later.
      </p>
    </div>
  );
}
