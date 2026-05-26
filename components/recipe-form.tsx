'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Plus, Trash2, ArrowUp, ArrowDown, AlertCircle } from 'lucide-react';
import type { ContributorOption, FormOptions } from '@/lib/recipes/form-options';
import {
  type IngredientRow,
  type InstructionRow,
  type PhotoEntry,
  type RecipeDraft,
  newRowId,
} from '@/lib/recipes/draft';
import { saveRecipe, type SaveAction, type SaveOutcome } from '@/lib/recipes/save';
import { ContributorPicker } from '@/components/contributor-picker';
import { PhotoUploader } from '@/components/photo-uploader';

const AUTO_SAVE_INTERVAL_MS = 30_000;
const ADVANCE_DELAY_MS = 1500;

export type RecipeFormMode = 'create' | 'admin_review' | 'edit';

export type QueueContext = {
  sort:   'newest' | 'confidence';
  pos:    number;        // 1-based position in the session
  total:  number;        // session total
  nextId: string | null; // next recipe to load, or null at end
};

function nextHref(ctx: QueueContext): string {
  if (!ctx.nextId) {
    return `/admin/queue?session_complete=true&n=${ctx.pos}`;
  }
  return (
    `/admin/queue/${ctx.nextId}/review` +
    `?sort=${encodeURIComponent(ctx.sort)}` +
    `&pos=${ctx.pos + 1}` +
    `&total=${ctx.total}`
  );
}

export function RecipeForm({
  options,
  initial,
  isAdmin,
  mode = 'create',
  cancelHref,
  queueContext,
}: {
  options: FormOptions;
  initial: RecipeDraft;
  isAdmin: boolean;
  mode?: RecipeFormMode;
  cancelHref?: string; // where the Cancel button (edit mode) returns to
  // Present in mode='admin_review' when the page was opened from the
  // queue. Enables auto-advance, the Skip button, and the "Recipe N of M"
  // hand-off via URL.
  queueContext?: QueueContext | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<RecipeDraft>(initial);
  const [contributors, setContributors] = useState<ContributorOption[]>(options.contributors);
  // Mirror the latest contributors list in a ref so the onChange callback can
  // read the freshest options (including any newly created stub) without
  // re-rendering or relying on a state-update race.
  const contributorsRef = useRef(contributors);
  contributorsRef.current = contributors;
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');

  // Auto-advance toast state. When set, a banner shows and a timer fires
  // ADVANCE_DELAY_MS later. The "Stay on this page" link cancels the timer.
  const [advance, setAdvance] = useState<{
    verb: 'Approved' | 'Rejected' | 'Skipped';
    href: string;
  } | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!advance) return;
    advanceTimer.current = setTimeout(() => {
      router.push(advance.href);
    }, ADVANCE_DELAY_MS);
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    };
  }, [advance, router]);
  function cancelAdvance() {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    setAdvance(null);
  }

  // Track whether the draft is dirty for auto-save.
  const dirtyRef = useRef(false);
  function update<K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) {
    dirtyRef.current = true;
    setDraft((d) => ({ ...d, [key]: value }));
  }

  // Auto-save is for the create flow only. Admin review and edit explicitly
  // opt out — silent auto-save mustn't mutate a pending or published recipe.
  const enableAutoSave = mode === 'create';

  // Auto-save (only after the form has the required FKs, and only for create mode).
  useEffect(() => {
    if (!enableAutoSave) return;
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
  }, [draft, enableAutoSave]);

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

      // In a queue review session, Approve / Reject advance to the next
      // pending recipe instead of bouncing to /recipes/[slug] or /admin/queue.
      if (queueContext && (action === 'publish' || action === 'admin_reject')) {
        setAdvance({
          verb: action === 'publish' ? 'Approved' : 'Rejected',
          href: nextHref(queueContext),
        });
        return;
      }

      if (action === 'publish' && result.slug) {
        router.push(`/recipes/${result.slug}`);
      } else if (action === 'submit_for_review') {
        router.push('/add/thanks');
      } else if (action === 'admin_reject') {
        router.push('/admin/queue?rejected=1');
      } else if ((action === 'edit' || action === 'unpublish') && result.slug) {
        router.push(`/recipes/${result.slug}`);
      }
      // admin_save: no redirect — savedAt timestamp acts as the toast.
    });
  }

  function doSkip() {
    if (!queueContext) return;
    setAdvance({ verb: 'Skipped', href: nextHref(queueContext) });
  }

  const lowConfidence = (f: 'title' | 'suggested_section' | 'overall') => {
    const c = draft.field_confidence?.[f];
    return c === 'low' || c === 'medium';
  };

  return (
    <div className="mt-10 space-y-10">
      {/* Source photo carousel — present after photo intake. */}
      {draft.source_photos && draft.source_photos.length > 0 && (
        <div>
          <p className="label mb-2">Source photos</p>
          <ul className="flex gap-3 overflow-x-auto pb-2">
            {draft.source_photos.map((p, i) => (
              <li key={p.public_url} className="shrink-0">
                <a
                  href={p.public_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-2xl border border-rule"
                  title="Open full size"
                >
                  <div className="relative h-32 w-24">
                    <Image
                      src={p.public_url}
                      alt={`Source photo ${i + 1}`}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </div>
                </a>
              </li>
            ))}
          </ul>
          {draft.notes_to_reviewer && (
            <p className="mt-2 rounded-xl border border-rule bg-paper p-3 text-sm text-ink-soft">
              <AlertCircle size={14} className="mr-1 inline align-text-bottom text-primary" />
              <span className="font-serif italic">From the parser:</span> {draft.notes_to_reviewer}
            </p>
          )}
        </div>
      )}

      <FieldText
        label="Title"
        required
        value={draft.title}
        onChange={(v) => update('title', v)}
        placeholder="Grandma’s sour cream coffee cake"
        flagLowConfidence={lowConfidence('title')}
        flagText={
          draft.alternate_titles && draft.alternate_titles.length > 0
            ? `Or try: ${draft.alternate_titles.slice(0, 2).join(' · ')}`
            : undefined
        }
      />

      <ContributorPicker
        value={draft.contributor_id}
        options={contributors}
        familyLines={options.familyLines}
        recipePrimaryFamilyLineId={draft.primary_family_line_id}
        onChange={(id) => {
          // Auto-fill the recipe's primary family line from the contributor's
          // primary line. Picking a contributor is usually a strong signal about
          // which line the recipe belongs to.
          update('contributor_id', id);
          if (id) {
            const c = (id
              ? contributorsRef.current.find((x) => x.id === id)
              : undefined);
            if (c?.primary_family_line_id) {
              update('primary_family_line_id', c.primary_family_line_id);
            }
          }
        }}
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
        flagLowConfidence={lowConfidence('suggested_section')}
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

      {/* Kitchen notes — surfaces AI-extracted margin annotations and lets the
          user add/edit/remove them. */}
      <div>
        <p className="label">Notes from the kitchen</p>
        <p className="mt-1 text-sm text-ink-soft">
          Margin notes, personal tips, anything the cook added around the recipe.
        </p>
        <ul className="mt-3 space-y-2">
          {(draft.kitchen_notes ?? []).map((note, i) => (
            <li key={i} className="flex items-start gap-2">
              <textarea
                value={note}
                rows={2}
                onChange={(e) => {
                  const next = [...(draft.kitchen_notes ?? [])];
                  next[i] = e.target.value;
                  update('kitchen_notes', next);
                }}
                className="flex-1 rounded-2xl border border-rule bg-paper px-4 py-2 text-sm italic text-ink-soft outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
              />
              <button
                type="button"
                onClick={() => {
                  const next = [...(draft.kitchen_notes ?? [])];
                  next.splice(i, 1);
                  update('kitchen_notes', next);
                }}
                className="mt-1 rounded-full p-1 text-ink-soft hover:text-primary"
                aria-label="Remove note"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => update('kitchen_notes', [...(draft.kitchen_notes ?? []), ''])}
          className="mt-3 inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <Plus size={14} /> Add a note
        </button>
      </div>

      {/* Source photos — only present when the recipe came in via photo intake.
          Add/remove is handled by the PhotoUploader; we don't allow adding new
          sources after the fact (a recipe's sources are its intake artifact). */}
      {(draft.source_photos?.length ?? 0) > 0 && (
        <div>
          <p className="label mb-1">Source photos</p>
          <p className="text-sm text-ink-soft">
            Photos of the original card or page this recipe came from.
          </p>
          <div className="mt-3">
            <PhotoUploader
              kind="source"
              compact
              photos={draft.source_photos ?? []}
              onChange={(next: PhotoEntry[]) => update('source_photos', next)}
              maxPhotos={5}
            />
          </div>
        </div>
      )}

      {/* Finished-dish photos — addable on intake AND on edit (once the recipe
          has an id). */}
      <div>
        <p className="label mb-1">Finished-dish photos</p>
        <p className="text-sm text-ink-soft">
          Photos of the cooked dish. The first one becomes the recipe&rsquo;s hero image.
        </p>
        <div className="mt-3">
          <PhotoUploader
            kind="dish"
            compact
            photos={draft.dish_photos ?? []}
            onChange={(next: PhotoEntry[]) => update('dish_photos', next)}
            recipeId={draft.id}
          />
        </div>
      </div>

      {/* Auto-advance toast (admin review queue sessions). Sits above the
          action row so the user's eye finds it without scrolling. */}
      {advance && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-rule bg-card-blush/40 px-5 py-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-serif text-ink">
              {advance.verb} — loading next…
            </p>
            <button
              type="button"
              onClick={cancelAdvance}
              className="text-sm text-primary underline decoration-rule underline-offset-4 hover:decoration-primary"
            >
              Stay on this page
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-8">
        {mode === 'admin_review' ? (
          <>
            <button
              type="button"
              onClick={() => {
                if (confirm('Reject this recipe? It will move to "rejected" status.')) {
                  doSave('admin_reject');
                }
              }}
              disabled={pending || !!advance}
              className="btn-ghost disabled:opacity-60"
            >
              Reject
            </button>
            <button type="button" onClick={() => doSave('admin_save')} disabled={pending || !!advance} className="btn-ghost disabled:opacity-60">
              Save changes
            </button>
            {queueContext && (
              <button
                type="button"
                onClick={doSkip}
                disabled={pending || !!advance}
                className="btn-ghost disabled:opacity-60"
                title="Don't save, don't change status — just load the next recipe."
              >
                Skip
              </button>
            )}
            <button type="button" onClick={() => doSave('publish')} disabled={pending || !!advance} className="btn-primary disabled:opacity-60">
              {pending ? 'Publishing…' : 'Approve and publish'}
            </button>
          </>
        ) : mode === 'edit' ? (
          <>
            <button
              type="button"
              onClick={() => cancelHref ? router.push(cancelHref) : router.back()}
              disabled={pending}
              className="btn-ghost disabled:opacity-60"
            >
              Cancel
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Unpublish this recipe? It will go back to draft status and disappear from the site.')) {
                    doSave('unpublish');
                  }
                }}
                disabled={pending}
                className="btn-ghost disabled:opacity-60"
              >
                Unpublish (set to draft)
              </button>
            )}
            <button type="button" onClick={() => doSave('edit')} disabled={pending} className="btn-primary disabled:opacity-60">
              {pending ? 'Saving…' : 'Save changes'}
            </button>
          </>
        ) : (
          <>
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
          </>
        )}
        <span className="ml-auto text-sm text-ink-soft" aria-live="polite">
          {savedAt
            ? `Saved · ${savedAt.toLocaleTimeString()}`
            : enableAutoSave
              ? 'Draft auto-saves every 30 seconds.'
              : 'Changes save only when you click a button.'}
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
    case 'unauthorized':       return 'You need to be signed in to save.';
    case 'admin_only':         return 'Only Kate can do that — try “Submit for review”.';
    case 'not_recipe_owner':   return 'Only the recipe’s contributor or an admin can edit this recipe.';
    case 'missing_recipe_id':  return 'No recipe to update — try refreshing.';
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
  label, value, onChange, placeholder, helper, required, flagLowConfidence, flagText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  helper?: string;
  required?: boolean;
  flagLowConfidence?: boolean;
  flagText?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}{required && ' *'}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={
          'mt-2 w-full rounded-full border bg-paper px-5 py-3 text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 ' +
          (flagLowConfidence ? 'border-primary' : 'border-rule')
        }
      />
      {flagLowConfidence && (
        <p className="mt-1 flex items-center gap-1 text-sm text-primary">
          <AlertCircle size={12} aria-hidden="true" />
          <span className="font-serif italic">
            {flagText ?? 'Please double-check this'}
          </span>
        </p>
      )}
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
  label, value, onChange, options, required, disabled, helper, allowBlank, flagLowConfidence,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  disabled?: boolean;
  helper?: string;
  allowBlank?: boolean;
  flagLowConfidence?: boolean;
}) {
  return (
    <label className="block">
      <span className="label">{label}{required && ' *'}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={
          'mt-2 w-full rounded-full border bg-paper px-5 py-3 text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 disabled:opacity-60 ' +
          (flagLowConfidence ? 'border-primary' : 'border-rule')
        }
      >
        {(allowBlank || !value) && <option value="">— Select —</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {flagLowConfidence && (
        <p className="mt-1 flex items-center gap-1 text-sm text-primary">
          <AlertCircle size={12} aria-hidden="true" />
          <span className="font-serif italic">Please double-check this</span>
        </p>
      )}
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
