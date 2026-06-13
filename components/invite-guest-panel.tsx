'use client';

import { useState } from 'react';
import { createViewerInviteLink } from '@/lib/invites/share-link';

// Generate a one-time view-only link and copy it to share. The family member
// sends it however they like (text, email); the guest opens it, enters their
// email, and gets a sign-in link.
export function InviteGuestPanel() {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    const result = await createViewerInviteLink();
    setLoading(false);
    if (result.ok) setUrl(result.url);
    else setError('Couldn’t create a link just now — try again in a moment.');
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is selectable in the box regardless */
    }
  }

  if (url) {
    return (
      <div className="mt-8 rounded-2xl border border-rule bg-paper p-6">
        <p className="font-serif text-lg italic text-ink">Here’s your view-only link.</p>
        <p className="mt-1 text-sm text-ink-soft">
          Send it to your guest. They’ll enter their email and get a sign-in link.
          It works once, and expires in 30 days.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-full border border-rule bg-cream/40 px-4 py-2 font-mono text-sm text-ink"
          />
          <button type="button" onClick={copy} className="btn-primary shrink-0">
            {copied ? 'Copied ✓' : 'Copy link'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => { setUrl(null); setCopied(false); }}
          className="mt-4 text-sm italic text-ink-soft hover:text-primary"
        >
          Make another link →
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <button type="button" onClick={generate} disabled={loading} className="btn-primary disabled:opacity-60">
        {loading ? 'Creating…' : 'Create a view-only link'}
      </button>
      {error && <p className="mt-3 text-sm italic text-accent">{error}</p>}
    </div>
  );
}
