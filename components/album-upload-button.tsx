'use client';

import { useRef, useState } from 'react';
import { Plus, Upload, X } from 'lucide-react';
import {
  FAMILY_PHOTO_ALLOWED_MIME,
  MAX_FAMILY_PHOTO_BYTES,
  MAX_FAMILY_PHOTOS_PER_SUBMIT,
} from '@/lib/photos/album-submit';
import { FAMILY } from '@/config/family';

type Status =
  | { kind: 'idle' }
  | { kind: 'uploading' }
  | { kind: 'success'; count: number }
  | { kind: 'error';   message: string };

export function AlbumUploadButton() {
  const [open, setOpen]       = useState(false);
  const [files, setFiles]     = useState<File[]>([]);
  const [note, setNote]       = useState('');
  const [status, setStatus]   = useState<Status>({ kind: 'idle' });
  const inputRef = useRef<HTMLInputElement | null>(null);

  function reset() {
    setFiles([]);
    setNote('');
    setStatus({ kind: 'idle' });
    if (inputRef.current) inputRef.current.value = '';
  }

  function onSelectFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list).slice(0, MAX_FAMILY_PHOTOS_PER_SUBMIT);
    const reject = picked.find((f) =>
      !FAMILY_PHOTO_ALLOWED_MIME.has(f.type) || f.size > MAX_FAMILY_PHOTO_BYTES,
    );
    if (reject) {
      setStatus({
        kind: 'error',
        message: !FAMILY_PHOTO_ALLOWED_MIME.has(reject.type)
          ? `${reject.name} isn't a supported image (JPG, PNG, HEIC, or WEBP).`
          : `${reject.name} is over the 15 MB limit.`,
      });
      return;
    }
    setStatus({ kind: 'idle' });
    setFiles(picked);
  }

  async function submit() {
    if (files.length === 0) return;
    setStatus({ kind: 'uploading' });
    try {
      const fd = new FormData();
      for (const f of files) fd.append('photos', f);
      if (note.trim()) fd.append('note', note.trim());
      const res = await fetch('/api/album/upload', { method: 'POST', body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        setStatus({ kind: 'error', message: humanError(body.error, body.message) });
        return;
      }
      setStatus({ kind: 'success', count: body.count ?? files.length });
    } catch (err) {
      console.error(err);
      setStatus({ kind: 'error', message: 'Upload failed — check your connection and try again.' });
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-sans text-sm font-medium text-paper transition-colors hover:bg-ink"
      >
        <Plus size={14} aria-hidden="true" />
        Add photos
      </button>
    );
  }

  return (
    <div className="w-full sm:max-w-md">
      <div className="rounded-2xl border-2 border-accent/40 bg-accent/10 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-serif text-lg italic text-ink">Add photos to the album</p>
          <button
            type="button"
            onClick={() => { setOpen(false); reset(); }}
            className="text-ink-soft hover:text-primary"
            aria-label="Close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {FAMILY.adminName} will review and tag what you send before it shows up here.
        </p>

        {status.kind === 'success' ? (
          <div className="mt-4 rounded-xl border border-rule bg-paper p-4 text-sm">
            <p className="font-serif italic text-ink">
              Thanks for adding to our family album! {FAMILY.adminName} will review your
              photo{status.count === 1 ? '' : 's'} and make public shortly.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-3 text-xs italic text-ink-soft hover:text-primary"
            >
              Send more photos →
            </button>
          </div>
        ) : (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/heic,image/webp,.heic"
              multiple
              onChange={(e) => onSelectFiles(e.target.files)}
              className="mt-4 block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-paper file:px-4 file:py-2 file:font-sans file:text-sm file:text-ink file:hover:bg-cream/40"
            />
            {files.length > 0 && (
              <p className="mt-2 text-xs text-ink-soft">
                {files.length} photo{files.length === 1 ? '' : 's'} selected
                {files.length === MAX_FAMILY_PHOTOS_PER_SUBMIT && ' (max per batch)'}.
              </p>
            )}

            <label className="mt-4 block">
              <span className="label text-ink">A note (optional)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Tell us what this is, who's in it, roughly when, if you know."
                className="mt-2 w-full rounded-xl border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
              />
            </label>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={submit}
                disabled={files.length === 0 || status.kind === 'uploading'}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-sans text-sm font-medium text-paper transition-colors hover:bg-ink disabled:opacity-50"
              >
                <Upload size={14} aria-hidden="true" />
                {status.kind === 'uploading' ? 'Uploading…' : `Send to ${FAMILY.adminName}`}
              </button>
              {status.kind === 'error' && (
                <p className="text-sm italic text-accent">{status.message}</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function humanError(code: string | undefined, message: string | undefined): string {
  switch (code) {
    case 'unauthorized':      return 'Sign in to upload photos.';
    case 'not_a_contributor': return 'Your account isn\'t set up for uploads yet.';
    case 'cannot_upload':     return 'Your account isn\'t set up for uploads yet.';
    case 'no_photos':         return 'Pick at least one photo first.';
    case 'too_many':          return `Up to ${MAX_FAMILY_PHOTOS_PER_SUBMIT} photos per submission.`;
    case 'unsupported_type':  return message ?? 'That image type isn\'t supported.';
    case 'too_large':         return message ?? 'A photo is over the 15 MB limit.';
    case 'upload_failed':     return 'Couldn\'t save one of the photos — try again.';
    case 'db_insert_failed':  return 'Couldn\'t record one of the photos — try again.';
    default:                  return 'Upload failed — try again in a moment.';
  }
}
