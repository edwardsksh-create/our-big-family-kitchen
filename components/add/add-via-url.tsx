'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RecipeForm } from '@/components/recipe-form';
import type { FormOptions } from '@/lib/recipes/form-options';
import { type RecipeDraft, draftFromParsed } from '@/lib/recipes/draft';
import type { ParsedRecipe } from '@/lib/recipe-parser';

export function AddViaUrl({ options, isAdmin }: { options: FormOptions; isAdmin: boolean }) {
  const router = useRouter();
  const [url, setUrl]         = useState('');
  const [draft, setDraft]     = useState<RecipeDraft | null>(null);
  const [via, setVia]         = useState<'jsonld' | 'ai-fallback' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [canPasteInstead, setCanPasteInstead] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCanPasteInstead(false);
    try {
      const res = await fetch('/api/recipes/parse-url', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ url }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.message || 'We couldn’t reach that page.');
        setCanPasteInstead(true);
        return;
      }
      const { recipe, via: viaResp, sourceUrl } = body as {
        recipe: ParsedRecipe;
        via: 'jsonld' | 'ai-fallback';
        sourceUrl: string;
      };
      const next = draftFromParsed(recipe, { sourceUrl });
      if (!next.originally_from) next.originally_from = sourceUrl;
      if (options.currentContributor) {
        next.contributor_id         = options.currentContributor.id;
        next.primary_family_line_id = options.currentContributor.primary_family_line_id ?? undefined;
      }
      setVia(viaResp);
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
        <p className="mb-4 text-sm text-ink-soft">
          <span className="font-serif italic">
            {via === 'jsonld' ? 'Parsed cleanly from the page’s recipe data.' : 'Best-effort AI parse.'}
          </span>{' '}
          Review the fields before saving.
        </p>
        <RecipeForm options={options} initial={draft} isAdmin={isAdmin} />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-10 space-y-4">
      <label className="block">
        <span className="label">Recipe URL</span>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          placeholder="https://smittenkitchen.com/..."
          className="mt-2 w-full rounded-full border border-rule bg-paper px-5 py-3 text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
        />
      </label>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={loading} className="btn-primary disabled:opacity-60">
          {loading ? 'Fetching…' : 'Fetch recipe →'}
        </button>
      </div>
      {error && (
        <div className="rounded-xl border border-rule bg-paper p-4 text-sm text-ink-soft">
          <p className="font-serif italic">{error}</p>
          {canPasteInstead && (
            <button
              type="button"
              onClick={() => router.push(`/add/paste?from=${encodeURIComponent(url)}`)}
              className="mt-3 inline-flex items-center text-primary underline decoration-rule underline-offset-4 hover:decoration-primary"
            >
              Paste the recipe text instead →
            </button>
          )}
        </div>
      )}
    </form>
  );
}
