'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, FolderOpen, X, Upload as UploadIcon } from 'lucide-react';
import type { PhotoEntry } from '@/lib/recipes/draft';
import { cn } from '@/lib/utils';

type UploadedResponse = {
  ok: true;
  session_id: string;
  photos: { storage_path: string; public_url: string; size_bytes: number; mime_type: string }[];
};

const ACCEPT = 'image/jpeg,image/png,image/heic,image/webp';

export type PhotoUploaderProps = {
  kind:             'source' | 'dish';
  /** Existing photos already in this slot. */
  photos:           PhotoEntry[];
  /** Called with the *full* new list after additions/removals. */
  onChange:         (next: PhotoEntry[]) => void;
  /** Hard cap on photos; null means unlimited. */
  maxPhotos?:       number | null;
  /** For 'dish' uploads on an existing recipe. */
  recipeId?:        string;
  /** For 'source' uploads, the session UUID so retries land in the same folder. */
  sessionId?:       string;
  onSessionId?:     (id: string) => void;
  /** Heading text. */
  label?:           string;
  /** Smaller density when used inline in the edit form. */
  compact?:         boolean;
};

export function PhotoUploader({
  kind,
  photos,
  onChange,
  maxPhotos = null,
  recipeId,
  sessionId,
  onSessionId,
  label,
  compact = false,
}: PhotoUploaderProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [dragOver, setDragOver]   = useState(false);

  const atLimit = maxPhotos != null && photos.length >= maxPhotos;
  const remaining = maxPhotos != null ? Math.max(0, maxPhotos - photos.length) : null;

  async function handleFiles(files: FileList | File[]) {
    setError(null);
    if (kind === 'dish' && !recipeId) {
      setError('Save the recipe first, then add finished-dish photos.');
      return;
    }
    const incoming = Array.from(files);
    if (incoming.length === 0) return;
    const accept = incoming.slice(0, remaining ?? incoming.length);
    if (accept.length < incoming.length) {
      setError(`Only adding ${accept.length} — limit ${maxPhotos} reached.`);
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.set('kind', kind);
      if (kind === 'dish' && recipeId) form.set('recipe_id', recipeId);
      if (sessionId) form.set('session_id', sessionId);
      for (const f of accept) form.append('photos', f);

      const res = await fetch('/api/photos/upload', { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message || 'We had trouble saving that. Try again?');
        return;
      }
      const body = (await res.json()) as UploadedResponse;
      if (kind === 'source' && onSessionId && body.session_id) onSessionId(body.session_id);
      const added: PhotoEntry[] = body.photos.map((p) => ({
        storage_path: p.storage_path,
        public_url:   p.public_url,
        photo_type:   kind,
      }));
      onChange([...photos, ...added]);
    } catch (err) {
      setError((err as Error).message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(idx: number) {
    const next = [...photos];
    next.splice(idx, 1);
    onChange(next);
  }

  return (
    <div>
      {label && <p className={compact ? 'label' : 'label mb-2'}>{label}</p>}

      {photos.length > 0 && (
        <ul
          className={cn(
            'grid gap-3',
            compact
              ? 'grid-cols-3 sm:grid-cols-4'
              : 'grid-cols-2 sm:grid-cols-3',
          )}
        >
          {photos.map((p, i) => (
            <li key={p.public_url} className="relative overflow-hidden rounded-2xl border border-rule bg-paper">
              <div className={cn('relative w-full', compact ? 'aspect-square' : 'aspect-[4/5]')}>
                <Image
                  src={p.public_url}
                  alt={p.caption || `${kind} photo ${i + 1}`}
                  fill
                  sizes="(min-width: 768px) 25vw, 50vw"
                  className="object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => removePhoto(i)}
                aria-label="Remove photo"
                className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink/80 text-paper hover:bg-ink"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!atLimit && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            'mt-4 rounded-2xl border border-dashed transition-colors',
            dragOver ? 'border-ink bg-ink/5' : 'border-rule',
            compact ? 'p-4' : 'p-6 md:p-8',
          )}
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
            >
              <Camera size={16} /> Take a photo
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-ghost inline-flex items-center gap-2 disabled:opacity-60"
            >
              <FolderOpen size={16} /> Choose from camera roll
            </button>
            <span className="hidden flex-1 text-sm text-ink-soft md:inline">
              <UploadIcon size={12} className="mr-1 inline align-text-bottom" />
              Or drop photo files here
            </span>
          </div>

          <p className="mt-3 text-sm text-ink-soft">
            {uploading
              ? 'Saving your photo…'
              : maxPhotos != null
                ? `${photos.length} of ${maxPhotos} photos added`
                : `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} added`}
          </p>
        </div>
      )}

      {atLimit && (
        <p className="mt-4 text-sm text-ink-soft">
          {photos.length} of {maxPhotos} photos. Remove one to swap.
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-xl border border-rule bg-paper p-3 text-sm text-ink-soft">
          <span className="font-serif italic">{error}</span>
        </p>
      )}

      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
