'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RecipeForm } from '@/components/recipe-form';
import type { FormOptions } from '@/lib/recipes/form-options';
import { type RecipeDraft, draftFromParsed } from '@/lib/recipes/draft';
import type { ParsedRecipe } from '@/lib/recipe-parser';

type FailureReason =
  | 'http_forbidden'
  | 'http_not_found'
  | 'http_server_error'
  | 'http_other'
  | 'timeout'
  | 'network_error'
  | 'parse_failed';

type Failure = { reason: FailureReason; url: string; status?: number };

const FAILURE_HEADLINES: Record<FailureReason, string> = {
  http_forbidden:    'This site doesn’t allow automatic fetching.',
  http_not_found:    'We couldn’t find that page.',
  http_server_error: 'That site seems to be having issues right now.',
  http_other:        'We couldn’t reach that page.',
  timeout:           'We couldn’t reach that page in time.',
  network_error:     'We couldn’t reach that page.',
  parse_failed:      'We fetched the page but couldn’t find a recipe in it.',
};

export function AddViaUrl({ options, isAdmin, canPublish = false }: { options: FormOptions; isAdmin: boolean; canPublish?: boolean }) {
  const router = useRouter();
  const [url, setUrl]         = useState('');
  const [draft, setDraft]     = useState<RecipeDraft | null>(null);
  const [via, setVia]         = useState<'jsonld' | 'ai-fallback' | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFailure(null);
    try {
      const res = await fetch('/api/recipes/parse-url', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ url }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setFailure({
          reason: (body.error as FailureReason) ?? 'http_other',
          url,
          status: body.status,
        });
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
    } catch {
      // Network failure between the browser and our server (very rare).
      setFailure({ reason: 'network_error', url });
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
        <RecipeForm options={options} initial={draft} isAdmin={isAdmin} canPublish={canPublish} />
      </div>
    );
  }

  if (failure) {
    return (
      <div className="mt-10 rounded-2xl border border-rule bg-paper p-8 md:p-10">
        <p className="label">Couldn’t fetch</p>
        <h2 className="font-serif mt-2 text-2xl text-ink md:text-3xl">
          {FAILURE_HEADLINES[failure.reason]}
        </h2>
        <p className="mt-3 max-w-prose text-ink-soft">
          Some sites block automated requests. You can paste the recipe text
          instead, and we’ll save the URL as the source.
        </p>
        <p className="mt-2 max-w-prose text-sm text-ink-soft break-all font-mono">
          {failure.url}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => router.push(`/add/paste?originally_from=${encodeURIComponent(failure.url)}`)}
            className="btn-primary"
          >
            Paste recipe text →
          </button>
          <button
            type="button"
            onClick={() => { setFailure(null); setUrl(''); }}
            className="btn-ghost"
          >
            Try a different URL
          </button>
        </div>
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
    </form>
  );
}
