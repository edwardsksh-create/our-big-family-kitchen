'use client';

import { useEffect, useState } from 'react';
import { RecipeForm } from '@/components/recipe-form';
import { PhotoUploader } from '@/components/photo-uploader';
import type { FormOptions } from '@/lib/recipes/form-options';
import { type RecipeDraft, type PhotoEntry, draftFromPhotoParse, emptyDraft } from '@/lib/recipes/draft';
import type { ParsedFromPhotos } from '@/lib/photos/intake';

const MAX_PHOTOS = 5;

// Loading copy that rotates while the AI is reading the photos.
const LOADING_MESSAGES = [
  'Reading your photos…',
  'Finding the title…',
  'Sorting the ingredients…',
  'Following the steps…',
  'Almost done…',
];

export function AddViaPhoto({ options, isAdmin }: { options: FormOptions; isAdmin: boolean }) {
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [photos, setPhotos]       = useState<PhotoEntry[]>([]);
  const [parsing, setParsing]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [draft, setDraft]         = useState<RecipeDraft | null>(null);

  // Rotate loading copy while parsing.
  useEffect(() => {
    if (!parsing) return;
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[i]);
    }, 4000);
    return () => clearInterval(t);
  }, [parsing]);

  async function onContinue() {
    if (photos.length === 0) return;
    setParsing(true);
    setError(null);
    setLoadingMsg(LOADING_MESSAGES[0]);
    try {
      const res = await fetch('/api/photos/parse', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ photo_urls: photos.map((p) => p.public_url) }),
      });
      if (!res.ok) {
        // Soft-fall to manual: drop the user on the review screen with a
        // blank draft, photos still attached.
        const fallback = emptyDraft();
        fallback.source_photos = photos;
        if (options.currentContributor) {
          fallback.contributor_id         = options.currentContributor.id;
          fallback.primary_family_line_id = options.currentContributor.primary_family_line_id ?? undefined;
        }
        setDraft(fallback);
        setError('We had trouble reading these photos — fill in the rest by hand.');
        return;
      }
      const body = (await res.json()) as { recipe: ParsedFromPhotos };
      const next = draftFromPhotoParse(body.recipe, photos);
      if (options.currentContributor) {
        next.contributor_id = options.currentContributor.id;
        // Use the contributor's primary line unless the AI's section suggestion
        // already maps to a different one. (Family line and section are separate
        // concerns; this matches the manual flow.)
        if (!next.primary_family_line_id) {
          next.primary_family_line_id = options.currentContributor.primary_family_line_id ?? undefined;
        }
      }
      // Map AI's suggested_section slug → section_id from options.
      const sectionSlug = body.recipe.suggested_section;
      if (sectionSlug && sectionSlug !== 'uncategorized') {
        const matched = options.sections.find((s) => s.slug === sectionSlug);
        if (matched) next.section_id = matched.id;
      }
      setDraft(next);
    } catch (err) {
      setError((err as Error).message || 'Something went wrong.');
    } finally {
      setParsing(false);
    }
  }

  if (draft) {
    return (
      <div className="mt-10">
        {error && (
          <p className="mb-6 rounded-xl border border-rule bg-paper p-4 text-sm text-ink-soft">
            <span className="font-serif italic">{error}</span>
          </p>
        )}
        <RecipeForm options={options} initial={draft} isAdmin={isAdmin} />
      </div>
    );
  }

  return (
    <div className="mt-10 space-y-6">
      <PhotoUploader
        kind="source"
        photos={photos}
        onChange={setPhotos}
        maxPhotos={MAX_PHOTOS}
        sessionId={sessionId}
        onSessionId={setSessionId}
      />

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onContinue}
          disabled={photos.length === 0 || parsing}
          className="btn-primary disabled:opacity-60"
        >
          {parsing ? loadingMsg : 'Continue →'}
        </button>
        <span className="text-sm text-ink-soft">
          {parsing
            ? 'This can take 15–30 seconds.'
            : photos.length === 0
              ? 'Add at least one photo to continue.'
              : 'We’ll read what’s in the photos and let you review.'}
        </span>
      </div>

      {error && !parsing && (
        <p className="rounded-xl border border-rule bg-paper p-3 text-sm text-ink-soft">
          <span className="font-serif italic">{error}</span>
        </p>
      )}
    </div>
  );
}
