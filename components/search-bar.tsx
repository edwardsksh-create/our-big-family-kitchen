'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, Search } from 'lucide-react';

type Suggestion = {
  id: string;
  title: string;
  contributor: string | null;
  sectionSlug: string | null;
  href: string;
  external: boolean;
};

export function SearchBar() {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);

  const [q, setQ] = useState('');
  const [open, setOpen]               = useState(false);
  const [results, setResults]         = useState<Suggestion[]>([]);
  const [highlight, setHighlight]     = useState(-1);
  const [loading, setLoading]         = useState(false);

  // Debounced fetch on q change
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setResults(data.results ?? []);
        setHighlight(-1);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 140);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  // Close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function submit() {
    const term = q.trim();
    if (!term) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, -1));
    } else if (e.key === 'Enter') {
      if (highlight >= 0 && results[highlight]) {
        const r = results[highlight];
        if (r.external) {
          window.open(r.href, '_blank', 'noopener,noreferrer');
        } else {
          router.push(r.href);
        }
        setOpen(false);
      } else {
        submit();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative w-full max-w-xs">
      <label htmlFor={inputId} className="sr-only">Search recipes</label>
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
          aria-hidden="true"
        />
        <input
          id={inputId}
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search recipes"
          autoComplete="off"
          className="w-full rounded-full border border-rule bg-paper py-2 pl-9 pr-4 font-sans text-sm text-ink outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-ink/10"
        />
      </div>

      {open && (results.length > 0 || (q.trim().length >= 2 && !loading)) && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-2xl border border-rule bg-paper shadow-[0_20px_60px_-30px_rgba(42,37,34,0.35)]"
        >
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-soft">No matches.</p>
          ) : (
            <ul>
              {results.map((r, i) => (
                <li key={r.id}>
                  <a
                    href={r.href}
                    target={r.external ? '_blank' : undefined}
                    rel={r.external ? 'noopener noreferrer' : undefined}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => setOpen(false)}
                    className={`flex items-start gap-2 px-4 py-2.5 transition-colors ${
                      i === highlight ? 'bg-ink/5' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-sm font-semibold leading-snug text-ink truncate">
                        {r.title}
                      </p>
                      {r.contributor && (
                        <p className="font-sans text-xs text-ink-soft truncate">{r.contributor}</p>
                      )}
                    </div>
                    {r.external && (
                      <ExternalLink size={11} className="mt-1 shrink-0 text-ink-soft" aria-hidden="true" />
                    )}
                  </a>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={submit}
                  onMouseEnter={() => setHighlight(-1)}
                  className="w-full border-t border-rule px-4 py-2.5 text-left font-sans text-xs uppercase tracking-[0.12em] text-primary hover:bg-ink/5"
                >
                  See all results for “{q.trim()}” →
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
