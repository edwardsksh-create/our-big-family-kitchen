'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Plus, X } from 'lucide-react';
import type { ContributorOption, FamilyLineOption } from '@/lib/recipes/form-options';
import { createContributorStub } from '@/lib/contributors/create-stub';

export function ContributorPicker({
  value,
  options,
  onChange,
  onCreate,
  familyLines,
  recipePrimaryFamilyLineId,
}: {
  value: string | undefined;
  options: ContributorOption[];
  onChange: (id: string | undefined) => void;
  onCreate: (created: ContributorOption) => void;
  familyLines: FamilyLineOption[];
  recipePrimaryFamilyLineId?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = useMemo(
    () => options.find((c) => c.id === value),
    [options, value],
  );

  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);
  const [highlight, setHighlight] = useState(-1);

  // Inline create-stub state
  const [creating, setCreating]               = useState(false);
  const [stubName, setStubName]               = useState('');
  const [stubFamilyLine, setStubFamilyLine]   = useState<string>('');
  const [stubSecondary, setStubSecondary]     = useState<string>('');
  const [showSecondary, setShowSecondary]     = useState(false);
  const [stubEmail, setStubEmail]             = useState('');
  const [stubError, setStubError]             = useState<string | null>(null);
  const [pending, startTransition]            = useTransition();

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 12);
    return options.filter((c) => c.display.toLowerCase().includes(q)).slice(0, 12);
  }, [query, options]);

  const exactMatch = filtered.some(
    (c) => c.display.toLowerCase() === query.trim().toLowerCase(),
  );
  const showCreateRow = query.trim().length >= 2 && !exactMatch;

  function openCreateForm() {
    setStubName(query.trim());
    setStubFamilyLine(recipePrimaryFamilyLineId ?? '');
    setStubSecondary('');
    setShowSecondary(false);
    setStubEmail('');
    setStubError(null);
    setCreating(true);
    setOpen(false);
  }

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setStubError(null);
    if (!stubFamilyLine) {
      setStubError('Pick a family line for this person.');
      return;
    }
    if (showSecondary && stubSecondary && stubSecondary === stubFamilyLine) {
      setStubError('Primary and secondary family lines must be different.');
      return;
    }
    startTransition(async () => {
      const result = await createContributorStub({
        name:                  stubName,
        familyLineId:          stubFamilyLine,
        secondaryFamilyLineId: showSecondary && stubSecondary ? stubSecondary : undefined,
        email:                 stubEmail.trim() || undefined,
      });
      if (!result.ok) {
        setStubError(humanError(result.error));
        return;
      }
      onCreate(result.contributor);
      onChange(result.contributor.id);
      setCreating(false);
      setQuery('');
    });
  }

  function clear() {
    onChange(undefined);
    setQuery('');
    inputRef.current?.focus();
    setOpen(true);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); return; }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const max = filtered.length + (showCreateRow ? 1 : 0) - 1;
      setHighlight((h) => Math.min(h + 1, max));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight < 0) return;
      if (highlight < filtered.length) {
        const c = filtered[highlight];
        onChange(c.id);
        setQuery('');
        setOpen(false);
      } else if (showCreateRow) {
        openCreateForm();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <span className="label">Contributor *</span>

      {/* Selected chip OR input */}
      {selected ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-rule bg-paper px-4 py-2 text-ink">
            <span className="font-serif">{selected.display}</span>
            <button
              type="button"
              onClick={clear}
              className="text-ink-soft hover:text-primary"
              aria-label="Change contributor"
            >
              <X size={14} />
            </button>
          </span>
        </div>
      ) : (
        <div className="relative mt-2">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(-1); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search contributors or type a new name…"
            autoComplete="off"
            className="w-full rounded-full border border-rule bg-paper px-5 py-3 text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
          />
          {open && (filtered.length > 0 || showCreateRow) && (
            <div
              role="listbox"
              className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-rule bg-paper shadow-[0_20px_60px_-30px_rgba(42,37,34,0.35)]"
            >
              <ul>
                {filtered.map((c, i) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => {
                        onChange(c.id);
                        setQuery('');
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors ${
                        i === highlight ? 'bg-ink/5' : ''
                      }`}
                    >
                      <span className="font-serif text-ink">{c.display}</span>
                      <span className="label">existing</span>
                    </button>
                  </li>
                ))}
                {showCreateRow && (
                  <li>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlight(filtered.length)}
                      onClick={openCreateForm}
                      className={`flex w-full items-center gap-2 border-t border-rule px-4 py-2.5 text-left text-primary transition-colors ${
                        highlight === filtered.length ? 'bg-ink/5' : ''
                      }`}
                    >
                      <Plus size={14} />
                      <span>
                        Add “<span className="font-serif italic">{query.trim()}</span>” as a new contributor
                      </span>
                    </button>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Inline create-stub form */}
      {creating && (
        <form onSubmit={submitCreate} className="mt-4 space-y-4 rounded-2xl border border-rule bg-paper p-5">
          <p className="label">Add a new contributor</p>
          <p className="text-sm text-ink-soft">
            Use this when the recipe is from someone who hasn’t signed up yet —
            a grandparent, an aunt, a family friend. You can add their email
            later to invite them.
          </p>

          <label className="block">
            <span className="label">Name *</span>
            <input
              type="text"
              value={stubName}
              onChange={(e) => setStubName(e.target.value)}
              required
              autoFocus
              className="mt-2 w-full rounded-full border border-rule bg-paper px-5 py-3 text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
            />
          </label>

          <label className="block">
            <span className="label">Primary family line *</span>
            <select
              value={stubFamilyLine}
              onChange={(e) => setStubFamilyLine(e.target.value)}
              className="mt-2 w-full rounded-full border border-rule bg-paper px-5 py-3 text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
            >
              <option value="">— Select —</option>
              {familyLines.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </label>

          {!showSecondary ? (
            <button
              type="button"
              onClick={() => setShowSecondary(true)}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              + Add a secondary family line
            </button>
          ) : (
            <label className="block">
              <span className="label flex items-center gap-3">
                Secondary family line
                <button
                  type="button"
                  onClick={() => { setShowSecondary(false); setStubSecondary(''); }}
                  className="font-sans text-xs lowercase tracking-normal text-ink-soft hover:text-primary"
                >
                  remove
                </button>
              </span>
              <select
                value={stubSecondary}
                onChange={(e) => setStubSecondary(e.target.value)}
                className="mt-2 w-full rounded-full border border-rule bg-paper px-5 py-3 text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
              >
                <option value="">— Select —</option>
                {familyLines.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <p className="mt-1 text-sm text-ink-soft">
                For when someone belongs to two lines — e.g. an Edwards who became a Sundy by marriage.
              </p>
            </label>
          )}

          <label className="block">
            <span className="label">Email (optional)</span>
            <input
              type="email"
              value={stubEmail}
              onChange={(e) => setStubEmail(e.target.value)}
              placeholder="If you have one — leaves blank otherwise"
              className="mt-2 w-full rounded-full border border-rule bg-paper px-5 py-3 text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
            />
            <p className="mt-1 text-sm text-ink-soft">
              Without an email they won&rsquo;t be able to sign in yet. You can add one later.
            </p>
          </label>

          {stubError && (
            <p className="rounded-xl border border-rule bg-paper p-3 text-sm text-ink-soft">
              <span className="font-serif italic">{stubError}</span>
            </p>
          )}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
              {pending ? 'Creating…' : 'Create contributor'}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="text-sm text-ink-soft hover:text-primary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function humanError(code: string): string {
  switch (code) {
    case 'unauthorized':         return 'You don’t have permission to create contributors.';
    case 'name_too_short':       return 'Please enter a name.';
    case 'name_too_long':        return 'That name is too long.';
    case 'family_line_required': return 'Pick a family line.';
    case 'email_taken':          return 'That email is already taken by another contributor.';
    default:                     return 'Something went wrong creating the contributor.';
  }
}
