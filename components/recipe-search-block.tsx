'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export function RecipeSearchBlock() {
  const router = useRouter();
  const [q, setQ] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <form onSubmit={submit} className="mt-5 max-w-xl">
      <label className="sr-only" htmlFor="recipes-search">Search the recipe box</label>
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft"
          aria-hidden="true"
        />
        <input
          id="recipes-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={'Try "shortbread," "Lucy," "chicken," or "Thanksgiving"'}
          autoComplete="off"
          className="w-full rounded-full border border-rule bg-paper py-3 pl-11 pr-28 font-sans text-base text-ink outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-ink/10"
        />
        <button
          type="submit"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-primary px-4 py-2 font-sans text-xs uppercase tracking-[0.14em] text-paper transition-colors hover:bg-ink"
        >
          Search
        </button>
      </div>
    </form>
  );
}
