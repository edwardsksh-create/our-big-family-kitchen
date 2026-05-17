'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import type { ContributorOption, FormOptions } from '@/lib/recipes/form-options';
import {
  type IngredientRow,
  type InstructionRow,
  type RecipeDraft,
  newRowId,
} from '@/lib/recipes/draft';
import { saveRecipe, type SaveAction, type SaveOutcome } from '@/lib/recipes/save';
import { ContributorPicker } from '@/components/contributor-picker';

const AUTO_SAVE_INTERVAL_MS = 30_000;

export function RecipeForm({
  options,
  initial,
  isAdmin,
}: {
  options: FormOptions;
  initial: RecipeDraft;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<RecipeDraft>(initial);
  const [contributors, setContributors] = useState<ContributorOption[]>(options.contributors);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');

  // Track whether the draft is dirty for auto-save.
  const dirtyRef = useRef(false);
  function update<K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) {
    dirtyRef.current = true;
    setDraft((d) => ({ ...d, [key]: value }));
  }

  // Auto-save (only after the form has the required FKs).
  useEffect(() => {
    const t = setInterval(async () => {
      if (!dirtyRef.current) return;
      if (!draft.primary_family_line_id || !draft.section_id) return;
      dirtyRef.current = false;
      const result = await saveRecipe(draft, 'draft');
      if (result.ok) {
        setDraft((d) => ({ ...d, id: result.recipeId }));
        setSavedAt(new Date());
      }
    }, AUTO_SAVE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [draft]);

  function doSave(action: SaveAction) {
    setError(null);
    startTransition(async () => {
      const result: SaveOutcome = await saveRecipe(draft, action);
      if (!result.ok) {
        setError(humanError(result.error));
        return;
      }
      setDraft((d) => ({ ...d, id: result.recipeId }));
      setSavedAt(new Date());
      if (action === 'publish' && result.slug) {
        router.push(`/recipes/${result.slug}`);
      } else if (action === 'submit_for_review') {
        router.push('/add/thanks');
      }
    });
  }

  return (
    <div className="mt-10 space-y-10">
      <FieldText
        label="Title"
        required
        value={draft.title}
        onChange={(v) => update('title', v)}
        placeholder="Grandma’s sour cream coffee cake"
      />

      <ContributorPicker
        value={draft.contributor_id}
        options={contributors}
        familyLines={options.familyLines}
        recipePrimaryFamilyLineId={draft.primary_family_line_id}
        onChange={(id) => update('contributor_id', id)}
        onCreate={(c) => setContributors((prev) =>
          prev.some((x) => x.id === c.id) ? prev : [...prev, c],
        )}
      />

      <FieldText
        label="Originally from"
        value={draft.originally_from ?? ''}
        onChange={(v) => update('originally_from', v)}
        placeholder="Aunt Nancy, the back of a Quaker Oats box, smittenkitchen.com…"
        helper="Where this recipe came from — a person, a cookbook, a website."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <FieldSelect
          label="Family line (primary)"
          required
          value={draft.primary_family_line_id ?? ''}
          onChange={(v) => update('primary_family_line_id', v)}
          options={options.familyLines.map((f) => ({ value: f.id, label: f.name }))}
        />
        <FieldSelect
          label="Family line (secondary)"
          value={draft.secondary_family_line_id ?? ''}
          onChange={(v) => update('secondary_family_line_id', v || undefined)}
          options={options.familyLines.map((f) => ({ value: f.id, label: f.name }))}
          helper="Sometimes a recipe belongs to two branches."
          allowBlank
        />
      </div>

      <FieldSelect
        label="Section"
        required
        value={draft.section_id ?? ''}
        onChange={(v) => update('section_id', v)}
        options={options.sections.map((s) => ({ value: s.id, label: s.name }))}
      />

      <FieldTextarea
        label="Story"
        value={draft.story ?? ''}
        onChange={(v) => update('story', v)}
        rows={5}
        helper="Why this recipe matters, where it came from, how you’ve changed it."
      />

      <Repeater<IngredientRow>
        title="Ingredients"
        rows={draft.ingredients}
        setRows={(rows) => update('ingredients', rows)}
        addLabel="Add ingredient"
        renderRow={(row, setRow) => (
          <div className="space-y-2">
            <input
              type="text"
              value={row.sub_header}
              onChange={(e) => setRow({ ...row, sub_header: e.target.value })}
              placeholder="Optional sub-header — e.g. For the dough:"
              className="w-full rounded-full border border-rule bg-paper px-4 py-2 text-sm italic text-ink-soft outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
            />
            <input
              type="text"
              value={row.item_text}
              onChange={(e) => setRow({ ...row, item_text: e.target.value })}
              placeholder="1 cup flour"
              className="w-full rounded-full border border-rule bg-paper px-4 py-2 text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
            />
          </div>
        )}
        newRow={() => ({ id: newRowId(), sub_header: '', item_text: '' })}
      />

      <Repeater<InstructionRow>
        title="Instructions"
        rows={draft.instructions}
        setRows={(rows) => update('instructions', rows)}
        addLabel="Add step"
        renderRow={(row, setRow) => (
          <div className="space-y-2">
            <input
              type="text"
              value={row.sub_header}
              onChange={(e) => setRow({ ...row, sub_header: e.target.value })}
              placeholder="Optional sub-header — e.g. Make the dough:"
              className="w-full rounded-full border border-rule bg-paper px-4 py-2 text-sm italic text-ink-soft outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
            />
            <textarea
              value={row.body}
              onChange={(e) => setRow({ ...row, body: e.target.value })}
              rows={3}
              placeholder="Mix the dry ingredients in a large bowl…"
              className="w-full rounded-2xl border border-rule bg-paper px-4 py-2 text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
            />
          </div>
        )}
        newRow={() => ({ id: newRowId(), sub_header: '', body: '' })}
      />

      {/* Tags */}
      <div>
        <p className="label">Tags</p>
        <p className="mt-1 text-sm text-ink-soft">
          Tags help people find recipes — try things like “weeknight”, “holiday”, “kid-friendly”, “gluten-free”.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {draft.tags.map((t, i) => (
            <span key={`${t}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-rule bg-paper px-3 py-1 text-sm text-ink">
              {t}
              <button
                type="button"
                onClick={() => update('tags', draft.tags.filter((_, idx) => idx !== i))}
                className="text-ink-soft hover:text-primary"
                aria-label={`Remove tag ${t}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const v = tagInput.trim().replace(/,$/, '');
                if (v && !draft.tags.includes(v)) update('tags', [...draft.tags, v]);
                setTagInput('');
              } else if (e.key === 'Backspace' && tagInput === '' && draft.tags.length > 0) {
                update('tags', draft.tags.slice(0, -1));
              }
            }}
            placeholder="Add a tag and press Enter"
            list="tag-suggestions"
            className="min-w-[180px] flex-1 rounded-full border border-rule bg-paper px-3 py-1 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
          />
          <datalist id="tag-suggestions">
            {options.tags.map((t) => (
              <option key={t.slug} value={t.name} />
            ))}
          </datalist>
        </div>
      </div>

      {/* Photos placeholder */}
      <div className="rounded-2xl border border-dashed border-rule p-6 text-center">
        <p className="label">Photos</p>
        <p className="mt-2 font-serif italic text-ink-soft">
          Photo upload coming soon — for now, recipes are text only.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-8">
        <button type="button" onClick={() => doSave('draft')} disabled={pending} className="btn-ghost disabled:opacity-60">
          Save as draft
        </button>
        {isAdmin ? (
          <button type="button" onClick={() => doSave('publish')} disabled={pending} className="btn-primary disabled:opacity-60">
            {pending ? 'Saving…' : 'Save and publish'}
          </button>
        ) : (
          <button type="button" onClick={() => doSave('submit_for_review')} disabled={pending} className="btn-primary disabled:opacity-60">
            {pending ? 'Submitting…' : 'Submit for review'}
          </button>
        )}
        <span className="ml-auto text-sm text-ink-soft" aria-live="polite">
          {savedAt ? `Saved · ${savedAt.toLocaleTimeString()}` : 'Draft auto-saves every 30 seconds.'}
        </span>
      </div>

      {error && (
        <p className="rounded-xl border border-rule bg-paper p-4 text-sm text-ink-soft">
          <span className="font-serif italic">{error}</span>
        </p>
      )}
    </div>
  );
}

function humanError(code: string): string {
  switch (code) {
    case 'unauthorized': return 'You need to be signed in to save.';
    case 'admin_only': return 'Only Kate can publish directly — try “Submit for review”.';
    case 'missing_title':       return 'Add a title before saving.';
    case 'missing_family_line': return 'Pick a primary family line.';
    case 'missing_section':     return 'Pick a section.';
    case 'pick_family_and_section_before_first_save':
      return 'Pick a primary family line and a section before the first save.';
    default: return 'Something went wrong saving. Try again in a moment.';
  }
}

// --- Small field primitives -----------------------------------------------

function FieldText({
  label, value, onChange, placeholder, helper, required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  helper?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="label">{label}{required && ' *'}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-full border border-rule bg-paper px-5 py-3 text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
      />
      {helper && <p className="mt-1 text-sm text-ink-soft">{helper}</p>}
    </label>
  );
}

function FieldTextarea({
  label, value, onChange, rows, helper,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  helper?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows ?? 4}
        className="mt-2 w-full rounded-2xl border border-rule bg-paper px-5 py-3 text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
      />
      {helper && <p className="mt-1 text-sm text-ink-soft">{helper}</p>}
    </label>
  );
}

function FieldSelect({
  label, value, onChange, options, required, disabled, helper, allowBlank,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  disabled?: boolean;
  helper?: string;
  allowBlank?: boolean;
}) {
  return (
    <label className="block">
      <span className="label">{label}{required && ' *'}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-2 w-full rounded-full border border-rule bg-paper px-5 py-3 text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 disabled:opacity-60"
      >
        {(allowBlank || !value) && <option value="">— Select —</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {helper && <p className="mt-1 text-sm text-ink-soft">{helper}</p>}
    </label>
  );
}

function Repeater<T extends { id: string }>({
  title, rows, setRows, addLabel, renderRow, newRow,
}: {
  title: string;
  rows: T[];
  setRows: (rows: T[]) => void;
  addLabel: string;
  renderRow: (row: T, setRow: (r: T) => void) => React.ReactNode;
  newRow: () => T;
}) {
  function move(idx: number, dir: -1 | 1) {
    const next = [...rows];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setRows(next);
  }
  return (
    <section>
      <h2 className="font-serif text-xl text-ink">{title}</h2>
      <ul className="mt-4 space-y-4">
        {rows.map((row, i) => (
          <li key={row.id} className="rounded-2xl border border-rule p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">{renderRow(row, (r) => {
                const next = [...rows];
                next[i] = r;
                setRows(next);
              })}</div>
              <div className="flex flex-col gap-1 text-ink-soft">
                <button type="button" onClick={() => move(i, -1)} title="Move up" className="rounded-full p-1 hover:text-primary"><ArrowUp size={14} /></button>
                <button type="button" onClick={() => move(i, 1)} title="Move down" className="rounded-full p-1 hover:text-primary"><ArrowDown size={14} /></button>
                <button type="button" onClick={() => setRows(rows.filter((_, idx) => idx !== i))} title="Remove" className="rounded-full p-1 hover:text-primary"><Trash2 size={14} /></button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setRows([...rows, newRow()])} className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline">
        <Plus size={14} /> {addLabel}
      </button>
    </section>
  );
}
