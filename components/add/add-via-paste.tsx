'use client';

import { useState } from 'react';
import { RecipeForm } from '@/components/recipe-form';
import type { FormOptions } from '@/lib/recipes/form-options';
import { type RecipeDraft, draftFromParsed, emptyDraft } from '@/lib/recipes/draft';
import type { ParsedRecipe } from '@/lib/recipe-parser';

export function AddViaPaste({ options, isAdmin }: { options: FormOptions; isAdmin: boolean }) {
  const [text, setText]       = useState('');
  const [draft, setDraft]     = useState<RecipeDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 20) {
      setError('Paste at least a few lines.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/recipes/parse-text', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ text }),
      });
      if (!res.ok) {
        // Soft-fail: drop into manual mode with raw text pre-filled in story.
        const fallback = emptyDraft();
        fallback.story = text;
        if (options.currentContributor) {
          fallback.contributor_id         = options.currentContributor.id;
          fallback.primary_family_line_id = options.currentContributor.primary_family_line_id ?? undefined;
        }
        setDraft(fallback);
        setError('We couldn’t parse this one — here’s a blank form pre-filled with what we got.');
        return;
      }
      const { recipe } = (await res.json()) as { recipe: ParsedRecipe };
      const next = draftFromParsed(recipe);
      if (options.currentContributor) {
        next.contributor_id         = options.currentContributor.id;
        next.primary_family_line_id = options.currentContributor.primary_family_line_id ?? undefined;
      }
      setDraft(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
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
    <form onSubmit={submit} className="mt-10 space-y-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={16}
        placeholder="Paste your recipe here. Messy is fine — title, ingredients, steps, the story, all of it."
        className="w-full rounded-2xl border border-rule bg-paper p-4 font-sans text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
      />
      <div className="flex items-center gap-4">
        <button type="submit" disabled={loading} className="btn-primary disabled:opacity-60">
          {loading ? 'Reading the recipe…' : 'Continue →'}
        </button>
        <span className="text-sm text-ink-soft">
          {loading ? 'This usually takes a few seconds.' : 'AI will do a first pass at structuring it.'}
        </span>
      </div>
      {error && <p className="text-sm text-primary">{error}</p>}
    </form>
  );
}
